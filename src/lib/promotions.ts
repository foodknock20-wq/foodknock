// src/lib/promotions.ts
//
// Phase 12 finalization — THE single place the "coupon vs. automatic
// offer" decision is made. Locked rule (spec Part W): at most ONE
// promotional discount source applies per order — but when BOTH a valid
// coupon AND an eligible automatic offer exist for the same cart, the
// BEST one (by effective rupee value) wins, not simply "coupon always
// wins because it's present". Loyalty redemption is a separate, always-
// independent third thing — never affected by this choice.
//
// "Effective value" has to account for FREE_DELIVERY specially: a
// FREE_DELIVERY promotion's discountAmount (against the subtotal) is
// always 0 by construction (see calculateCouponDiscount) — its real value
// is whatever the delivery fee would have been. Comparing a ₹75-off
// coupon against a free-delivery offer only makes sense once both are
// expressed in the same unit (rupees saved), which is what this function
// does before picking a winner.

export type PromotionCandidate = {
    source: "coupon" | "offer";
    id: string;
    campaignId: string | null;
    code: string | null;
    name: string;
    discountType: "FIXED" | "PERCENTAGE" | "FREE_DELIVERY";
    discountValue: number;
    discountAmount: number;
    freeDelivery: boolean;
} | null;

export type PromotionChoice = {
    source: "coupon" | "offer" | null;
    couponId: string | null;
    offerId: string | null;
    campaignId: string | null;
    code: string | null;
    name: string | null;
    discountType: "FIXED" | "PERCENTAGE" | "FREE_DELIVERY" | null;
    discountValue: number | null;
    /** Subtotal reduction — 0 whenever freeDelivery is true. */
    discountAmount: number;
    freeDelivery: boolean;
};

function effectiveValue(candidate: PromotionCandidate, baseDeliveryFee: number): number {
    if (!candidate) return -1;
    return candidate.freeDelivery ? baseDeliveryFee : candidate.discountAmount;
}

/**
 * Picks the single winning promotion. Ties favor the coupon — it's the
 * one the customer actively typed in, so honoring it over a passive
 * automatic offer of equal value is the less surprising outcome.
 */
export function selectBestPromotion(params: {
    coupon: PromotionCandidate;
    offer: PromotionCandidate;
    baseDeliveryFee: number;
}): PromotionChoice {
    const couponValue = effectiveValue(params.coupon, params.baseDeliveryFee);
    const offerValue = effectiveValue(params.offer, params.baseDeliveryFee);

    const winner = couponValue >= offerValue ? params.coupon : params.offer;

    if (!winner) {
        return {
            source: null, couponId: null, offerId: null, campaignId: null,
            code: null, name: null, discountType: null, discountValue: null,
            discountAmount: 0, freeDelivery: false,
        };
    }

    return {
        source: winner.source,
        couponId: winner.source === "coupon" ? winner.id : null,
        offerId: winner.source === "offer" ? winner.id : null,
        campaignId: winner.campaignId,
        code: winner.code,
        name: winner.name,
        discountType: winner.discountType,
        discountValue: winner.discountValue,
        discountAmount: winner.discountAmount,
        freeDelivery: winner.freeDelivery,
    };
}
