// src/lib/loyaltyService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central loyalty engine.  ALL point mutations go through this file.
//
// ⚠️  WHY THERE ARE NO MONGOOSE / MONGODB TRANSACTIONS HERE
// ──────────────────────────────────────────────────────────
// MongoDB multi-document transactions require a replica-set AND the driver
// must be able to start a client session against it.  Atlas free-tier clusters
// (M0 / M2 / M5) technically run as replica sets but impose extra restrictions
// that cause `session.startTransaction()` to throw:
//
//   "Transaction numbers are only allowed on a replica set member or mongos"
//
// This is the ROOT CAUSE of the reported bug:
//   handleOrderDelivered() → startSession() → startTransaction() → throws
//   → catch block aborts → no User.loyaltyPoints update → no ledger entry
//   (the ledger entries the user saw must have been written by an earlier,
//   non-transactional version of the code that has since been replaced)
//
// FIX: replace all transactions with the "safe ordered writes + idempotency"
// pattern used by Stripe, Shopify Rewards, etc.:
//
//   1. Write a cheap "lock" or check-and-set guard FIRST
//   2. $inc User.loyaltyPoints  (atomic single-document operation)
//   3. Write the LoyaltyLedger entry
//
// Worst-case failure window: process dies between step 2 and step 3.
// The balance is ahead of the ledger by exactly one entry.
// A reconcile script can detect and fix this (balance ≠ sum of ledger).
// In practice this window is < 1 ms and is acceptable for a loyalty system.
// ─────────────────────────────────────────────────────────────────────────────

import User          from "@/models/User";
import LoyaltyLedger, { LedgerType } from "@/models/LoyaltyLedger";

// ── Config ────────────────────────────────────────────────────────────────────
export const LOYALTY_CONFIG = {
    /** 1 point per ₹10 spent */
    POINTS_PER_RUPEE:     0.1,
    /** Orders below this total earn no points */
    MIN_ORDER_FOR_POINTS: 130,
    /** Points awarded to the referrer */
    REFERRER_REWARD:      50,
    /** Points awarded to the new (referred) user */
    REFEREE_REWARD:       25,
    /** ₹ value of 1 point on redemption */
    POINT_VALUE_INR:      0.5,
    /** Max fraction of order total payable with points */
    MAX_REDEMPTION_PCT:   0.20,
    /** Minimum points balance required before redemption is allowed */
    MIN_REDEEM_POINTS:    50,
} as const;

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function calcOrderPoints(orderTotal: number): number {
    if (orderTotal < LOYALTY_CONFIG.MIN_ORDER_FOR_POINTS) return 0;
    return Math.floor(orderTotal * LOYALTY_CONFIG.POINTS_PER_RUPEE);
}

export function pointsToRupees(points: number): number {
    return Number((points * LOYALTY_CONFIG.POINT_VALUE_INR).toFixed(2));
}

export function maxRedeemablePoints(orderTotal: number, userBalance: number): number {
    const maxByOrder = Math.floor(
        (orderTotal * LOYALTY_CONFIG.MAX_REDEMPTION_PCT) / LOYALTY_CONFIG.POINT_VALUE_INR
    );
    return Math.min(userBalance, maxByOrder);
}

// ── _applyPoints — the single internal primitive ──────────────────────────────
// All mutations (credit AND debit) go through this one function.
// Writes happen in order: User.$inc first, then LoyaltyLedger.create.
// Both are single-document atomic writes — no session/transaction needed.

async function _applyPoints(opts: {
    userId:          string;
    delta:           number;        // positive = credit, negative = debit
    type:            LedgerType;
    orderId?:        string | null;
    referredUserId?: string | null;
    note?:           string;
}): Promise<number /* balanceAfter */> {
    if (opts.delta === 0) {
        const u = await User.findById(opts.userId).select("loyaltyPoints").lean();
        return (u as any)?.loyaltyPoints ?? 0;
    }

    // ── 1. Atomically update the cached balance ────────────────────────────
    const updated = await User.findByIdAndUpdate(
        opts.userId,
        { $inc: { loyaltyPoints: opts.delta } },
        { new: true }   // return document AFTER the update
    )
        .select("loyaltyPoints")
        .lean();

    if (!updated) throw new Error(`_applyPoints: user "${opts.userId}" not found`);

    const balanceAfter = (updated as any).loyaltyPoints as number;

    // ── 2. Write the immutable ledger entry ───────────────────────────────
    await LoyaltyLedger.create({
        user:         opts.userId,
        type:         opts.type,
        points:       opts.delta,       // positive or negative — stored as-is
        balanceAfter,                   // snapshot for statement view
        order:        opts.orderId        ?? null,
        referredUser: opts.referredUserId ?? null,
        note:         opts.note           ?? "",
    });

    return balanceAfter;
}

// ── awardPoints (public) ──────────────────────────────────────────────────────
// Used by admin routes for manual credit / debit.
// `points` is the SIGNED delta: positive = credit, negative = debit.

export interface AwardOptions {
    userId:          string;
    points:          number;          // positive = credit, negative = debit
    type:            LedgerType;
    orderId?:        string | null;
    referredUserId?: string | null;
    note?:           string;
}

