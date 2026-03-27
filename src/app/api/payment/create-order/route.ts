export const dynamic = "force-dynamic";

// src/app/api/payment/create-order/route.ts
//
// Step 1 of the Razorpay flow.
// Accepts redeemedPoints from frontend, validates server-side, includes
// the discount in the Razorpay order amount, and echoes validatedRedeemPoints
// back to the client. The verify route uses this validated value.

import { NextResponse }  from "next/server";
import Razorpay          from "razorpay";
import { connectDB }     from "@/lib/db";
import User              from "@/models/User";
import { verifyToken }   from "@/lib/auth";
import { calculateDeliveryFee, PLATFORM_FEE } from "@/lib/delivery";
import { checkFirstFreeDelivery }             from "@/lib/firstFreeDelivery";
import { getShopStatus }                      from "@/models/Shop";
import {
    LOYALTY_CONFIG,
    maxRedeemablePoints,
    pointsToRupees,
} from "@/lib/loyaltyService";

const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
    try {
        const { isOpen } = await getShopStatus();
        if (!isOpen) {
            return NextResponse.json(
                { success: false, message: "Shop is currently closed" },
                { status: 503 }
            );
        }

        const body = await req.json();

        const items: Array<{ price: number; quantity: number }> = body.items ?? [];
        if (!items.length) {
            return NextResponse.json(
                { success: false, message: "Cart is empty" },
                { status: 400 }
            );
        }

        const orderType: string = body.orderType ?? "delivery";

        // Points the client wants to redeem
        const requestedRedeemPoints: number = Math.max(
            0,
            Math.floor(Number(body.redeemedPoints ?? 0))
        );

        // ── Auth resolution ───────────────────────────────────────────────
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
        let linkedUserId: string | null = null;
        let liveBalance:  number        = 0;

        if (token) {
            try {
                const decoded = verifyToken(token) as { userId?: string };
                if (decoded?.userId) {
                    await connectDB();
                    const user = await User.findById(decoded.userId)
                        .select("_id isActive loyaltyPoints")
                        .lean() as { _id: unknown; isActive?: boolean; loyaltyPoints?: number } | null;
                    if (user && user.isActive !== false) {
                        linkedUserId = String(user._id);
                        liveBalance  = user.loyaltyPoints ?? 0;
                    }
                }
            } catch { /* invalid token → guest */ }
        }

        // ── Pricing ───────────────────────────────────────────────────────
        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

        const { eligible: firstDeliveryFree } = await checkFirstFreeDelivery(
            linkedUserId,
            orderType
        );

        const deliveryFee = orderType === "pickup"
            ? 0
            : firstDeliveryFree
                ? 0
                : calculateDeliveryFee(subtotal);

        const grossTotal = subtotal + deliveryFee + PLATFORM_FEE;

        // ── Server-side loyalty validation ────────────────────────────────
        // This is the AUTHORITATIVE calculation. The verify route trusts this.
        let validatedRedeemPoints = 0;
        let redeemedAmount        = 0;

        if (linkedUserId && requestedRedeemPoints >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
            const maxAllowed = maxRedeemablePoints(grossTotal, liveBalance);
            const clamped    = Math.min(requestedRedeemPoints, maxAllowed, liveBalance);

            if (clamped >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
                validatedRedeemPoints = clamped;
                redeemedAmount        = pointsToRupees(validatedRedeemPoints);
            }
        }

        // ── Final amount ──────────────────────────────────────────────────
        const finalAmount = Math.max(1, grossTotal - redeemedAmount);

        // ── Create Razorpay order ─────────────────────────────────────────
        const razorpayOrder = await razorpay.orders.create({
            amount:   Math.round(finalAmount * 100), // paise
            currency: "INR",
            receipt:  `rcpt_${Date.now()}`,
            notes: {
                orderType,
                customerName:          body.customerName ?? "",
                firstDeliveryFree:     String(firstDeliveryFree),
                validatedRedeemPoints: String(validatedRedeemPoints),
                redeemedAmount:        String(redeemedAmount),
            },
        });

        return NextResponse.json({
            success:         true,
            razorpayOrderId: razorpayOrder.id,
            amount:          finalAmount,
            currency:        "INR",
            keyId:           process.env.RAZORPAY_KEY_ID,
            subtotal,
            deliveryFee,
            platformFee:     PLATFORM_FEE,
            grossTotal,
            redeemedAmount,
            validatedRedeemPoints,   // echo back — verify will use this
            isFirstDeliveryFreeApplied: firstDeliveryFree,
        });
    } catch (error) {
        console.error("CREATE_RAZORPAY_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to create payment order" },
            { status: 500 }
        );
    }
}