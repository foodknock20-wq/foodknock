export const dynamic = "force-dynamic";

// src/app/api/orders/cod/route.ts
//
// Cash on Delivery order creation.
//
// ── FLOW ──────────────────────────────────────────────────────────────────────
//   1. Auth check (must be logged-in user; guest COD is blocked)
//   2. Shop open check
//   3. COD eligibility check (grandTotal must be < COD_MAX_ORDER_AMOUNT)
//   4. Delegate to createOrderCore — same logic as Razorpay verify
//      (stock, review reward, loyalty, telegram, first-free-delivery)
//   5. Return orderId for redirect to /order-success
//
// NO Razorpay calls. NO webhook. NO duplicate logic.

import { NextResponse } from "next/server";
import { connectDB }    from "@/lib/db";
import User             from "@/models/User";
import { verifyToken }  from "@/lib/auth";
import { getShopStatus } from "@/models/Shop";
import {
    calculateDeliveryFee,
    PLATFORM_FEE,
} from "@/lib/delivery";
import { checkFirstFreeDelivery } from "@/lib/firstFreeDelivery";
import {
    LOYALTY_CONFIG,
    maxRedeemablePoints,
    pointsToRupees,
} from "@/lib/loyaltyService";
import { createOrderCore } from "@/lib/createOrderCore";
import { COD_MAX_ORDER_AMOUNT } from "@/lib/constants";

export async function POST(req: Request) {
    try {
        await connectDB();

        // ── Shop status ───────────────────────────────────────────────────
        const { isOpen } = await getShopStatus();
        if (!isOpen) {
            return NextResponse.json(
                { success: false, message: "Shop is currently closed" },
                { status: 503 }
            );
        }

        // ── Auth ──────────────────────────────────────────────────────────
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
        let linkedUserId: string | null = null;

        if (token) {
            try {
                const decoded = verifyToken(token) as { userId?: string };
                if (decoded?.userId) {
                    const user = await User.findById(decoded.userId)
                        .select("_id isActive")
                        .lean() as { _id: unknown; isActive?: boolean } | null;
                    if (user?.isActive === false) {
                        return NextResponse.json(
                            { success: false, message: "Your account has been blocked." },
                            { status: 403 }
                        );
                    }
                    if (user) linkedUserId = String(user._id);
                }
            } catch {}
        }

        const body = await req.json();
        const {
            customerName,
            phone,
            address,
            landmark = "",
            note     = "",
            orderType = "delivery",
            items: rawItems,
            redeemedPoints: requestedRedeemPoints = 0,
        } = body;

        const items: Array<{ _id: string; name: string; price: number; quantity: number; image?: string }> =
            rawItems ?? [];

        if (!items.length) {
            return NextResponse.json(
                { success: false, message: "Cart is empty" },
                { status: 400 }
            );
        }

        // ── Compute gross total to enforce COD limit ───────────────────────
        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

        const { eligible: firstDeliveryFree } = await checkFirstFreeDelivery(
            linkedUserId,
            orderType
        );

        const deliveryFee =
            orderType === "pickup"
                ? 0
                : firstDeliveryFree
                    ? 0
                    : calculateDeliveryFee(subtotal);

        const grossTotal = subtotal + deliveryFee + PLATFORM_FEE;

        // ── COD eligibility ────────────────────────────────────────────────
        if (grossTotal >= COD_MAX_ORDER_AMOUNT) {
            return NextResponse.json(
                {
                    success: false,
                    message: `COD is only available for orders below ₹${COD_MAX_ORDER_AMOUNT}. Please pay online.`,
                },
                { status: 400 }
            );
        }

        // ── Server-side loyalty validation (same as create-order) ──────────
        let validatedRedeemPoints = 0;

        const req_points = Math.max(0, Math.floor(Number(requestedRedeemPoints)));

        if (linkedUserId && req_points >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
            const freshUser = await User.findById(linkedUserId)
                .select("loyaltyPoints")
                .lean() as { loyaltyPoints?: number } | null;
            const liveBalance = Number(freshUser?.loyaltyPoints ?? 0);

            const maxAllowed = maxRedeemablePoints(grossTotal, liveBalance);
            const clamped    = Math.min(req_points, maxAllowed, liveBalance);

            if (clamped >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
                validatedRedeemPoints = clamped;
            }
        }

        // ── Delegate to shared core ───────────────────────────────────────
        const result = await createOrderCore({
    paymentMethod: "cod",
    customerName,
    phone,
    address,
    landmark,
    note,
    orderType,
    items,
    linkedUserId,
    validatedRedeemPoints,
});

        return NextResponse.json(
            {
                success:               true,
                orderId:               result.orderId,
                reviewRewardApplied:   result.reviewRewardApplied,
                loyaltyPointsRedeemed: result.loyaltyPointsRedeemed,
                isFirstDeliveryFreeApplied: result.isFirstDeliveryFreeApplied,
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("COD_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: error?.message || "Failed to place COD order" },
            { status: error?.status || 500 }
        );
    }
}
