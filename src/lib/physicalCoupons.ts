// src/lib/physicalCoupons.ts
//
// Phase 12 completion — the Physical Diwali coupon pool. The physical
// 6-slot wheel itself stays completely offline (no software wheel exists
// anywhere in this codebase) — this file is ONLY the admin backend for
// generating and tracking the reward coupons that wheel hands out.
//
// Deliberately NOT a second coupon engine: every generated row is a real
// Phase 11 Coupon document (source:"physical"), validated and redeemed
// through the EXACT SAME src/lib/coupons.ts path (validateCoupon /
// reserveCouponUsage) as a manually-created or Spin-issued coupon — typing
// a physical coupon's code into checkout's CouponBox just works, with the
// same atomic per-user-redemption guarantee already proven in Phase 11.
//
// Code generation reuses generateCouponCode() from src/lib/couponCode.ts
// (the same CSPRNG alphabet/length as every other coupon in this system)
// — not a second generator.

import Coupon, { type CouponDiscountType } from "@/models/Coupon";
import { generateCouponCode } from "@/lib/couponCode";

const MAX_BATCH_QUANTITY = 10_000;
const INSERT_BATCH_SIZE = 500;

export interface PhysicalRewardTier {
    label: string; // e.g. "Reward A — ₹25 OFF" — admin-defined, not invented here
    discountType: CouponDiscountType;
    discountValue: number;
    maximumDiscount?: number | null;
    minimumOrderValue?: number;
    quantity: number;
}

export interface GeneratePhysicalPoolInput {
    campaignId: string;
    expiresInDays: number;
    rewardTiers: PhysicalRewardTier[];
}

function assertValidTier(tier: PhysicalRewardTier, index: number): void {
    if (!tier.label || !tier.label.trim()) throw new Error(`Reward tier ${index + 1}: label is required`);
    if (!["FIXED", "PERCENTAGE", "FREE_DELIVERY"].includes(tier.discountType)) {
        throw new Error(`Reward tier ${index + 1}: invalid discountType`);
    }
    if (tier.discountType !== "FREE_DELIVERY" && (!Number.isFinite(tier.discountValue) || tier.discountValue <= 0)) {
        throw new Error(`Reward tier ${index + 1}: discountValue must be a positive number`);
    }
    if (!Number.isFinite(tier.quantity) || tier.quantity < 1) {
        throw new Error(`Reward tier ${index + 1}: quantity must be at least 1`);
    }
}

/**
 * Generates the physical coupon pool across however many reward tiers the
 * admin defines (the actual six physical-wheel rewards — never invented
 * here). Bounded at 10,000 total per call; batched inserts (500/batch,
 * ordered:false) so one request never holds an unbounded array in memory
 * or risks a single giant write. A rare code collision only drops that
 * one document — every other document in its batch still inserts; the
 * returned count always reflects what actually landed in the DB.
 */
export async function generatePhysicalCouponPool(
    input: GeneratePhysicalPoolInput
): Promise<{ totalGenerated: number; perTier: Array<{ label: string; generated: number }> }> {
    if (!input.campaignId) throw new Error("campaignId is required");
    if (!Array.isArray(input.rewardTiers) || input.rewardTiers.length === 0) {
        throw new Error("At least one reward tier is required");
    }

    const totalQuantity = input.rewardTiers.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
    if (totalQuantity > MAX_BATCH_QUANTITY) {
        throw new Error(`Total quantity across all reward tiers cannot exceed ${MAX_BATCH_QUANTITY} per generation`);
    }
    input.rewardTiers.forEach(assertValidTier);

    const expiresInDays = Math.max(1, Math.floor(Number(input.expiresInDays || 30)));
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const perTier: Array<{ label: string; generated: number }> = [];
    let totalGenerated = 0;

    for (const tier of input.rewardTiers) {
        const quantity = Math.floor(tier.quantity);

        // Generate unique codes for this tier up front, de-duplicated
        // in-memory (astronomically unlikely to collide at these volumes
        // with a 32^9 keyspace, checked anyway).
        const codes = new Set<string>();
        while (codes.size < quantity) codes.add(generateCouponCode());
        const codeList = [...codes];

        let tierGenerated = 0;
        for (let i = 0; i < codeList.length; i += INSERT_BATCH_SIZE) {
            const batch = codeList.slice(i, i + INSERT_BATCH_SIZE).map((code) => ({
                code,
                discountType: tier.discountType,
                discountValue: tier.discountType === "FREE_DELIVERY" ? 0 : Number(tier.discountValue),
                minimumOrderValue: Math.max(0, Number(tier.minimumOrderValue ?? 0)),
                maximumDiscount: tier.maximumDiscount != null ? Math.max(0, Number(tier.maximumDiscount)) : null,
                usageLimit: 1,
                perUserLimit: 1,
                status: "ACTIVE" as const,
                expiresAt,
                source: "physical" as const,
                campaignId: input.campaignId,
                physicalStatus: "GENERATED" as const,
                physicalRewardLabel: tier.label.trim().slice(0, 60),
                description: `Physical Diwali reward — ${tier.label.trim()}`,
            }));

            try {
                const inserted = await Coupon.insertMany(batch, { ordered: false });
                tierGenerated += inserted.length;
            } catch (err) {
                const insertedDocs = (err as { insertedDocs?: unknown[] })?.insertedDocs;
                if (insertedDocs) tierGenerated += insertedDocs.length;
                console.error("PHYSICAL_COUPON_BATCH_INSERT_PARTIAL_FAILURE", {
                    tier: tier.label, batchStart: i, error: err instanceof Error ? err.message : err,
                });
            }
        }

        perTier.push({ label: tier.label, generated: tierGenerated });
        totalGenerated += tierGenerated;
    }

    return { totalGenerated, perTier };
}

