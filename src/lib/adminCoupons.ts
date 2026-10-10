// src/lib/adminCoupons.ts
//
// Phase 11 — admin-only coupon CRUD + bulk generation. Deliberately
// separate from src/lib/coupons.ts: that file is the customer-facing
// validation/redemption engine (security/financial critical, called on
// every checkout); this file is admin tooling (create/list/bulk-generate/
// pause). Mixing them would make the validation engine harder to audit.
//
// Every write here explicitly allowlists fields — never spreads a raw
// request body into a Mongoose document (Phase 11 spec §29: no mass
// assignment).

import mongoose from "mongoose";
import Coupon, { type CouponDiscountType, type CouponStatus } from "@/models/Coupon";
import { generateCouponCode, normalizeCouponCode } from "@/lib/couponCode";

const MAX_BULK_QUANTITY = 5000;
const BULK_INSERT_BATCH_SIZE = 500;
const MAX_CODE_GENERATION_RETRIES = 5;

export interface CouponInput {
    discountType: CouponDiscountType;
    discountValue: number;
    minimumOrderValue?: number;
    maximumDiscount?: number | null;
    usageLimit?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    description?: string;
    /** Omit to auto-generate a secure random code. */
    code?: string;
}

function assertValidDiscount(discountType: CouponDiscountType, discountValue: number): void {
    if (discountType !== "FIXED" && discountType !== "PERCENTAGE" && discountType !== "FREE_DELIVERY") {
        throw new Error("discountType must be FIXED, PERCENTAGE, or FREE_DELIVERY");
    }
    // FREE_DELIVERY doesn't use discountValue financially — skip the
    // positive-number requirement so callers can pass 0.
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

/** Explicit allowlist — this is the only place a client payload becomes a Coupon document. */
function sanitizeCouponInput(input: CouponInput) {
    assertValidDiscount(input.discountType, Number(input.discountValue));

    const minimumOrderValue = Math.max(0, Number(input.minimumOrderValue ?? 0));
    const maximumDiscount =
        input.maximumDiscount != null && Number.isFinite(Number(input.maximumDiscount))
            ? Math.max(0, Number(input.maximumDiscount))
            : null;
    const usageLimit =
        input.usageLimit != null && Number.isFinite(Number(input.usageLimit)) && Number(input.usageLimit) > 0
            ? Math.floor(Number(input.usageLimit))
            : null;

    const startsAt = parseOptionalDate(input.startsAt, "Start date");
    const expiresAt = parseOptionalDate(input.expiresAt, "Expiry date");
    if (startsAt && expiresAt && expiresAt <= startsAt) {
        throw new Error("Expiry date must be after the start date");
    }

    return {
        discountType: input.discountType,
        discountValue: Number(input.discountValue),
        minimumOrderValue,
        maximumDiscount,
        usageLimit,
        startsAt,
        expiresAt,
        description: String(input.description ?? "").trim().slice(0, 200),
    };
}

async function generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_GENERATION_RETRIES; attempt++) {
        const code = generateCouponCode();
        const exists = await Coupon.exists({ code });
        if (!exists) return code;
    }
    throw new Error("Could not generate a unique coupon code — please retry");
}

export async function createCoupon(input: CouponInput) {
    const sanitized = sanitizeCouponInput(input);

    let code: string;
    if (input.code) {
        code = normalizeCouponCode(input.code);
        if (!/^[A-Z0-9]{4,20}$/.test(code)) {
            throw new Error("Coupon code must be 4-20 letters/numbers");
        }
        if (await Coupon.exists({ code })) {
            throw new Error("This coupon code already exists");
        }
    } else {
        code = await generateUniqueCode();
    }

    const doc = await Coupon.create({ ...sanitized, code, perUserLimit: 1, status: "ACTIVE" });
    return doc.toObject();
}

export interface BulkGenerateInput {
    quantity: number;
    discountType: CouponDiscountType;
    discountValue: number;
    minimumOrderValue?: number;
    maximumDiscount?: number | null;
    usageLimit?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    description?: string;
}

/**
 * Generates `quantity` distinct single-use (usageLimit:1 each) coupons with
 * secure random codes. Each generated coupon is independent — bulk
 * generation is a convenience for creating many standalone coupons, NOT a
 * single shared-pool coupon (that's a Phase 12 campaign concept this
 * engine deliberately doesn't build — see spec §4/§38).
 *
 * Bounded + batched: a 1000-coupon request is never one giant insertMany
 * — it's chunked so a single serverless invocation never holds an
 * unbounded array in memory or sends an oversized write.
 */
