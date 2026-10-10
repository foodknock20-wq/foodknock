export const dynamic = "force-dynamic";

// src/app/api/donations/create-order/route.ts
//
// Pre-Phase 17 — Phase 2: Street Animal Support donation. Step 1 of a
// Razorpay flow that is DELIBERATELY SEPARATE from the food-order flow
// (src/app/api/payment/create-order/route.ts) — a different Razorpay
// order, a different record (Donation, not PendingPayment/Order), never
// merged into the food-order amount/coupon/loyalty calculations.
//
// Reuses the existing centralized auth (requireUser) and rate-limiting
// infra — no second auth/rate-limit system.

import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { connectDB } from "@/lib/db";
import Donation from "@/models/Donation";
import { requireUser } from "@/lib/apiAuth";
import { isRateLimited } from "@/lib/rateLimit";
import { validateDonationAmountToPaise, donationReceipt } from "@/lib/donations";
import { MIN_DONATION_AMOUNT, MAX_DONATION_AMOUNT } from "@/lib/constants";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
    try {
        const auth = await requireUser(req);
        if (!auth) {
            return NextResponse.json({ success: false, message: "Please log in to contribute" }, { status: 401 });
        }

        // Financially sensitive endpoint — bounded retries, generous enough
        // for legitimate "try again after a failed/cancelled payment" use.
        if (await isRateLimited(`donation-create:${auth.userId}`, 15, 60 * 60 * 1000)) {
            return NextResponse.json(
                { success: false, message: "Too many attempts. Please try again later." },
                { status: 429 }
            );
        }

        await connectDB();

        const body = await req.json().catch(() => ({} as Record<string, unknown>));

        // SERVER-SIDE ONLY — the client's requested amount is independently
        // validated and converted to paise here; never trusted as-is.
        const amountPaise = validateDonationAmountToPaise(body?.amount);
        if (amountPaise === null) {
            return NextResponse.json(
                { success: false, message: `Contribution must be between ₹${MIN_DONATION_AMOUNT} and ₹${MAX_DONATION_AMOUNT}` },
                { status: 400 }
            );
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: donationReceipt(),
            notes: {
                type: "donation",
                userId: auth.userId,
            },
        });

        const donation = await Donation.create({
            userId: auth.userId,
            amountPaise,
            status: "pending",
            razorpayOrderId: razorpayOrder.id,
        });

        return NextResponse.json({
            success: true,
            donationId: String(donation._id),
            razorpayOrderId: razorpayOrder.id,
            amount: amountPaise / 100,
            currency: "INR",
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error: unknown) {
        console.error("DONATION_CREATE_ORDER_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to start contribution" }, { status: 500 });
    }
}