export interface ListPhysicalCouponsParams {
    campaignId?: string;
    physicalStatus?: "GENERATED" | "DISTRIBUTED";
    rewardLabel?: string;
    search?: string;
    page?: number;
    limit?: number;
}

const MAX_LIST_LIMIT = 200;

export async function listPhysicalCoupons(params: ListPhysicalCouponsParams) {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(Number(params.limit ?? 50))));
    const page = Math.max(1, Math.floor(Number(params.page ?? 1)));

    const filter: Record<string, unknown> = { source: "physical" };
    if (params.campaignId) filter.campaignId = params.campaignId;
    if (params.physicalStatus) filter.physicalStatus = params.physicalStatus;
    if (params.rewardLabel) filter.physicalRewardLabel = params.rewardLabel;
    if (params.search) {
        const normalized = String(params.search).trim().toUpperCase();
        filter.code = { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` };
    }

    const [coupons, total] = await Promise.all([
        Coupon.find(filter)
            .select("code discountType discountValue minimumOrderValue usedCount usageLimit status physicalStatus physicalRewardLabel campaignId expiresAt createdAt")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Coupon.countDocuments(filter),
    ]);

    return { coupons, total, page, limit };
}

export interface PhysicalPoolSummary {
    generated: number;
    distributed: number;
    redeemed: number;
    remaining: number; // generated, not yet distributed
    byReward: Array<{ label: string; generated: number; distributed: number; redeemed: number }>;
}

/** Real aggregated counts only — never fabricated/placeholder metrics. */
export async function getPhysicalPoolSummary(campaignId?: string): Promise<PhysicalPoolSummary> {
    const match: Record<string, unknown> = { source: "physical" };
    if (campaignId) match.campaignId = campaignId;

    const rows = await Coupon.aggregate([
        { $match: match },
        {
            $group: {
                _id: "$physicalRewardLabel",
                generated: { $sum: 1 },
                distributed: { $sum: { $cond: [{ $eq: ["$physicalStatus", "DISTRIBUTED"] }, 1, 0] } },
                redeemed: { $sum: { $cond: [{ $gte: ["$usedCount", "$usageLimit"] }, 1, 0] } },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const byReward = rows.map((r) => ({
        label: r._id ?? "(unlabeled)",
        generated: r.generated,
        distributed: r.distributed,
        redeemed: r.redeemed,
    }));

    const generated = byReward.reduce((s, r) => s + r.generated, 0);
    const distributed = byReward.reduce((s, r) => s + r.distributed, 0);
    const redeemed = byReward.reduce((s, r) => s + r.redeemed, 0);

    return { generated, distributed, redeemed, remaining: generated - distributed, byReward };
}

/**
 * Marks up to `quantity` currently-GENERATED coupons (oldest first) as
 * DISTRIBUTED. This is a quantity-based bulk action, not a per-code admin
 * workflow — matches the "quantity distributed" framing the offline
 * distribution log already uses, not a certificate/scan system.
 */
export async function markPhysicalCouponsDistributed(params: {
    campaignId: string;
    rewardLabel?: string;
    quantity: number;
}): Promise<{ updated: number }> {
    const quantity = Math.max(1, Math.floor(Number(params.quantity)));
    const filter: Record<string, unknown> = {
        source: "physical",
        campaignId: params.campaignId,
        physicalStatus: "GENERATED",
    };
    if (params.rewardLabel) filter.physicalRewardLabel = params.rewardLabel;

    const ids = await Coupon.find(filter).select("_id").sort({ createdAt: 1 }).limit(quantity).lean();
    if (ids.length === 0) return { updated: 0 };

    const result = await Coupon.updateMany(
        { _id: { $in: ids.map((d) => d._id) } },
        { $set: { physicalStatus: "DISTRIBUTED" } }
    );
    return { updated: result.modifiedCount ?? 0 };
}

/** CSV export — operational fields only, no user PII (there is none on an unredeemed physical coupon anyway). */
export function couponsToCsv(coupons: Array<{ code: string; physicalRewardLabel?: string | null; status: string; physicalStatus?: string | null; expiresAt?: Date | string | null }>): string {
    const header = "code,reward,status,distribution_status,expires_at";
    const rows = coupons.map((c) =>
        [c.code, c.physicalRewardLabel ?? "", c.status, c.physicalStatus ?? "", c.expiresAt ? new Date(c.expiresAt).toISOString() : ""]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
    );
    return [header, ...rows].join("\n");
}
