// src/lib/offersPublic.ts
//
// FoodKnock UI 2.0 — Phase 2: the single place public (customer-facing,
// non-personalized) offer *display* is decided — separate from
// src/lib/offers.ts's getBestAutomaticOffer(), which is a checkout-time,
// subtotal/eligibility-dependent evaluator and wrong for a public listing.
// Mirrors the exact time-window/priority predicate already used internally
// by src/lib/campaignPublic.ts's getPublicCampaignBySlug() for
// campaign-linked offers, generalized to all storewide offers (no
// campaignId filter) for the Home hero carousel. Read-only — no
// eligibility/discount-application logic lives here.

import Offer from "@/models/Offer";
import type { PublicOffer } from "@/lib/campaignPublic";

export async function getActivePublicOffers(limit = 5): Promise<PublicOffer[]> {
    const now = new Date();
    const offers = await Offer.find({
        status: "ACTIVE",
        $and: [
            { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
            { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
        ],
    })
        .sort({ priority: -1 })
        .limit(limit)
        .select("name description discountType discountValue minimumOrderValue maximumDiscount")
        .lean<Array<{ _id: unknown; name: string; description: string; discountType: "FIXED" | "PERCENTAGE" | "FREE_DELIVERY"; discountValue: number; minimumOrderValue: number; maximumDiscount: number | null }>>();

    return offers.map((o) => ({
        _id: String(o._id),
        name: o.name,
        description: o.description,
        discountType: o.discountType,
        discountValue: o.discountValue,
        minimumOrderValue: o.minimumOrderValue,
        maximumDiscount: o.maximumDiscount,
    }));
}
