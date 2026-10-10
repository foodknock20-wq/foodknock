// src/models/OfflineDistribution.ts
//
// Phase 12 — a SIMPLE manual log for the physical Diwali wheel (6 real
// slots, in-shop, no login, no loyalty points — see Phase 12 spec §29/§61).
// This is explicitly NOT a virtual version of that wheel and NOT a Shop
// entity — `locationLabel` is free text because no Shop model exists in
// this codebase yet, and building one just for a tally log would be
// over-engineering a single-admin-user feature. distributedCount/
// redeemedCount are manually entered running totals, not derived from any
// real-time coupon-scan integration (the business explicitly doesn't want
// shop identity encoded into coupon codes — see Coupon.ts's `source` tag,
// which stays "manual"/"campaign_offer" for any coupon connected to this).

import { Schema, model, models } from "mongoose";

const OfflineDistributionSchema = new Schema(
    {
        campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", default: null },

        locationLabel: { type: String, required: true, trim: true, maxlength: 120 },
        date:          { type: Date, required: true },

        distributedCount: { type: Number, default: 0, min: 0 },
        redeemedCount:    { type: Number, default: 0, min: 0 },

        notes: { type: String, default: "", trim: true, maxlength: 500 },
    },
    { timestamps: true }
);

OfflineDistributionSchema.index({ campaignId: 1, date: -1 });

const OfflineDistribution = models.OfflineDistribution || model("OfflineDistribution", OfflineDistributionSchema);

export default OfflineDistribution;
