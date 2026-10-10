// src/lib/spin.ts
//
// Phase 12 — THE authoritative Digital Spin & Win transaction. This is the
// WEBSITE/APP feature at /loyalty: 8 visual slots, 50 loyalty points per
// spin, registered users only. Completely independent of the physical
// 6-slot Diwali wheel (see OfflineDistribution.ts) — this file has no
// concept of shops/locations/offline distribution at all.
//
// ── TRANSACTION SHAPE (mirrors createOrderCore's stock/coupon rollback
// discipline — same pattern, different resource) ────────────────────────
//   1. debitPointsAtomic() — the ONLY gate. Fails closed: insufficient
//      balance throws before anything else happens.
//   2. Weighted reward selection — pure, in-memory, crypto.randomInt-based
//      (never Math.random() for an outcome with real financial value).
//   3. Issue the reward (branches by type):
//        DISCOUNT_FIXED / DISCOUNT_PERCENTAGE / FREE_DELIVERY → a real
//          Phase 11 Coupon via issueSystemCoupon() — redeemable through the
//          exact same checkout path as any other coupon, not a parallel
//          reward-redemption system.
//        LOYALTY_POINTS → creditPointsAtomic() back onto the same balance.
//   4. Persist the immutable SpinRecord.
//   5. If step 3 throws, refund step 1's debit (creditPointsAtomic with
//      type "spin_refund") before rethrowing — the invariant from Phase 12
//      spec §60: a customer never loses points without either a reward or
//      a compensating reversal. If step 4 throws, the reward from step 3
//      is NOT refunded — it was already granted for real; only the
//      history row is missing (logged as a critical gap, never silently
//      dropped — see the finalization-pass fix in performSpin()).
//
// IDEMPOTENCY: an optional client-supplied idempotencyKey lets a dropped-
// response retry return the ORIGINAL result instead of spinning again —
// see the lookup at the top of performSpin().

import { randomInt } from "crypto";
import mongoose from "mongoose";
import SpinRewardConfig, { type SpinRewardType } from "@/models/SpinRewardConfig";
import SpinRecord from "@/models/SpinRecord";
import Coupon from "@/models/Coupon";
import User from "@/models/User";
import Order from "@/models/Order";
import { debitPointsAtomic, creditPointsAtomic } from "@/lib/loyaltyService";
import { issueSystemCoupon } from "@/lib/coupons";

export const SPIN_COST_POINTS = 50;

type RewardConfigLean = {
    _id: unknown;
    slotIndex: number;
    label: string;
    rewardType: SpinRewardType;
    value: number;
    maximumDiscount: number | null;
    minimumOrderValue: number;
    weight: number;
    expiryDays: number;
    active: boolean;
    // Spin & Eat — true for exactly the one reward gated by the customer's
    // ₹100 qualifying-spend band (see buildEligiblePool below). Additive,
    // defaults to false for every pre-existing config/document.
    specialBandGated: boolean;
};

