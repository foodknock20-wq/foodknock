export const dynamic = "force-dynamic";

// src/app/api/payment/create-order/route.ts
//
// Step 1 of the Razorpay flow.
// Accepts redeemedPoints from frontend, validates server-side, includes
// the discount in the Razorpay order amount, and echoes validatedRedeemPoints
// back to the client. The verify route uses this validated value.
//
// PAYMENT RELIABILITY (Phase 1A):
// Also persists a PendingPayment document holding the full checkout context
// (items/customer/address) needed to recreate the order later — from either
// the client's /verify call or the Razorpay webhook — without ever trusting
// re-submitted client data during recovery. See src/models/PendingPayment.ts
// for the full rationale.

import { NextResponse }  from "next/server";
import Razorpay          from "razorpay";
import { connectDB }     from "@/lib/db";
import User              from "@/models/User";
import { verifyToken }   from "@/lib/auth";
import { PLATFORM_FEE }                       from "@/lib/delivery";
import { calculateDeliveryPricing }           from "@/lib/serviceability";
import { getShopStatus }                      from "@/models/Shop";
import { calculateAuthoritativePricing }      from "@/lib/pricing";
import { validateCoupon } from "@/lib/coupons";
import { getBestAutomaticOffer } from "@/lib/offers";
import { selectBestPromotion } from "@/lib/promotions";
import { persistPendingPaymentWithRetry } from "@/lib/paymentReconciliation";
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
        await connectDB();

        const { isOpen } = await getShopStatus();
        if (!isOpen) {
            return NextResponse.json(
                { success: false, message: "Shop is currently closed" },
                { status: 503 }
            );
        }

        const body = await req.json();

        // PHASE 2A: client sends { _id, quantity } (price/name/image may be
        // present but are IGNORED). Authoritative name/price/image are
        // derived from the live Product document below — this is the
        // snapshot that gets charged via Razorpay and persisted into
        // PendingPayment for later order recovery. See src/lib/pricing.ts.
        const rawItems: Array<{ _id: string; quantity: number }> = body.items ?? [];

        const { items, subtotal } = await calculateAuthoritativePricing(rawItems);

        const customerName: string = String(body.customerName ?? "").trim();
        const phone:         string = String(body.phone ?? "").trim();
        const address:        string = String(body.address ?? "").trim();
        const landmark:       string = String(body.landmark ?? "").trim();
        const note:           string = String(body.note ?? "").trim();
        const deliveryInstructions: string = String(body.deliveryInstructions ?? "").trim().slice(0, 300);
        const couponCode: string = String(body.couponCode ?? "").trim();

        const orderType: string = body.orderType ?? "delivery";

        // Phase 10 — customer's delivery coordinates. Informational from
        // this route's own request-validation point of view; the actual
        // serviceability/fee decision happens in calculateDeliveryPricing()
        // below, and is re-verified again at order creation time regardless.
        const latitude  = typeof body.latitude  === "number" && Number.isFinite(body.latitude)  ? body.latitude  : null;
        const longitude = typeof body.longitude === "number" && Number.isFinite(body.longitude) ? body.longitude : null;

        if (!customerName || !phone) {
            return NextResponse.json(
                { success: false, message: "Customer name and phone are required" },
                { status: 400 }
            );
        }
        if (orderType === "delivery" && !address) {
            return NextResponse.json(
                { success: false, message: "Delivery address is required" },
                { status: 400 }
            );
        }

        // Points the client wants to redeem
        const requestedRedeemPoints: number = Math.max(
            0,
            Math.floor(Number(body.redeemedPoints ?? 0))
        );

        // ── Auth resolution (Phase 9: guest checkout is no longer allowed —
        // mirrors the server-side gate already enforced by /api/orders/cod.
        // Previously an invalid/missing token silently fell through to a
        // "guest" branch with linkedUserId = null; that branch is removed.
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

        if (!token) {
            return NextResponse.json(
                { success: false, message: "Please log in to place an order" },
                { status: 401 }
            );
        }

        let linkedUserId: string;
        let liveBalance:  number = 0;

        try {
            const decoded = verifyToken(token) as { userId?: string };
            if (!decoded?.userId) {
                return NextResponse.json(
                    { success: false, message: "Please log in to place an order" },
                    { status: 401 }
                );
            }
            const user = await User.findById(decoded.userId)
                .select("_id isActive loyaltyPoints")
                .lean() as { _id: unknown; isActive?: boolean; loyaltyPoints?: number } | null;
            if (!user || user.isActive === false) {
                return NextResponse.json(
                    { success: false, message: "Please log in to place an order" },
                    { status: 401 }
                );
            }
            linkedUserId = String(user._id);
            liveBalance  = user.loyaltyPoints ?? 0;
        } catch {
            return NextResponse.json(
                { success: false, message: "Please log in to place an order" },
                { status: 401 }
            );
        }

        // ── Pricing (Phase 10) ──────────────────────────────────────────────
        // `subtotal` and `items` here are already authoritative (derived
        // from Product.price above) — never recomputed from client input.
        // calculateDeliveryPricing() is the SAME engine createOrderCore()
        // re-validates with at order-creation time — never trust a client-
        // supplied fee/distance/serviceable flag.
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

        const firstDeliveryFree = pricing.freeDeliveryReason === "first_order";

        // ── Coupon + Offer — best-wins selection (Phase 12 finalization) ────
        // Mirrors createOrderCore.ts's identical logic exactly — this IS what
        // locks the Razorpay charge amount, so it must select the same
        // winner createOrderCore will re-derive (coupon) or trust (offer
        // snapshot) at order-creation time. See src/lib/promotions.ts.
        let couponCandidate: Parameters<typeof selectBestPromotion>[0]["coupon"] = null;
        if (couponCode) {
            const couponResult = await validateCoupon({ code: couponCode, subtotal, userId: linkedUserId });
            if (!couponResult.valid) {
                return NextResponse.json({ success: false, message: couponResult.message }, { status: 400 });
            }
            couponCandidate = {
                source: "coupon",
                id: couponResult.couponId,
                campaignId: null,
                code: couponResult.code,
                name: couponResult.code,
                discountType: couponResult.discountType,
                discountValue: couponResult.discountValue,
                discountAmount: couponResult.discountAmount,
                freeDelivery: couponResult.freeDelivery,
            };
        }

        const offerLookup = await getBestAutomaticOffer({ subtotal, linkedUserId });
        const offerCandidate: Parameters<typeof selectBestPromotion>[0]["offer"] = offerLookup
            ? {
                  source: "offer",
                  id: offerLookup.offerId,
                  campaignId: offerLookup.campaignId,
                  code: null,
                  name: offerLookup.name,
                  discountType: offerLookup.discountType,
                  discountValue: offerLookup.discountValue,
                  discountAmount: offerLookup.discountAmount,
                  freeDelivery: offerLookup.freeDelivery,
              }
            : null;

        const promotion = selectBestPromotion({ coupon: couponCandidate, offer: offerCandidate, baseDeliveryFee: pricing.deliveryFee });

        const couponSnapshot = promotion.source === "coupon"
            ? { couponId: promotion.couponId as string, code: promotion.code as string, discountType: promotion.discountType as "FIXED" | "PERCENTAGE" | "FREE_DELIVERY", discountValue: promotion.discountValue as number }
            : null;
        const offerSnapshot = promotion.source === "offer"
            ? { offerId: promotion.offerId as string, campaignId: promotion.campaignId, name: promotion.name as string, discountType: promotion.discountType as "FIXED" | "PERCENTAGE" | "FREE_DELIVERY", discountValue: promotion.discountValue as number, discountAmount: promotion.discountAmount, freeDelivery: promotion.freeDelivery }
            : null;

        const couponDiscountAmount = promotion.discountAmount;
        const deliveryFee = promotion.freeDelivery ? 0 : pricing.deliveryFee;

        const discountedSubtotal = Math.max(0, subtotal - couponDiscountAmount);
        const grossTotal = discountedSubtotal + deliveryFee + PLATFORM_FEE;

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
                customerName:          customerName,
                firstDeliveryFree:     String(firstDeliveryFree),
                validatedRedeemPoints: String(validatedRedeemPoints),
                redeemedAmount:        String(redeemedAmount),
            },
        });

        // ── Persist reconciliation context ──────────────────────────────────
        // This is what makes the webhook (and, as of Phase 17.1A, the
        // orphaned-payment reconciliation scan + admin recovery flow) able
        // to recover an order if the client never completes
        // /api/payment/verify. A failure here must not fail the checkout
        // (the Razorpay order already exists and the customer can still
        // pay) — but it DOES mean this specific payment can only be
        // completed via the client path, since neither the webhook nor
        // reconciliation will have any stored checkout context to recover
        // from (Razorpay itself has no record of the cart/address). Phase
        // 17.1A hardened this from a single attempt to a short bounded
        // retry (persistPendingPaymentWithRetry) specifically to narrow —
        // not eliminate — this one unrecoverable failure window; still
        // logged loudly on exhaustion so it's visible in server logs.
        await persistPendingPaymentWithRetry({
            razorpayOrderId: razorpayOrder.id,
            status:          "created",
            expectedAmount:  finalAmount,
            payload: {
                customerName,
                phone,
                address,
                landmark,
                note,
                orderType,
                latitude,
                longitude,
                deliveryInstructions,
                items: items.map((i) => ({
                    _id:      i._id,
                    name:     i.name,
                    price:    i.price,
                    quantity: i.quantity,
                    image:    i.image ?? "",
                })),
                linkedUserId,
                validatedRedeemPoints,
                // Phase 11 — locked in now, trusted as-is at order-
                // creation time (createOrderCore does NOT recompute it).
                couponId:             couponSnapshot?.couponId ?? null,
                couponCode:           couponSnapshot?.code ?? null,
                couponDiscountType:   couponSnapshot?.discountType ?? null,
                couponDiscountValue:  couponSnapshot?.discountValue ?? null,
                couponDiscountAmount,
                offerId:             offerSnapshot?.offerId ?? null,
                offerCampaignId:     offerSnapshot?.campaignId ?? null,
                offerName:           offerSnapshot?.name ?? null,
                offerDiscountType:   offerSnapshot?.discountType ?? null,
                offerDiscountValue:  offerSnapshot?.discountValue ?? null,
                offerDiscountAmount: offerSnapshot?.discountAmount ?? 0,
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
            couponDiscountAmount,
            couponCode: couponSnapshot?.code ?? null,
            // Phase 10 — informational only, re-verified at order creation
            distanceKm:   pricing.distanceKm,
            serviceable:  pricing.serviceable,
        });
    } catch (error: any) {
        console.error("CREATE_RAZORPAY_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: error?.message || "Failed to create payment order" },
            { status: error?.status || 500 }
        );
    }
}