export async function bulkGenerateCoupons(input: BulkGenerateInput): Promise<{ count: number; codes: string[] }> {
    const quantity = Math.floor(Number(input.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) throw new Error("Quantity must be at least 1");
    if (quantity > MAX_BULK_QUANTITY) throw new Error(`Quantity cannot exceed ${MAX_BULK_QUANTITY} per batch`);

    const sanitized = sanitizeCouponInput(input);

    // Generate all codes up front, de-duplicated in-memory (collisions
    // within a 32^9-space batch of a few thousand are astronomically
    // unlikely, but checked anyway — cheap insurance).
    const codes = new Set<string>();
    while (codes.size < quantity) {
        codes.add(generateCouponCode());
    }
    const codeList = [...codes];

    const allCodes: string[] = [];
    for (let i = 0; i < codeList.length; i += BULK_INSERT_BATCH_SIZE) {
        const batch = codeList.slice(i, i + BULK_INSERT_BATCH_SIZE).map((code) => ({
            ...sanitized,
            code,
            usageLimit: 1, // each generated coupon is single-use by design
            perUserLimit: 1,
            status: "ACTIVE" as CouponStatus,
        }));

        try {
            const inserted = await Coupon.insertMany(batch, { ordered: false });
            allCodes.push(...inserted.map((d) => d.code));
        } catch (err) {
            // ordered:false means a rare cross-batch code collision (against
            // an already-existing DB coupon) only drops that one document —
            // every other document in the batch still inserts. Surface a
            // count mismatch rather than silently losing coupons.
            const insertedDocs = (err as { insertedDocs?: Array<{ code: string }> })?.insertedDocs;
            if (insertedDocs) {
                allCodes.push(...insertedDocs.map((d) => d.code));
            }
            console.error("BULK_COUPON_INSERT_PARTIAL_FAILURE", { batchStart: i, error: err instanceof Error ? err.message : err });
        }
    }

    return { count: allCodes.length, codes: allCodes };
}

export interface ListCouponsParams {
    status?: CouponStatus;
    search?: string;
    page?: number;
    limit?: number;
}

const MAX_LIST_LIMIT = 100;

export async function listCoupons(params: ListCouponsParams) {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(Number(params.limit ?? 25))));
    const page = Math.max(1, Math.floor(Number(params.page ?? 1)));

    const filter: Record<string, unknown> = {};
    if (params.status) filter.status = params.status;
    if (params.search) {
        const normalized = normalizeCouponCode(params.search);
        filter.code = { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` };
    }

    const [coupons, total] = await Promise.all([
        Coupon.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Coupon.countDocuments(filter),
    ]);

    return { coupons, total, page, limit };
}

export interface CouponUpdateInput {
    status?: CouponStatus;
    discountValue?: number;
    minimumOrderValue?: number;
    maximumDiscount?: number | null;
    usageLimit?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    description?: string;
}

/** Explicit allowlist — same discipline as sanitizeCouponInput; discountType/code/usedCount are never editable after creation. */
export async function updateCoupon(id: string, input: CouponUpdateInput) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid coupon id");

    const update: Record<string, unknown> = {};

    if (input.status !== undefined) {
        if (input.status !== "ACTIVE" && input.status !== "PAUSED") throw new Error("Invalid status");
        update.status = input.status;
    }
    if (input.discountValue !== undefined) {
        if (!Number.isFinite(Number(input.discountValue)) || Number(input.discountValue) <= 0) {
            throw new Error("discountValue must be a positive number");
        }
        update.discountValue = Number(input.discountValue);
    }
    if (input.minimumOrderValue !== undefined) update.minimumOrderValue = Math.max(0, Number(input.minimumOrderValue));
    if (input.maximumDiscount !== undefined) {
        update.maximumDiscount = input.maximumDiscount == null ? null : Math.max(0, Number(input.maximumDiscount));
    }
    if (input.usageLimit !== undefined) {
        update.usageLimit = input.usageLimit == null ? null : Math.max(1, Math.floor(Number(input.usageLimit)));
    }
    if (input.startsAt !== undefined) update.startsAt = parseOptionalDate(input.startsAt, "Start date");
    if (input.expiresAt !== undefined) update.expiresAt = parseOptionalDate(input.expiresAt, "Expiry date");
    if (input.description !== undefined) update.description = String(input.description).trim().slice(0, 200);

    const updated = await Coupon.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!updated) throw new Error("Coupon not found");
    return updated;
}