// "Spin & Eat" reward pool (replaces the old "Spin & Win" pool — Free
// Delivery retired, ₹20 OFF added as a normal common reward). Seeded once,
// admin-editable thereafter via the existing SpinRewardConfig catalog —
// see getSpinCatalog()'s reconciliation step below for how an ALREADY-
// seeded production catalog (count > 0) still picks up this new pool.
//
// Weight ranking (relative shares, not percentages — see pickWeightedReward).
// Updated per product request: ₹100 OFF and ₹150 OFF moved down into the
// "very rare" tier alongside ₹75 OFF (all three now weight 2); ₹50 OFF is
// the sole "rare" tier (weight 8); ₹200 OFF's gated weight reduced to 1.
//   ₹25 OFF (30)       — highest / very common
//   ₹20 OFF (25)       — common (replaces Free Delivery)
//   +50 Points (20)    — common / normal
//   ₹50 OFF (8)        — rare
//   ₹75 OFF (2)        — very rare
//   ₹100 OFF (2)       — very rare
//   ₹150 OFF (2)       — very rare
//   ₹200 OFF (1, GATED) — special: excluded entirely unless the customer's
//     current ₹100 qualifying-spend band hasn't already granted it (see
//     buildEligiblePool). Lowest weight of all — rare-but-real, never a
//     near-zero "technically possible" token chance, just the smallest
//     real share among the eligible pool.
const DEFAULT_REWARDS: Array<Omit<RewardConfigLean, "_id">> = [
    { slotIndex: 0, label: "₹20 OFF",    rewardType: "DISCOUNT_FIXED", value: 20,  maximumDiscount: null, minimumOrderValue: 0,   weight: 25, expiryDays: 7, active: true, specialBandGated: false },
    { slotIndex: 1, label: "₹25 OFF",    rewardType: "DISCOUNT_FIXED", value: 25,  maximumDiscount: null, minimumOrderValue: 0,   weight: 30, expiryDays: 7, active: true, specialBandGated: false },
    { slotIndex: 2, label: "+50 Points", rewardType: "LOYALTY_POINTS", value: 50,  maximumDiscount: null, minimumOrderValue: 0,   weight: 20, expiryDays: 7, active: true, specialBandGated: false },
    { slotIndex: 3, label: "₹50 OFF",    rewardType: "DISCOUNT_FIXED", value: 50,  maximumDiscount: null, minimumOrderValue: 199, weight: 8,  expiryDays: 7, active: true, specialBandGated: false },
    { slotIndex: 4, label: "₹75 OFF",    rewardType: "DISCOUNT_FIXED", value: 75,  maximumDiscount: null, minimumOrderValue: 249, weight: 2,  expiryDays: 7, active: true, specialBandGated: false },
    { slotIndex: 5, label: "₹100 OFF",   rewardType: "DISCOUNT_FIXED", value: 100, maximumDiscount: null, minimumOrderValue: 349, weight: 2,  expiryDays: 7, active: true, specialBandGated: false },
    { slotIndex: 6, label: "₹150 OFF",   rewardType: "DISCOUNT_FIXED", value: 150, maximumDiscount: null, minimumOrderValue: 499, weight: 2,  expiryDays: 7, active: true, specialBandGated: false },
    { slotIndex: 7, label: "₹200 OFF",   rewardType: "DISCOUNT_FIXED", value: 200, maximumDiscount: null, minimumOrderValue: 599, weight: 1,  expiryDays: 7, active: true, specialBandGated: true  },
];

export async function getSpinCatalog(): Promise<RewardConfigLean[]> {
    const count = await SpinRewardConfig.countDocuments({});
    if (count === 0) {
        await SpinRewardConfig.insertMany(DEFAULT_REWARDS);
        return SpinRewardConfig.find({}).sort({ slotIndex: 1 }).lean<RewardConfigLean[]>();
    }

    const existing = await SpinRewardConfig.find({}).sort({ slotIndex: 1 }).lean<RewardConfigLean[]>();

    // Self-healing reconciliation — same pattern as the loyalty-ledger
    // self-heal used elsewhere in this codebase, generalized beyond a
    // one-time FREE_DELIVERY migration: ANY future edit to DEFAULT_REWARDS
    // (a weight re-tune, a label change, a new gated reward, ...) is
    // detected by comparing the live catalog against it per slot, and only
    // the slots that actually drifted are upserted. Steady state (no
    // pending change) costs zero extra writes — just this one in-memory
    // comparison against the catalog read that already happened above.
    const bySlot = new Map(existing.map((c) => [c.slotIndex, c]));
    const drifted = DEFAULT_REWARDS.filter((r) => {
        const current = bySlot.get(r.slotIndex);
        if (!current) return true;
        return (
            current.label !== r.label ||
            current.rewardType !== r.rewardType ||
            current.value !== r.value ||
            current.weight !== r.weight ||
            current.minimumOrderValue !== r.minimumOrderValue ||
            Boolean(current.specialBandGated) !== r.specialBandGated
        );
    });

    if (drifted.length === 0) return existing;

    await Promise.all(
        drifted.map((r) =>
            SpinRewardConfig.findOneAndUpdate({ slotIndex: r.slotIndex }, { $set: r }, { upsert: true })
        )
    );
    return SpinRewardConfig.find({}).sort({ slotIndex: 1 }).lean<RewardConfigLean[]>();
}

