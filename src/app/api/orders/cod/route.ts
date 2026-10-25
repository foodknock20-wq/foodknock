// src/app/api/orders/cod/route.ts
//
// Cash on Delivery order creation.
//
// ── FLOW ──────────────────────────────────────────────────────────────────────
//   1. Auth check (must be logged-in user; guest COD is blocked)
//   2. Shop open check
//   3. COD eligibility check (grandTotal must be < the server-resolved
//      DeliverySettings COD cap — see pricing.codMaxOrderAmount)
//   4. Delegate to createOrderCore — same logic as Razorpay verify
//      (stock, review reward, loyalty, telegram, first-free-delivery)
//   5. Return orderId for redirect to /order-success
//
// NO Razorpay calls. NO webhook. NO duplicate logic.
//
// PERF PASS (Orders/Loyalty audit):
//   The auth check (`select("_id isActive")`) and the pre-checkout loyalty
//   balance fetch (`select("loyaltyPoints")`) were two separate
//   User.findById() calls for the SAME user within this one request. They
//   are now ONE combined query at auth time (`select("_id isActive
//   loyaltyPoints")`), with the loyalty balance cached for reuse later in
//   the redemption-clamping step. This does NOT touch createOrderCore's own
//   independent server-side loyalty re-validation — that second check is a
//   deliberate defense-in-depth security cap (see createOrderCore.ts) and
//   is left completely untouched, preserving 100% of the existing
//   validation behavior.
//   Expected Mongo: -1 query per COD order that includes a point redemption.

import { NextResponse } from "next/server";
import { connectDB }    from "@/lib/db";
import User              from "@/models/User";
import { verifyToken }  from "@/lib/auth";
import { getShopStatus } from "@/models/Shop";
import { PLATFORM_FEE } from "@/lib/delivery";
import { calculateDeliveryPricing } from "@/lib/serviceability";
import {
    LOYALTY_CONFIG,
    maxRedeemablePoints,
    pointsToRupees,
} from "@/lib/loyaltyService";
import { createOrderCore } from "@/lib/createOrderCore";
import { calculateAuthoritativePricing } from "@/lib/pricing";

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

        // PERF: cached from the single combined auth+loyalty query below —
        // reused later instead of a second User.findById() for redemption
        // clamping. undefined until (and unless) a valid session user is
        // resolved.
        let cachedLoyaltyPoints: number | undefined;

        if (token) {
            try {
                const decoded = verifyToken(token) as { userId?: string };
                if (decoded?.userId) {
                    const user = await User.findById(decoded.userId)
                        .select("_id isActive loyaltyPoints")
                        .lean() as { _id: unknown; isActive?: boolean; loyaltyPoints?: number } | null;
                    if (user?.isActive === false) {
                        return NextResponse.json(
                            { success: false, message: "Your account has been blocked." },
                            { status: 403 }
                        );
                    }
                    if (user) {
                        linkedUserId = String(user._id);
                        cachedLoyaltyPoints = user.loyaltyPoints;
                    }
                }
            } catch {}
        }

        // Phase 9 finalization: this header comment has said "guest COD is
        // blocked" since this file was written, but no code here ever
        // actually enforced it — an absent/invalid token silently fell
        // through with linkedUserId left null, and createOrderCore happily
        // creates a null-user ("guest") order. Closing that gap for real,
        // mirroring the same hard gate already enforced in
        // /api/payment/create-order, /api/payment/verify, and /api/orders.
        if (!linkedUserId) {
            return NextResponse.json(
                { success: false, message: "Please log in to place an order" },
                { status: 401 }
            );
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
            latitude:  bodyLatitude  = null,
            longitude: bodyLongitude = null,
            deliveryInstructions = "",
            couponCode = null,
        } = body;

        const latitude  = typeof bodyLatitude  === "number" && Number.isFinite(bodyLatitude)  ? bodyLatitude  : null;
        const longitude = typeof bodyLongitude === "number" && Number.isFinite(bodyLongitude) ? bodyLongitude : null;

        // PHASE 2A: client sends { _id, quantity } — any client-supplied
        // price is ignored. Authoritative name/price/image come from the
        // live Product document. See src/lib/pricing.ts.
        const { items, subtotal } = await calculateAuthoritativePricing(rawItems ?? []);

        // Phase 10 — the same authoritative engine createOrderCore()
        // re-validates with below. Never trust a client-supplied fee/
        // distance/serviceable flag.
        const pricing = await calculateDeliveryPricing({
            latitude,
            longitude,
            cartSubtotal: subtotal,
            linkedUserId,
            orderType,
        });

        if (orderType === "delivery" && !pricing.serviceable) {
            const message = pricing.reason === "coordinates_required"
                ? "Please select your delivery location to continue."
                : "This delivery location is outside FoodKnock's current delivery area.";
            return NextResponse.json({ success: false, message }, { status: 400 });
        }

        if (subtotal < pricing.minimumOrderValue) {
            return NextResponse.json(
                { success: false, message: `Minimum order amount is ₹${pricing.minimumOrderValue}` },
                { status: 400 }
            );
        }

        const deliveryFee = pricing.deliveryFee;

        const grossTotal = subtotal + deliveryFee + PLATFORM_FEE;

        // ── COD eligibility ────────────────────────────────────────────────
        // Fast-fail UX guard using the server-resolved cap (from the pricing
        // engine above). createOrderCore re-checks the authoritative,
        // discounted gross total as the true gate — this early check never
        // becomes the only enforcement.
        if (grossTotal >= pricing.codMaxOrderAmount) {
            return NextResponse.json(
                {
                    success: false,
                    message: `COD is only available for orders below ₹${pricing.codMaxOrderAmount}. Please pay online.`,
                },
                { status: 400 }
            );
        }

        // ── Server-side loyalty validation (same as create-order) ──────────
        let validatedRedeemPoints = 0;

        const req_points = Math.max(0, Math.floor(Number(requestedRedeemPoints)));

        if (linkedUserId && req_points >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
            // PERF: reused from the single combined auth+loyalty query above
            // instead of a second User.findById() here.
            const liveBalance = Number(cachedLoyaltyPoints ?? 0);

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
    latitude,
    longitude,
    deliveryInstructions: String(deliveryInstructions ?? "").trim().slice(0, 300),
    // Phase 11 — createOrderCore validates+reserves this itself against
    // its own authoritative subtotal; never trusted/precomputed here.
    couponCode: couponCode ? String(couponCode) : null,
});

        return NextResponse.json(
            {
                success:               true,
                orderId:               result.orderId,
                reviewRewardApplied:   result.reviewRewardApplied,
                loyaltyPointsRedeemed: result.loyaltyPointsRedeemed,
                isFirstDeliveryFreeApplied: result.isFirstDeliveryFreeApplied,
                couponDiscountAmount:  result.couponDiscountAmount,
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