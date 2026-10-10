export const dynamic = "force-dynamic";

// src/app/api/donations/verify/route.ts
//
// Pre-Phase 17 — Phase 2: Street Animal Support donation. Step 2 of the
// donation Razorpay flow — reuses the exact signature-verification pattern
// already proven in /api/payment/verify, plus an independent Razorpay
// payments.fetch() amount/status check (same defense-in-depth the food-
// order flow uses), then atomically settles the Donation via
// src/lib/donations.ts. A client-side "success" callback is NEVER
// sufficient by itself — this route is the authority.

import { NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { connectDB } from "@/lib/db";
import Donation from "@/models/Donation";
import { requireUser } from "@/lib/apiAuth";
import { isRateLimited } from "@/lib/rateLimit";
import { settleDonationSuccess } from "@/lib/donations";

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

        if (await isRateLimited(`donation-verify:${auth.userId}`, 30, 60 * 60 * 1000)) {
            return NextResponse.json(
                { success: false, message: "Too many requests. Please try again later." },
                { status: 429 }
            );
        }

        await connectDB();

        const body = await req.json().catch(() => ({} as Record<string, unknown>));
        const razorpayOrderId = String(body?.razorpayOrderId ?? "");
        const razorpayPaymentId = String(body?.razorpayPaymentId ?? "");
        const razorpaySignature = String(body?.razorpaySignature ?? "");

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return NextResponse.json({ success: false, message: "Missing payment details" }, { status: 400 });
        }

        // ── Signature verification — identical scheme to /api/payment/verify ──
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            return NextResponse.json({ success: false, message: "Payment verification unavailable" }, { status: 500 });
        }
        const expectedSig = crypto
            .createHmac("sha256", secret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest("hex");
        if (expectedSig !== razorpaySignature) {
            console.error("DONATION_VERIFY_INVALID_SIGNATURE", { razorpayOrderId, razorpayPaymentId });
            return NextResponse.json({ success: false, message: "Invalid payment signature" }, { status: 400 });
        }

        // ── Resolve the donation — IDOR guard: only its own owner may verify it ──
        const donation = await Donation.findOne({ razorpayOrderId, userId: auth.userId })
            .select("_id amountPaise status")
            .lean<{ _id: unknown; amountPaise: number; status: string } | null>();

        if (!donation) {
            return NextResponse.json({ success: false, message: "Contribution not found" }, { status: 404 });
        }

        // Already settled (webhook beat us, or this is a duplicate client
        // retry) — idempotent response, never double-count.
        if (donation.status === "success") {
            return NextResponse.json({
                success: true,
                status: "success",
                amount: donation.amountPaise / 100,
            });
        }

        // Independently confirm with Razorpay itself — never trust only the
        // client-supplied signature (same defense-in-depth as food-order verify).
        try {
            const payment = await razorpay.payments.fetch(razorpayPaymentId);
            const capturedLike = payment.status === "captured" || payment.status === "authorized";
            if (!capturedLike) {
                console.error("DONATION_VERIFY_NOT_CAPTURED", { razorpayOrderId, razorpayPaymentId, status: payment.status });
                return NextResponse.json({ success: false, message: "Payment not confirmed by Razorpay" }, { status: 400 });
            }
            if (Number(payment.amount) !== donation.amountPaise) {
                console.error("DONATION_VERIFY_AMOUNT_MISMATCH", {
                    razorpayOrderId, razorpayPaymentId,
                    expectedPaise: donation.amountPaise, reportedPaise: payment.amount,
                });
                return NextResponse.json({ success: false, message: "Payment amount mismatch" }, { status: 400 });
            }
        } catch (fetchErr) {
            // Razorpay API unreachable — don't block a legitimately signature-
            // verified payment on a transient network blip (same tolerance as
            // the food-order verify route); proceed to the atomic settle below.
            console.error("DONATION_VERIFY_RAZORPAY_FETCH_ERROR", { razorpayOrderId, error: fetchErr });
        }

        const settled = await settleDonationSuccess(razorpayOrderId, razorpayPaymentId, auth.userId);

        if (settled) {
            return NextResponse.json({
                success: true,
                status: "success",
                amount: settled.amountPaise / 100,
            });
        }

        // Lost the atomic claim — the webhook (or a concurrent duplicate
        // client call) settled it first. Re-read rather than double-count.
        const current = await Donation.findOne({ razorpayOrderId, userId: auth.userId })
            .select("status amountPaise")
            .lean<{ status: string; amountPaise: number } | null>();

        if (current?.status === "success") {
            return NextResponse.json({ success: true, status: "success", amount: current.amountPaise / 100 });
        }

        console.error("DONATION_VERIFY_CLAIM_LOST_UNRESOLVED", { razorpayOrderId, razorpayPaymentId });
        return NextResponse.json(
            { success: false, message: "Your contribution is still being confirmed — please check back shortly." },
            { status: 202 }
        );
    } catch (error: unknown) {
        console.error("DONATION_VERIFY_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to confirm contribution" }, { status: 500 });
    }
}
