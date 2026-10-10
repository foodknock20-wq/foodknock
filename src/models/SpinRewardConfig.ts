// src/models/SpinRewardConfig.ts
//
// Phase 12 — admin-editable catalog for the Digital 8-slot Spin & Win
// (THE WEBSITE/APP FEATURE at /loyalty — completely unrelated to the
// physical 6-slot Diwali wheel, which has no software representation at
// all; see OfflineDistribution.ts). Reward amounts are never hardcoded in
// the spin API — they're read from this collection every time, so an
// admin can retune values/weights without a deploy.

import { Schema, model, models } from "mongoose";

export type SpinRewardType = "DISCOUNT_FIXED" | "DISCOUNT_PERCENTAGE" | "FREE_DELIVERY" | "LOYALTY_POINTS";

const SpinRewardConfigSchema = new Schema(
    {
        slotIndex: { type: Number, required: true, min: 0 },
        label:     { type: String, required: true, trim: true, maxlength: 60 },

        rewardType: {
            type: String,
            enum: ["DISCOUNT_FIXED", "DISCOUNT_PERCENTAGE", "FREE_DELIVERY", "LOYALTY_POINTS"],
            required: true,
        },

        // DISCOUNT_FIXED: rupees. DISCOUNT_PERCENTAGE: 0-100. FREE_DELIVERY:
        // unused (0). LOYALTY_POINTS: point count.
        value: { type: Number, required: true, min: 0 },

        // Only meaningful for DISCOUNT_PERCENTAGE-issued coupons.
        maximumDiscount:   { type: Number, default: null, min: 0 },
        minimumOrderValue: { type: Number, default: 0, min: 0 },

        // Relative weight for weighted-random selection — NOT a percentage,
        // just a share of the total (see src/lib/spin.ts). Higher = more
        // common. A ₹200 OFF slot should carry a much lower weight than a
        // ₹25 OFF slot.
        weight: { type: Number, required: true, min: 1 },

        // Validity window for the coupon issued when this slot is won.
        expiryDays: { type: Number, default: 7, min: 1 },

        active: { type: Boolean, default: true },

        // Spin & Eat — true for exactly the one reward gated by the
        // customer's ₹100 qualifying-spend band (src/lib/spin.ts's
        // buildEligiblePool). Additive; existing documents simply read as
        // false via this schema default until the migration in
        // getSpinCatalog() reconciles them.
        specialBandGated: { type: Boolean, default: false },
    },
    { timestamps: true }
);

SpinRewardConfigSchema.index({ active: 1, slotIndex: 1 });

const SpinRewardConfig = models.SpinRewardConfig || model("SpinRewardConfig", SpinRewardConfigSchema);

export default SpinRewardConfig;
