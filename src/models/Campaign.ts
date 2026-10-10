// src/models/Campaign.ts
//
// Phase 12 — the umbrella marketing concept. A Campaign has no financial
// logic of its own (see Offer.ts) — it's a name/schedule/visibility
// container that Offers and the Digital Spin can optionally reference for
// analytics/grouping. Deliberately generic — no Diwali-specific fields,
// so "Diwali Dhamaka" and a future "Anniversary Sale" are both just rows
// in this same collection (Phase 12 spec §2/§38/§40).
//
// `status` is admin-controlled (draft/scheduled/active/paused/ended/
// archived) but — same discipline as Coupon.ts — every caller that gates
// customer-facing behavior on "is this campaign actually live" must check
// isCampaignLive() (src/lib/campaigns.ts) against startAt/endAt and the
// server clock, never trust the stored status alone for timing.

import { Schema, model, models } from "mongoose";

export type CampaignType =
    | "festival"
    | "flash_sale"
    | "weekend"
    | "anniversary"
    | "customer_appreciation"
    | "loyalty"
    | "product_promotion"
    | "category_promotion"
    | "free_delivery"
    | "offline"
    | "custom";

export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "ended" | "archived";

const CampaignSchema = new Schema(
    {
        name:             { type: String, required: true, trim: true, maxlength: 120 },
        slug:             { type: String, required: true, unique: true, trim: true, lowercase: true },
        title:            { type: String, default: "", trim: true, maxlength: 120 },
        shortDescription: { type: String, default: "", trim: true, maxlength: 200 },
        description:      { type: String, default: "", trim: true, maxlength: 2000 },

        campaignType: {
            type: String,
            enum: [
                "festival", "flash_sale", "weekend", "anniversary",
                "customer_appreciation", "loyalty", "product_promotion",
                "category_promotion", "free_delivery", "offline", "custom",
            ],
            default: "custom",
        },

        status: {
            type:    String,
            enum:    ["draft", "scheduled", "active", "paused", "ended", "archived"],
            default: "draft",
        },

        startAt: { type: Date, default: null },
        endAt:   { type: Date, default: null },

        priority: { type: Number, default: 0 },

        heroImage: { type: String, default: "" },

        // Phase 12 pass 1: minimal visibility surface — homepage/loyalty-page
        // toggles only. Follow-up pass adds the dedicated /campaigns/[slug]
        // page + full homepage hero system this will plug into.
        visibility: {
            homepage:   { type: Boolean, default: false },
            loyaltyPage: { type: Boolean, default: false },
        },

        terms: { type: String, default: "", trim: true, maxlength: 2000 },
    },
    { timestamps: true }
);

CampaignSchema.index({ status: 1, startAt: 1, endAt: 1 });
CampaignSchema.index({ createdAt: -1 });

const Campaign = models.Campaign || model("Campaign", CampaignSchema);

export default Campaign;
