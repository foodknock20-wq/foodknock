// src/lib/adminOffers.ts
//
// Phase 12 — admin Offer CRUD (the automatic, no-code promotion — see
// Offer.ts). Same allowlisting/bounded-query discipline as adminCoupons.ts.

import mongoose from "mongoose";
import Offer, { type OfferDiscountType, type OfferStatus, type OfferAudience } from "@/models/Offer";

const VALID_AUDIENCES: OfferAudience[] = [
    "EVERYONE", "REGISTERED_USERS", "FIRST_ORDER", "REPEAT_CUSTOMERS", "VIP", "MIN_LOYALTY_POINTS",
];

const MAX_LIST_LIMIT = 100;

function assertValidDiscount(discountType: OfferDiscountType, discountValue: number): void {
    if (!["FIXED", "PERCENTAGE", "FREE_DELIVERY"].includes(discountType)) {
        throw new Error("discountType must be FIXED, PERCENTAGE, or FREE_DELIVERY");
    }
    if (discountType === "FREE_DELIVERY") return;
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new Error("discountValue must be a positive number");
    }
    if (discountType === "PERCENTAGE" && discountValue > 100) {
        throw new Error("Percentage discount cannot exceed 100");
    }
}

function parseOptionalDate(value: string | null | undefined, label: string): Date | null {
    if (value == null || value === "") return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`${label} is not a valid date`);
    return d;
}

export interface OfferInput {
    campaignId?: string | null;
    name: string;
    description?: string;
    discountType: OfferDiscountType;
    discountValue: number;
    minimumOrderValue?: number;
    maximumDiscount?: number | null;
    usageLimit?: number | null;
    startAt?: string | null;
    endAt?: string | null;
    priority?: number;
    audience?: OfferAudience;
    audienceMinValue?: number;
}

export async function createOffer(input: OfferInput) {
    const name = String(input.name ?? "").trim();
    if (!name) throw new Error("Offer name is required");
    assertValidDiscount(input.discountType, Number(input.discountValue));

    if (input.campaignId && !mongoose.Types.ObjectId.isValid(input.campaignId)) {
        throw new Error("Invalid campaignId");
    }

    const audience = input.audience && VALID_AUDIENCES.includes(input.audience) ? input.audience : "EVERYONE";

    const startAt = parseOptionalDate(input.startAt, "Start date");
    const endAt = parseOptionalDate(input.endAt, "End date");
    if (startAt && endAt && endAt <= startAt) throw new Error("End date must be after the start date");

    const doc = await Offer.create({
        campaignId: input.campaignId || null,
        name,
        description: String(input.description ?? "").trim().slice(0, 300),
        discountType: input.discountType,
        discountValue: Number(input.discountValue),
        minimumOrderValue: Math.max(0, Number(input.minimumOrderValue ?? 0)),
        maximumDiscount: input.maximumDiscount != null ? Math.max(0, Number(input.maximumDiscount)) : null,
        usageLimit: input.usageLimit != null ? Math.max(1, Math.floor(Number(input.usageLimit))) : null,
        startAt,
        endAt,
        priority: Number(input.priority ?? 0),
        audience,
        audienceMinValue: Math.max(0, Number(input.audienceMinValue ?? 0)),
        status: "ACTIVE",
    });

    return doc.toObject();
}

export interface OfferUpdateInput {
    status?: OfferStatus;
    discountValue?: number;
    minimumOrderValue?: number;
    maximumDiscount?: number | null;
    usageLimit?: number | null;
    startAt?: string | null;
    endAt?: string | null;
    priority?: number;
    audience?: OfferAudience;
    audienceMinValue?: number;
}

export async function updateOffer(id: string, input: OfferUpdateInput) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid offer id");

    const update: Record<string, unknown> = {};
    if (input.status !== undefined) {
        if (input.status !== "ACTIVE" && input.status !== "PAUSED") throw new Error("Invalid status");
        update.status = input.status;
    }
    if (input.discountValue !== undefined) update.discountValue = Number(input.discountValue);
    if (input.minimumOrderValue !== undefined) update.minimumOrderValue = Math.max(0, Number(input.minimumOrderValue));
    if (input.maximumDiscount !== undefined) {
        update.maximumDiscount = input.maximumDiscount == null ? null : Math.max(0, Number(input.maximumDiscount));
    }
    if (input.usageLimit !== undefined) {
        update.usageLimit = input.usageLimit == null ? null : Math.max(1, Math.floor(Number(input.usageLimit)));
    }
    if (input.startAt !== undefined) update.startAt = parseOptionalDate(input.startAt, "Start date");
    if (input.endAt !== undefined) update.endAt = parseOptionalDate(input.endAt, "End date");
    if (input.audience !== undefined) {
        if (!VALID_AUDIENCES.includes(input.audience)) throw new Error("Invalid audience");
        update.audience = input.audience;
    }
    if (input.audienceMinValue !== undefined) update.audienceMinValue = Math.max(0, Number(input.audienceMinValue));
    if (input.priority !== undefined) update.priority = Number(input.priority);

    const updated = await Offer.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!updated) throw new Error("Offer not found");
    return updated;
}

export interface ListOffersParams {
    campaignId?: string;
    status?: OfferStatus;
    page?: number;
    limit?: number;
}

export async function listOffers(params: ListOffersParams) {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(Number(params.limit ?? 25))));
    const page = Math.max(1, Math.floor(Number(params.page ?? 1)));

    const filter: Record<string, unknown> = {};
    if (params.status) filter.status = params.status;
    if (params.campaignId && mongoose.Types.ObjectId.isValid(params.campaignId)) filter.campaignId = params.campaignId;

    const [offers, total] = await Promise.all([
        Offer.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Offer.countDocuments(filter),
    ]);

    return { offers, total, page, limit };
}
