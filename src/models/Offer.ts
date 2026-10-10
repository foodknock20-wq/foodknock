// src/models/Offer.ts
//
// Phase 12 — an AUTOMATIC promotion: no code, no customer action, applied
// by the server when a cart is eligible. This is deliberately NOT the
// coupon engine — Phase 11's Coupon stays the only code-based discount
// asset. An Offer may optionally be tagged with a campaignId for
// grouping/analytics, exactly like Coupon's new campaignId/offerId tags.
//
// Discount math is shared with coupons via calculateCouponDiscount()
// (src/lib/coupons.ts) — same FIXED/PERCENTAGE/FREE_DELIVERY semantics,
// one formula, not a second financial engine.
//
// STACKING RULE (confirmed decision, documented once here): at most one
// discount source applies per order. If the customer has a coupon code
// applied, automatic Offers are not evaluated at all. If no coupon is
// present, the single best-eligible active Offer is applied automatically.
// See src/lib/offers.ts / createOrderCore.ts for the enforcement point.
//
// No per-user usage limit in this pass (see Offer.ts header decision) —
// storewide "10% off this weekend" offers are commonly intended to be
// reusable per customer, unlike single-use coupons. Only a global
// usageLimit (optional) is enforced, atomically, mirroring Coupon.usedCount.

import { Schema, model, models } from "mongoose";

export type OfferDiscountType = "FIXED" | "PERCENTAGE" | "FREE_DELIVERY";
export type OfferStatus = "ACTIVE" | "PAUSED";
// Phase 12 completion — server-enforced eligibility, never trusted from the
// client (see src/lib/offers.ts's isAudienceEligible()). MIN_LOYALTY_POINTS
// uses `audienceMinValue` as the threshold; VIP reuses the exact same
// lifetime-spend threshold already used by /admin/users (not a second
// definition).
export type OfferAudience =
    | "EVERYONE"
    | "REGISTERED_USERS"
    | "FIRST_ORDER"
    | "REPEAT_CUSTOMERS"
    | "VIP"
    | "MIN_LOYALTY_POINTS";

const OfferSchema = new Schema(
    {
        campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", default: null },

        name:        { type: String, required: true, trim: true, maxlength: 120 },
        description: { type: String, default: "", trim: true, maxlength: 300 },

        discountType:  { type: String, enum: ["FIXED", "PERCENTAGE", "FREE_DELIVERY"], required: true },
        discountValue: { type: Number, required: true, min: 0 },

        minimumOrderValue: { type: Number, default: 0, min: 0 },
        maximumDiscount:   { type: Number, default: null, min: 0 },

        // null = unlimited. No per-user limit by design — see header.
        usageLimit: { type: Number, default: null, min: 1 },
        usedCount:  { type: Number, default: 0, min: 0 },

        startAt: { type: Date, default: null },
        endAt:   { type: Date, default: null },

        status: { type: String, enum: ["ACTIVE", "PAUSED"], default: "ACTIVE" },

        // Phase 12 completion — additive. Defaults to EVERYONE so existing
        // offers created before this field keep their exact prior behavior.
        audience: {
            type: String,
            enum: ["EVERYONE", "REGISTERED_USERS", "FIRST_ORDER", "REPEAT_CUSTOMERS", "VIP", "MIN_LOYALTY_POINTS"],
            default: "EVERYONE",
        },
        audienceMinValue: { type: Number, default: 0, min: 0 },

        // Server picks the single highest-priority eligible Offer when more
        // than one is active at once — never ambiguous, never client-chosen.
        priority: { type: Number, default: 0 },
    },
    { timestamps: true }
);

OfferSchema.index({ status: 1, startAt: 1, endAt: 1 });
OfferSchema.index({ campaignId: 1 });

const Offer = models.Offer || model("Offer", OfferSchema);

export default Offer;