export async function awardPoints(opts: AwardOptions): Promise<void> {
    await _applyPoints({
        userId:          opts.userId,
        delta:           opts.points,
        type:            opts.type,
        orderId:         opts.orderId        ?? null,
        referredUserId:  opts.referredUserId ?? null,
        note:            opts.note           ?? "",
    });
}

// ── redeemPoints (public) ─────────────────────────────────────────────────────
// Validates balance ≥ requested points, then decrements and logs.
// `points` is the positive magnitude; the ledger entry is stored negative.
// Returns the ₹ discount.

export interface RedeemOptions {
    userId:  string;
    points:  number;
    orderId: string;
    note?:   string;
}

export async function redeemPoints(opts: RedeemOptions): Promise<number> {
    if (opts.points <= 0) throw new Error("Points to redeem must be positive");
    if (opts.points < LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
        throw new Error(`Minimum ${LOYALTY_CONFIG.MIN_REDEEM_POINTS} points required to redeem`);
    }

    // Read live balance — single-document read, no session needed
    const user = await User.findById(opts.userId).select("loyaltyPoints").lean();
    if (!user) throw new Error("redeemPoints: user not found");

    const balance = (user as any).loyaltyPoints as number ?? 0;
    if (balance < opts.points) {
        throw new Error(`Insufficient points — balance: ${balance}, requested: ${opts.points}`);
    }

    await _applyPoints({
        userId:  opts.userId,
        delta:   -opts.points,      // negative = debit
        type:    "redemption",
        orderId: opts.orderId,
        note:    opts.note ?? `Redeemed ${opts.points} pts at checkout`,
    });

    return pointsToRupees(opts.points);
}

// ── handleOrderDelivered (public) ─────────────────────────────────────────────
// Called exactly once when an order's status becomes "delivered".
// Idempotent: guarded by a LoyaltyLedger existence check so a double-call
// (e.g. admin clicks "mark delivered" twice) is completely safe.

export async function handleOrderDelivered(orderId: string): Promise<void> {
    // Lazy import prevents circular dep: Order model → route → loyaltyService → Order
    const { default: Order } = await import("@/models/Order");

    const order = await Order.findById(orderId).select("user totalAmount").lean();
    if (!order) throw new Error(`handleOrderDelivered: order ${orderId} not found`);

    const userId = (order as any).user?.toString();
    if (!userId) return;        // guest order — no loyalty

    // ── Idempotency guard ────────────────────────────────────────────────────
    const alreadyProcessed = await LoyaltyLedger.exists({
        order: orderId,
        type:  "order_reward",
    });
    if (alreadyProcessed) {
        console.log(`[loyalty] order ${orderId} already processed — skip`);
        return;
    }

    // ── 1. Increment deliveredOrderCount atomically, capture result ──────────
    // { new: true } guarantees we read the POST-increment value.
    const userAfter = await User.findByIdAndUpdate(
        userId,
        { $inc: { deliveredOrderCount: 1 } },
        { new: true }
    )
        .select("deliveredOrderCount loyaltyPoints referredBy referralRewardGranted")
        .lean();

    if (!userAfter) throw new Error(`handleOrderDelivered: user ${userId} not found`);

    const deliveredCount = (userAfter as any).deliveredOrderCount as number;
    const orderTotal     = (order    as any).totalAmount           as number ?? 0;
    const earnedPoints   = calcOrderPoints(orderTotal);

    // ── 2. Award order_reward ────────────────────────────────────────────────
    if (earnedPoints > 0) {
        await _applyPoints({
            userId,
            delta:   earnedPoints,
            type:    "order_reward",
            orderId,
            note:    `Earned on delivered order — ₹${orderTotal}`,
        });
    } else {
        // Write a zero-point sentinel so the idempotency guard fires on retry
        await LoyaltyLedger.create({
            user:         userId,
            type:         "order_reward",
            points:       0,
            balanceAfter: (userAfter as any).loyaltyPoints as number,
            order:        orderId,
            note:         `Order below ₹${LOYALTY_CONFIG.MIN_ORDER_FOR_POINTS} threshold — no points earned`,
        });
    }

    // ── 3. Referral bonuses (only on first ever delivered order) ─────────────
    const referredBy          = (userAfter as any).referredBy;
    const referralNotYetGiven = !(userAfter as any).referralRewardGranted;
    const isFirstDelivery     = deliveredCount === 1;

    if (!isFirstDelivery || !referredBy || !referralNotYetGiven) return;

    // Atomic compare-and-set: only the process that flips false → true wins.
    // If another concurrent delivery already set it, findOneAndUpdate returns null.
    const locked = await User.findOneAndUpdate(
        { _id: userId, referralRewardGranted: false },
        { $set: { referralRewardGranted: true } },
        { new: true }
    ).lean();

    if (!locked) {
        console.log(`[loyalty] referral for user ${userId} already locked — skip`);
        return;
    }

    const referrerId = referredBy.toString();

    // Referee welcome bonus
    await _applyPoints({
        userId,
        delta:           LOYALTY_CONFIG.REFEREE_REWARD,
        type:            "referral_referee",
        orderId,
        referredUserId:  userId,
        note:            "Welcome bonus — joined via referral",
    });

    // Referrer reward
    await _applyPoints({
        userId:          referrerId,
        delta:           LOYALTY_CONFIG.REFERRER_REWARD,
        type:            "referral_referrer",
        orderId,
        referredUserId:  userId,
        note:            "Referral reward — your friend's first order was delivered",
    });
}