// ── ₹200 OFF special band eligibility ──────────────────────────────────
//
// Rule (product requirement): the ₹200 OFF reward is NOT a normal weighted
// reward — it only ever enters the eligible pool when the customer's REAL,
// server-computed cumulative qualifying spend has crossed into a ₹100 band
// (₹100–199 = band 1, ₹200–299 = band 2, ...) that hasn't already granted
// this reward. "Qualifying" mirrors the SAME definition the rest of the
// loyalty system already uses for a real order — delivered, not archived
// (see src/lib/productReviews.ts's findQualifyingOrder for the identical
// filter shape elsewhere in this codebase). Never the client-supplied cart,
// never a pending/cancelled order.
async function getQualifyingLifetimeSpend(userId: string): Promise<number> {
    const [agg] = await Order.aggregate<{ total: number }>([
        { $match: { user: new mongoose.Types.ObjectId(userId), status: "delivered", archivedAt: null } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    return agg?.total ?? 0;
}

/** null = below the first ₹100 band (spend < ₹100) — special reward never eligible yet. */
function getCurrentSpendBand(spend: number): number | null {
    if (spend < 100) return null;
    return Math.floor(spend / 100);
}

async function hasConsumedSpecialBand(userId: string, band: number): Promise<boolean> {
    const existing = await SpinRecord.exists({ user: userId, specialBand: band });
    return !!existing;
}

/**
 * ELIGIBILITY FIRST, PROBABILITY SECOND (never the reverse — a reward that
 * isn't eligible must be completely absent from the pool handed to
 * pickWeightedReward, not given a token near-zero weight). Read-only; runs
 * BEFORE the points debit below so a failure here never requires a refund.
 * Returns the eligible configs plus the band (if any) so performSpin can
 * tag a SpinRecord with the band it was actually granted under, when the
 * special reward is the one selected.
 */
async function buildEligiblePool(
    userId: string,
    configs: RewardConfigLean[]
): Promise<{ eligible: RewardConfigLean[]; band: number | null }> {
    const hasSpecialReward = configs.some((c) => c.specialBandGated);
    if (!hasSpecialReward) return { eligible: configs, band: null };

    const spend = await getQualifyingLifetimeSpend(userId);
    const band = getCurrentSpendBand(spend);

    if (band === null) {
        return { eligible: configs.filter((c) => !c.specialBandGated), band: null };
    }

    const consumed = await hasConsumedSpecialBand(userId, band);
    if (consumed) {
        return { eligible: configs.filter((c) => !c.specialBandGated), band };
    }

    return { eligible: configs, band };
}

function pickWeightedReward(configs: RewardConfigLean[]): RewardConfigLean {
    const totalWeight = configs.reduce((sum, c) => sum + c.weight, 0);
    // crypto.randomInt — CSPRNG, not Math.random(). The outcome has real
    // financial value (a coupon or loyalty points), so it must not be
    // predictable/influenceable from the client side in any way.
    const roll = randomInt(0, totalWeight);
    let cumulative = 0;
    for (const config of configs) {
        cumulative += config.weight;
        if (roll < cumulative) return config;
    }
    return configs[configs.length - 1];
}

export type SpinResult = {
    rewardLabel: string;
    rewardType: SpinRewardType;
    rewardValue: number;
    slotIndex: number;
    couponCode: string | null;
    pointsAwarded: number;
    newBalance: number;
};

export async function performSpin(userId: string, idempotencyKey?: string | null): Promise<SpinResult> {
    // ── Idempotency (Phase 12 finalization) ────────────────────────────────
    // A client that loses network mid-request and retries with the SAME
    // key must get back the ORIGINAL result, never a second spin. Checked
    // BEFORE the debit — this is the only place a duplicate debit could
    // otherwise originate from. A spin that failed and was refunded never
    // created a SpinRecord (see below), so retrying with the same key after
    // a genuine failure correctly falls through to a fresh attempt.
    if (idempotencyKey) {
        const existing = await SpinRecord.findOne({ user: userId, idempotencyKey }).lean<{
            rewardLabel: string; rewardType: string; rewardValue: number;
            pointsAwarded: number; couponId: unknown | null;
        } | null>();
        if (existing) {
            const coupon = existing.couponId
                ? await Coupon.findById(existing.couponId).select("code").lean<{ code: string } | null>()
                : null;
            const userDoc = await User.findById(userId).select("loyaltyPoints").lean<{ loyaltyPoints?: number } | null>();
            return {
                rewardLabel: existing.rewardLabel,
                rewardType: existing.rewardType as SpinRewardType,
                rewardValue: existing.rewardValue,
                slotIndex: -1, // retried response — client already animated the original result
                couponCode: coupon?.code ?? null,
                pointsAwarded: existing.pointsAwarded,
                newBalance: Number(userDoc?.loyaltyPoints ?? 0),
            };
        }
    }

    const configs = (await getSpinCatalog()).filter((c) => c.active);
    if (configs.length === 0) {
        throw Object.assign(new Error("Spin & Eat is temporarily unavailable."), { status: 503 });
    }

    // ── Eligibility FIRST, probability SECOND (Spin & Eat ₹200 OFF rule) ──
    // Read-only, runs BEFORE the points debit — if this throws, nothing has
    // been debited yet, so no refund path is needed. The ₹200 OFF reward is
    // either fully present in `eligible` or fully absent — never a reduced-
    // but-nonzero chance when ineligible.
    const { eligible, band } = await buildEligiblePool(userId, configs);

    // Step 1 — the only gate. Throws "Not enough loyalty points" (400) if
    // the atomic conditional $gte fails, regardless of what an earlier
    // balance read might have shown.
    const { balanceAfter: balanceAfterDebit } = await debitPointsAtomic({
        userId,
        points: SPIN_COST_POINTS,
        type: "spin_cost",
        note: `Spin & Eat — ${SPIN_COST_POINTS} pts`,
    });

    const reward = pickWeightedReward(eligible);
    // Only tagged on the SpinRecord when the special reward is the one
    // actually granted — this exact value is what hasConsumedSpecialBand()
    // checks against on a future spin to block a second ₹200 OFF for the
    // same ₹100 band.
    const grantedSpecialBand = reward.specialBandGated ? band : null;

    // ── Step 2 — issue the reward. ONLY this step's failure triggers a
    // refund — once a coupon is minted or points are credited, the reward
    // is REAL, and refunding here would double-dip the user (one of the
    // exact bugs this finalization pass was asked to rule out).
    let couponId: string | null = null;
    let couponCode: string | null = null;
    let pointsAwarded = 0;
    let newBalance = balanceAfterDebit;

    try {
        if (reward.rewardType === "LOYALTY_POINTS") {
            const credited = await creditPointsAtomic({
                userId,
                points: reward.value,
                type: "spin_reward_points",
                note: `Spin & Eat reward — ${reward.label}`,
            });
            pointsAwarded = reward.value;
            newBalance = credited.balanceAfter;
        } else {
            const discountType =
                reward.rewardType === "DISCOUNT_PERCENTAGE" ? "PERCENTAGE" :
                reward.rewardType === "FREE_DELIVERY" ? "FREE_DELIVERY" : "FIXED";

            const issued = await issueSystemCoupon({
                discountType,
                discountValue: reward.value,
                minimumOrderValue: reward.minimumOrderValue,
                maximumDiscount: reward.maximumDiscount,
                expiresInDays: reward.expiryDays,
                source: "spin_reward",
                description: `Spin & Eat — ${reward.label}`,
            });
            couponId = issued.couponId;
            couponCode = issued.code;
        }
    } catch (err) {
        // No silent loss (spec Part D) — refund the exact cost debited in
        // step 1. Safe here: nothing was issued yet, so there is nothing to
        // double-grant.
        await creditPointsAtomic({
            userId,
            points: SPIN_COST_POINTS,
            type: "spin_refund",
            note: "Spin reward issuance failed — points refunded",
        }).catch((refundErr) =>
            console.error("SPIN_REFUND_FAILED — MANUAL INTERVENTION NEEDED", { userId, error: refundErr })
        );
        console.error("SPIN_REWARD_ISSUANCE_FAILED", { userId, error: err });
        throw Object.assign(new Error("Something went wrong — your points were refunded. Please try again."), { status: 500 });
    }

    // ── Step 3 — persist the record. The reward is ALREADY real at this
    // point (committed above) — a failure here must NEVER trigger a
    // refund (spec Part D: "do not silently ignore it" ≠ "undo the
    // reward"). Logged as a critical, admin-auditable gap: the user keeps
    // their reward, just without a history row / idempotency replay for
    // this specific spin.
    try {
        await SpinRecord.create({
            user: userId,
            pointsCost: SPIN_COST_POINTS,
            rewardConfigId: reward._id,
            rewardLabel: reward.label,
            rewardType: reward.rewardType,
            rewardValue: reward.value,
            couponId,
            pointsAwarded,
            idempotencyKey: idempotencyKey ?? null,
            specialBand: grantedSpecialBand,
        });
    } catch (err) {
        console.error("SPIN_RECORD_PERSIST_FAILED — reward already granted, history row missing — MANUAL REVIEW", {
            userId, rewardLabel: reward.label, couponId, pointsAwarded, error: err,
        });
    }

    return {
        rewardLabel: reward.label,
        rewardType: reward.rewardType,
        rewardValue: reward.value,
        slotIndex: reward.slotIndex,
        couponCode,
        pointsAwarded,
        newBalance,
    };
}
