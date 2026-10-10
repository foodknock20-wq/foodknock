// src/models/Coupon.ts
//
// Phase 11 — Universal Coupon Engine. A coupon is a standalone financial
// instrument, not owned by any campaign/shop/festival (see Phase 11 spec
// §4/§39/§40) — Phase 12's Campaign/Spin/Physical-distribution systems are
// expected to ALLOCATE existing coupons, never to encode themselves into
// this schema. Keep this model lean; do not add speculative fields.
//
// `status` is admin-controlled (ACTIVE/PAUSED) ONLY. Expiry/exhaustion are
// NEVER stored — they're derived at validation time from `expiresAt`/
// `startsAt`/`usedCount` vs. server clock, so an admin never needs a cron
// job just to keep a coupon's displayed status honest (spec §7).

import { Schema, model, models } from "mongoose";

// Phase 12: FREE_DELIVERY added — structurally different from FIXED/
// PERCENTAGE (those discount the product subtotal; this zeroes the
// delivery fee instead — see createOrderCore.ts's coupon block). Added
// here rather than inventing a second discount engine for Spin's "Free
// Delivery" reward slot.
export type CouponDiscountType = "FIXED" | "PERCENTAGE" | "FREE_DELIVERY";
export type CouponStatus = "ACTIVE" | "PAUSED";
// Phase 12: where this coupon came from — purely for admin analytics/
// traceability. NEVER read by validateCoupon()/createOrderCore — a spin-
// issued coupon is validated and redeemed through the exact same Phase 11
// path as a manually-typed one.
export type CouponSource = "manual" | "spin_reward" | "campaign_offer" | "physical";
// Phase 12 completion — ONLY meaningful when source==="physical". The
// other lifecycle states the spec asks for (REDEEMED/EXPIRED/VOID) are
// deliberately NOT stored here — they're already derivable from fields
// this model already has: REDEEMED = usedCount>=usageLimit, EXPIRED =
// expiresAt<now, VOID = status==="PAUSED" (same admin pause action every
// other coupon already uses). Storing a second redundant status for those
// would risk drifting from the real source of truth. GENERATED/
// DISTRIBUTED is the one piece of state nothing else already tracks (did
// this physical coupon leave the warehouse, so to speak).
export type PhysicalCouponStatus = "GENERATED" | "DISTRIBUTED";

const CouponSchema = new Schema(
    {
        code: {
            type:      String,
            required:  true,
            unique:    true,
            uppercase: true,
            trim:      true,
            index:     true,
        },

        discountType: {
            type:     String,
            enum:     ["FIXED", "PERCENTAGE", "FREE_DELIVERY"],
            required: true,
        },

        // FIXED: rupees. PERCENTAGE: 0-100.
        discountValue: { type: Number, required: true, min: 0 },

        minimumOrderValue: { type: Number, default: 0, min: 0 },

        // Only meaningful for PERCENTAGE (caps the rupee discount). Null = uncapped.
        maximumDiscount: { type: Number, default: null, min: 0 },

        // null = unlimited global redemptions.
        usageLimit: { type: Number, default: null, min: 1 },
        usedCount:  { type: Number, default: 0, min: 0 },

        // Phase 11: hard-restricted to 1 — see src/lib/coupons.ts header for
        // why >1 isn't safely enforceable without Mongo transactions on this
        // deployment. Field kept (not hardcoded to a literal) so a future
        // phase can lift this once a real need + a transactional-safe design
        // exists, without a schema migration.
        perUserLimit: { type: Number, default: 1, min: 1, max: 1 },

        startsAt:  { type: Date, default: null }, // null = active immediately
        expiresAt: { type: Date, default: null }, // null = never expires

        status: {
            type:    String,
            enum:    ["ACTIVE", "PAUSED"],
            default: "ACTIVE",
        },

        description: { type: String, default: "", trim: true, maxlength: 200 },

        // ── Phase 12: provenance tagging (additive, analytics-only) ───────
        source:     { type: String, enum: ["manual", "spin_reward", "campaign_offer", "physical"], default: "manual" },
        campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", default: null },
        offerId:    { type: Schema.Types.ObjectId, ref: "Offer",    default: null },

        // Physical Diwali pool only (source==="physical"). Null for every
        // other coupon. A free-text reward-tier label ("Reward A", "₹50
        // OFF tier") so the admin pool view can group/filter without a
        // separate reward-config collection — the actual financial terms
        // live in discountType/discountValue/maximumDiscount above, same
        // as any other coupon.
        physicalStatus: { type: String, enum: ["GENERATED", "DISTRIBUTED", null], default: null },
        physicalRewardLabel: { type: String, default: null, trim: true, maxlength: 60 },
    },
    { timestamps: true }
);

CouponSchema.index({ status: 1, expiresAt: 1 });
CouponSchema.index({ createdAt: -1 });
// Physical pool admin queries filter by source+campaign and often also by
// distribution state — this composite index supports both the "all
// physical coupons for campaign X" and "GENERATED ones for campaign X"
// query shapes without a collection scan.
CouponSchema.index({ source: 1, campaignId: 1, physicalStatus: 1 });

const Coupon = models.Coupon || model("Coupon", CouponSchema);

export default Coupon;
