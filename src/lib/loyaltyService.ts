// src/lib/loyaltyService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central loyalty engine. ALL point mutations go through this file.
//
// ⚠️  WHY THERE ARE NO MONGOOSE / MONGODB TRANSACTIONS HERE
// ──────────────────────────────────────────────────────────
// MongoDB multi-document transactions require a replica-set AND the driver
// must be able to start a client session against it. Atlas free-tier clusters
// (M0 / M2 / M5) technically run as replica sets but impose extra restrictions
// that cause `session.startTransaction()` to throw.
//
// FIX: replace all transactions with the "safe ordered writes + idempotency"
// pattern:
//   1. $inc User.loyaltyPoints  (atomic single-document operation)
//   2. Write the LoyaltyLedger entry
// ─────────────────────────────────────────────────────────────────────────────

import User          from "@/models/User";
import LoyaltyLedger, { LedgerType } from "@/models/LoyaltyLedger";

// ── Config ────────────────────────────────────────────────────────────────────
export const LOYALTY_CONFIG = {
    /** 1 point per ₹10 spent */
    POINTS_PER_RUPEE:     0.1,
    /** Orders below this total earn no points */
    MIN_ORDER_FOR_POINTS: 189,
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
// `orderMongoId` must be a MongoDB ObjectId string (from order._id.toString())
// NOT the short display orderId like "FK-XXXX".

async function _applyPoints(opts: {
    userId:          string;
    delta:           number;        // positive = credit, negative = debit
    type:            LedgerType;
    orderMongoId?:   string | null; // ← MongoDB _id, NOT short orderId string
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
        { new: true }
    )
        .select("loyaltyPoints")
        .lean();

    if (!updated) throw new Error(`_applyPoints: user "${opts.userId}" not found`);

    const balanceAfter = (updated as any).loyaltyPoints as number;

    // ── 2. Write the immutable ledger entry ───────────────────────────────
    await LoyaltyLedger.create({
        user:         opts.userId,
        type:         opts.type,
        points:       opts.delta,
        balanceAfter,
        order:        opts.orderMongoId   ?? null,  // ObjectId or null
        referredUser: opts.referredUserId ?? null,
        note:         opts.note           ?? "",
    });

    return balanceAfter;
}

// ── awardPoints (public) ──────────────────────────────────────────────────────
// Used by admin routes for manual credit / debit.

export interface AwardOptions {
    userId:          string;
    points:          number;          // positive = credit, negative = debit
    type:            LedgerType;
    orderMongoId?:   string | null;   // MongoDB _id of the order, NOT short id
    referredUserId?: string | null;
    note?:           string;
}

export async function awardPoints(opts: AwardOptions): Promise<void> {
    await _applyPoints({
        userId:          opts.userId,
        delta:           opts.points,
        type:            opts.type,
        orderMongoId:    opts.orderMongoId   ?? null,
        referredUserId:  opts.referredUserId ?? null,
        note:            opts.note           ?? "",
    });
}

// ── redeemPoints (public) ─────────────────────────────────────────────────────
// Validates balance ≥ requested points, then decrements and logs.
// `points` is the positive magnitude; the ledger entry is stored negative.
// Returns the ₹ discount.
//
// IMPORTANT: `orderMongoId` must be the MongoDB ObjectId string (order._id)
// NOT the short display orderId like "FK-XXXX". Passing the wrong id causes
// the ledger entry to silently store null for the order reference, which
// breaks the idempotency guard and the transaction history display.

export interface RedeemOptions {
    userId:        string;
    points:        number;
    orderMongoId:  string;  // order._id.toString() — MongoDB ObjectId string
    note?:         string;
}

export async function redeemPoints(opts: RedeemOptions): Promise<number> {
    if (opts.points <= 0) throw new Error("Points to redeem must be positive");
    if (opts.points < LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
        throw new Error(`Minimum ${LOYALTY_CONFIG.MIN_REDEEM_POINTS} points required to redeem`);
    }

    const user = await User.findById(opts.userId).select("loyaltyPoints").lean();
    if (!user) throw new Error("redeemPoints: user not found");

    const balance = (user as any).loyaltyPoints as number ?? 0;
    if (balance < opts.points) {
        throw new Error(`Insufficient points — balance: ${balance}, requested: ${opts.points}`);
    }

    // Idempotency: don't double-deduct for same order
    const alreadyRedeemed = await LoyaltyLedger.exists({
        user:  opts.userId,
        order: opts.orderMongoId,
        type:  "redemption",
    });
    if (alreadyRedeemed) {
        console.log(`[loyalty] redemption for order ${opts.orderMongoId} already exists — skip`);
        return pointsToRupees(opts.points);
    }

    await _applyPoints({
        userId:       opts.userId,
        delta:        -opts.points,
        type:         "redemption",
        orderMongoId: opts.orderMongoId,
        note:         opts.note ?? `Redeemed ${opts.points} pts at checkout`,
    });

    return pointsToRupees(opts.points);
}

// ── handleOrderDelivered (public) ─────────────────────────────────────────────
// Called exactly once when an order's status becomes "delivered".
// Idempotent: guarded by a LoyaltyLedger existence check.

export async function handleOrderDelivered(orderId: string): Promise<void> {
    const { default: Order } = await import("@/models/Order");

    const order = await Order.findById(orderId).select("user totalAmount").lean();
    if (!order) throw new Error(`handleOrderDelivered: order ${orderId} not found`);

    const userId = (order as any).user?.toString();
    if (!userId) return; // guest order — no loyalty

    // Idempotency guard
    const alreadyProcessed = await LoyaltyLedger.exists({
        order: orderId,
        type:  "order_reward",
    });
    if (alreadyProcessed) {
        console.log(`[loyalty] order ${orderId} already processed — skip`);
        return;
    }

    // Increment deliveredOrderCount atomically
    const userAfter = await User.findByIdAndUpdate(
        userId,
        { $inc: { deliveredOrderCount: 1 } },
        { new: true }
    )
        .select("deliveredOrderCount loyaltyPoints referredBy referralRewardGranted")
        .lean();

    if (!userAfter) throw new Error(`handleOrderDelivered: user ${userId} not found`);

    const deliveredCount = (userAfter as any).deliveredOrderCount as number;
    const orderTotal     = (order as any).totalAmount as number ?? 0;
    const earnedPoints   = calcOrderPoints(orderTotal);

    // Award order_reward
    if (earnedPoints > 0) {
        await _applyPoints({
            userId,
            delta:        earnedPoints,
            type:         "order_reward",
            orderMongoId: orderId,   // orderId here IS the MongoDB _id (passed from admin route)
            note:         `Earned on delivered order — ₹${orderTotal}`,
        });
    } else {
        await LoyaltyLedger.create({
            user:         userId,
            type:         "order_reward",
            points:       0,
            balanceAfter: (userAfter as any).loyaltyPoints as number,
            order:        orderId,
            note:         `Order below ₹${LOYALTY_CONFIG.MIN_ORDER_FOR_POINTS} threshold — no points earned`,
        });
    }

    // Referral bonuses (only on first ever delivered order)
    const referredBy          = (userAfter as any).referredBy;
    const referralNotYetGiven = !(userAfter as any).referralRewardGranted;
    const isFirstDelivery     = deliveredCount === 1;

    if (!isFirstDelivery || !referredBy || !referralNotYetGiven) return;

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

    await _applyPoints({
        userId,
        delta:           LOYALTY_CONFIG.REFEREE_REWARD,
        type:            "referral_referee",
        orderMongoId:    orderId,
        referredUserId:  userId,
        note:            "Welcome bonus — joined via referral",
    });

    await _applyPoints({
        userId:          referrerId,
        delta:           LOYALTY_CONFIG.REFERRER_REWARD,
        type:            "referral_referrer",
        orderMongoId:    orderId,
        referredUserId:  userId,
        note:            "Referral reward — your friend's first order was delivered",
    });
}
