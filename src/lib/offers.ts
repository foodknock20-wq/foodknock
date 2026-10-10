// src/lib/offers.ts
//
// Phase 12 — THE single authoritative place automatic-offer eligibility
// and the atomic usage reservation are decided. Mirrors src/lib/coupons.ts
// exactly: getBestAutomaticOffer() is read-only (safe to call repeatedly
// for preview), reserveOfferUsage()/releaseOfferUsage() are the only
// mutating functions and are called exclusively from createOrderCore,
// immediately before Order.create.
//
// STACKING RULE: callers are responsible for only calling this when no
// coupon code is present on the order (see createOrderCore.ts) — an Offer
// and a Coupon never both apply to the same order.

import Campaign from "@/models/Campaign";
import Offer, { type OfferDiscountType, type OfferAudience } from "@/models/Offer";
import User from "@/models/User";
import Order from "@/models/Order";
import { calculateCouponDiscount } from "@/lib/coupons";

// Same lifetime-spend threshold /admin/users already uses to label a
// customer "VIP" — one definition, reused, not reinvented (spec: "If there
// is already a VIP definition in FoodKnock, reuse it").
const VIP_SPEND_THRESHOLD = 2000;

/**
 * Server-side ONLY — never trust client audience/eligibility claims. Cheap
 * checks (EVERYONE/REGISTERED_USERS/MIN_LOYALTY_POINTS) are plain field
 * reads; FIRST_ORDER/REPEAT_CUSTOMERS/VIP need one extra query each, but
 * only run for the specific candidate offer(s) actually being evaluated
 * (at most a handful per checkout), never for a list/browse view.
 */
async function isAudienceEligible(
    audience: OfferAudience,
    audienceMinValue: number,
    linkedUserId: string | null
): Promise<boolean> {
    if (audience === "EVERYONE") return true;
    if (!linkedUserId) return false; // every other audience type requires a known customer

    switch (audience) {
        case "REGISTERED_USERS":
            return true; // linkedUserId already proves this

        case "FIRST_ORDER": {
            const user = await User.findOne({ _id: linkedUserId, deliveredOrderCount: 0 })
                .select("_id")
                .lean();
            return user !== null;
        }

        case "REPEAT_CUSTOMERS": {
            const user = await User.findOne({ _id: linkedUserId, deliveredOrderCount: { $gt: 0 } })
                .select("_id")
                .lean();
            return user !== null;
        }

        case "VIP": {
            const agg = await Order.aggregate([
                { $match: { user: linkedUserId, status: "delivered" } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]);
            return (agg[0]?.total ?? 0) >= VIP_SPEND_THRESHOLD;
        }

        case "MIN_LOYALTY_POINTS": {
            const user = await User.findById(linkedUserId).select("loyaltyPoints").lean<{ loyaltyPoints?: number } | null>();
            return Number(user?.loyaltyPoints ?? 0) >= audienceMinValue;
        }

        default:
            return false;
    }
}

export type OfferResult = {
    offerId: string;
    campaignId: string | null;
    name: string;
    discountType: OfferDiscountType;
    discountValue: number;
    discountAmount: number;
    freeDelivery: boolean;
} | null;

type OfferLean = {
    _id: unknown;
    campaignId: unknown | null;
    name: string;
    discountType: OfferDiscountType;
    discountValue: number;
    minimumOrderValue: number;
    maximumDiscount: number | null;
    usageLimit: number | null;
    usedCount: number;
    startAt: Date | null;
    endAt: Date | null;
    priority: number;
    audience: OfferAudience;
    audienceMinValue: number;
};

/**
 * Read-only. Returns the single highest-priority Offer the given subtotal
 * (AND customer, for audience-restricted offers) is eligible for right
 * now, or null. Does NOT reserve usage — safe to call for checkout
 * preview as many times as needed.
 */
export async function getBestAutomaticOffer(params: { subtotal: number; linkedUserId?: string | null }): Promise<OfferResult> {
    const now = new Date();
    const linkedUserId = params.linkedUserId ?? null;

    // Bounded — there will never be hundreds of simultaneously active
    // offers; still capped defensively.
    const candidates = await Offer.find({
        status: "ACTIVE",
        $and: [
            { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
            { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
        ],
        minimumOrderValue: { $lte: params.subtotal },
    })
        .sort({ priority: -1 })
        .limit(50)
        .lean<OfferLean[]>();

    for (const offer of candidates) {
        if (offer.usageLimit != null && offer.usedCount >= offer.usageLimit) continue;

        // If this offer is tied to a campaign, the campaign itself must
        // currently be live (not paused/ended) — an Offer is never
        // customer-facing independent of its campaign's own lifecycle.
        if (offer.campaignId) {
            const campaign = await Campaign.findById(offer.campaignId)
                .select("status startAt endAt")
                .lean<{ status: string; startAt: Date | null; endAt: Date | null } | null>();
            if (!campaign || campaign.status !== "active") continue;
            if (campaign.startAt && campaign.startAt.getTime() > now.getTime()) continue;
            if (campaign.endAt && campaign.endAt.getTime() < now.getTime()) continue;
        }

        const eligible = await isAudienceEligible(offer.audience ?? "EVERYONE", offer.audienceMinValue ?? 0, linkedUserId);
        if (!eligible) continue;

        const discountAmount = calculateCouponDiscount(
            params.subtotal,
            offer.discountType,
            offer.discountValue,
            offer.maximumDiscount
        );

        return {
            offerId: String(offer._id),
            campaignId: offer.campaignId ? String(offer.campaignId) : null,
            name: offer.name,
            discountType: offer.discountType,
            discountValue: offer.discountValue,
            discountAmount,
            freeDelivery: offer.discountType === "FREE_DELIVERY",
        };
    }

    return null;
}

/** Atomic — mirrors Coupon's reserveCouponUsage exactly. Called once, immediately before Order.create. */
export async function reserveOfferUsage(offerId: string): Promise<void> {
    const reserved = await Offer.findOneAndUpdate(
        {
            _id: offerId,
            status: "ACTIVE",
            $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
    );

    if (!reserved) {
        throw Object.assign(new Error("This offer is no longer available."), { status: 400 });
    }
}

/** Compensating rollback — order creation failed after reserveOfferUsage succeeded. */
export async function releaseOfferUsage(offerId: string): Promise<void> {
    await Offer.updateOne({ _id: offerId }, { $inc: { usedCount: -1 } }).catch((err) =>
        console.error("OFFER_USAGE_RELEASE_FAILED", { offerId, error: err })
    );
}
