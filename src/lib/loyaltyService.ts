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
//
// ── NOTIFICATION WIRING ──────────────────────────────────────────────────
// handleOrderDelivered() is the ONLY place order-reward and referral
// credits are ever granted — which makes it the single correct place to
// emit the corresponding notification events. "loyalty.points_credited"
// and "referral.reward_granted" already existed as declared event names
// in notifications/types.ts and were already listened to in
// notifications/engine.ts — this file previously never called
// notificationEngine.emit() for them at all. Emits below are
// fire-and-forget and error-isolated (mirrors the exact pattern
// createOrderCore.ts already uses for its own order.placed emit): a
// notification failure must never affect point crediting, which has
// already succeeded by the time each emit() call runs.
//
// ── PERF PASS (Orders/Loyalty audit) ─────────────────────────────────────
//   1. redeemPoints(): the balance read and the idempotency check used to
//      run as two independent reads before the Phase 17.1B rewrite below
//      replaced the whole pattern with a DB-enforced atomic claim — see
//      the Phase 17.1B note.
//   2. handleOrderDelivered(): the referee credit and referrer credit are
//      two writes to two entirely different user documents with two
//      independent ledger entries — there is no ordering dependency
//      between them. They now run concurrently via Promise.all instead of
//      sequentially, halving the wall-clock time of the referral tail
//      section. Each branch keeps its own error-isolated notification
//      exactly as before.
//
// ── PHASE 17.1B — ATOMIC BALANCE GUARD + DB-ENFORCED IDEMPOTENCY ──────────
// Root causes fixed (see Phase 17.1B delivery report for full detail):
//   1. redeemPoints() previously read the balance, THEN separately called
//      _applyPoints()'s unconditional $inc — a classic check-then-act race.
//      Two concurrent redemptions against the same balance could both pass
//      the read-time check and both decrement, overdrawing the account.
//      admin_debit (via awardPoints, below) had the identical shape.
//      FIX: _applyPoints() now guards every DEBIT with a conditional
//      findOneAndUpdate ({loyaltyPoints: {$gte: -delta}}) — the same
//      "guard the $inc with a condition" pattern debitPointsAtomic()
//      already used for Spin. Insufficient balance now fails the DB write
//      itself, not a prior JS-side read.
//   2. Idempotency for order-linked operations (earning, redemption,
//      reversal, referral) was previously "check LoyaltyLedger.exists()
//      THEN insert" at the CALLER level — itself a check-then-act race:
//      two concurrent calls for the same (user, order, type) could both
//      pass the exists() check before either inserted, producing two
//      ledger entries and double-counting the balance.
//      FIX: LoyaltyLedger now has a partial unique index on
//      {user, order, type} for order-linked types (see LoyaltyLedger.ts).
//      _applyPoints() claims that uniqueness FIRST (insert a placeholder
//      ledger entry) before touching the balance — mirroring the exact
//      claim-then-act pattern Phase 17.1A's PendingPayment/
//      claimPendingPayment already established in this codebase. A
//      duplicate-key error on the claim means another caller already
//      completed this exact operation — idempotent no-op, not an error.
//      If the subsequent balance update fails (insufficient funds / user
//      vanished), the claim entry is rolled back so the ledger never
//      records an operation that didn't actually happen.
//   3. Added findInconsistentLoyaltyRedemptions() (read-only diagnostic)
//      and retryFailedLoyaltyRedemption() (explicit, admin-triggered
//      repair) to recover from the specific failure mode identified in
//      Phase 17.0: createOrderCore.ts calls redeemPoints() AFTER
//      Order.create() succeeds; if that call fails, the order's
//      redeemedPoints/redeemedAmount snapshot no longer matches the
//      user's actual balance/ledger. See createOrderCore.ts and
//      Order.ts's new `loyaltyRedemptionFailure` field for the write side
//      of this; this file only ever reads for diagnosis and performs the
//      SAME atomic redeemPoints() call for repair — never a second,
//      parallel mutation path.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";
import User          from "@/models/User";
import Order          from "@/models/Order";
import LoyaltyLedger, { LedgerType } from "@/models/LoyaltyLedger";
import { notificationEngine } from "@/lib/notifications";
import {
    LOYALTY_CONFIG,
    calcOrderPoints,
    pointsToRupees,
    maxRedeemablePoints,
    isOrderLinkedLedgerType,
    isStaleClaimCandidate,
    resolveStaleClaim,
    isDefiniteNonApplicationError,
    STALE_CLAIM_THRESHOLD_MS,
    ORDER_LINKED_LEDGER_TYPES,
} from "@/lib/loyaltyLogic";

// Re-exported unchanged so every existing caller of loyaltyService.ts keeps
// working against the exact same import path/signature — only the pure
// math now lives in loyaltyLogic.ts (see that file's header comment).
export { LOYALTY_CONFIG, calcOrderPoints, pointsToRupees, maxRedeemablePoints };

export class InsufficientLoyaltyPointsError extends Error {
    status = 400;
    constructor(message = "Insufficient loyalty points") {
        super(message);
        this.name = "InsufficientLoyaltyPointsError";
    }
}

export class UserNotFoundError extends Error {
    status = 404;
    constructor(message = "User not found") {
        super(message);
        this.name = "UserNotFoundError";
    }
}

// ── _applyBalanceDelta — the one place User.loyaltyPoints is ever written ──
// Every debit (negative delta) is guarded by a conditional findOneAndUpdate
// ({loyaltyPoints: {$gte: -delta}}) — the DB itself decides at the instant
// of the write whether enough balance exists, never a prior JS-side read.
// A credit (positive delta) can never overdraw and stays unconditional.
async function _applyBalanceDelta(userId: string, delta: number): Promise<number> {
    const filter: Record<string, unknown> = { _id: userId };
    if (delta < 0) {
        filter.loyaltyPoints = { $gte: -delta };
    }

    const updated = await User.findOneAndUpdate(
        filter,
        { $inc: { loyaltyPoints: delta } },
        { new: true }
    )
        .select("loyaltyPoints")
        .lean<{ loyaltyPoints?: number } | null>();

    if (updated) return updated.loyaltyPoints ?? 0;

    if (delta < 0) {
        const exists = await User.exists({ _id: userId });
        if (!exists) throw new UserNotFoundError(`_applyPoints: user "${userId}" not found`);
        throw new InsufficientLoyaltyPointsError();
    }
    throw new UserNotFoundError(`_applyPoints: user "${userId}" not found`);
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

    const isOrderLinked = Boolean(opts.orderMongoId) && isOrderLinkedLedgerType(opts.type);

    if (!isOrderLinked) {
        // Admin adjustments / Spin ledger rows — no per-order uniqueness is
        // meaningful here (these legitimately repeat for the same user
        // over time), so this keeps the original balance-then-ledger
        // order, just now with the overdraft guard applied uniformly.
        const balanceAfter = await _applyBalanceDelta(opts.userId, opts.delta);
        await LoyaltyLedger.create({
            user:         opts.userId,
            type:         opts.type,
            points:       opts.delta,
            balanceAfter,
            order:        opts.orderMongoId   ?? null,
            referredUser: opts.referredUserId ?? null,
            note:         opts.note           ?? "",
        });
        return balanceAfter;
    }

    // ── Order-linked operation: claim/finalize/rollback state machine ─────
    // See loyaltyLogic.ts's header comment (resolveStaleClaim et al.) for
    // the full design rationale. Summary: the claim row is inserted with
    // status:"pending" FIRST, via LoyaltyLedger's partial unique index —
    // this is the atomic claim on the (user, order, type) slot, before the
    // balance is touched at all. Only once the balance update is CONFIRMED
    // to have succeeded does the claim get marked "completed". A row stuck
    // in "pending" (process crashed between the two steps) is never
    // guessed at here — resolveStalePendingClaim() below disambiguates it
    // later using the ledger's own completed-only sum as ground truth.
    let claim;
    try {
        claim = await LoyaltyLedger.create({
            user:         opts.userId,
            type:         opts.type,
            points:       opts.delta,
            order:        opts.orderMongoId,
            referredUser: opts.referredUserId ?? null,
            note:         opts.note ?? "",
            status:       "pending",
        });
    } catch (err: unknown) {
        const code = (err as { code?: number })?.code;
        if (code === 11000) {
            // Another call already claimed/completed this exact operation.
            const existing = await LoyaltyLedger.findOne({
                user: opts.userId, order: opts.orderMongoId, type: opts.type,
            }).select("balanceAfter status").lean<{ balanceAfter?: number; status?: string } | null>();

            if (existing?.status === "pending") {
                // The other caller is still mid-flight (or crashed, in
                // which case it'll be resolved by the stale-claim repair
                // path later) — briefly poll rather than returning a
                // not-yet-final value. Never retries/reapplies anything
                // itself.
                for (let i = 0; i < 6; i++) {
                    await new Promise((r) => setTimeout(r, 250));
                    const recheck = await LoyaltyLedger.findOne({
                        user: opts.userId, order: opts.orderMongoId, type: opts.type, status: "completed",
                    }).select("balanceAfter").lean<{ balanceAfter?: number } | null>();
                    if (recheck) return recheck.balanceAfter ?? 0;
                }
                // Still pending after polling — surface this as an explicit,
                // distinguishable outcome rather than a wrong success value.
                throw Object.assign(new Error("Loyalty operation is still being processed by another request"), { status: 202 });
            }
            return existing?.balanceAfter ?? 0;
        }
        throw err;
    }

    try {
        const balanceAfter = await _applyBalanceDelta(opts.userId, opts.delta);
        // Finalize — CAS on status:"pending" so a concurrent stale-claim
        // repair racing this same completion can't both "win" (whichever
        // write lands first flips the row to "completed"; the other's
        // conditional update matches zero documents and no-ops).
        await LoyaltyLedger.updateOne(
            { _id: claim._id, status: "pending" },
            { $set: { balanceAfter, status: "completed" } }
        );
        return balanceAfter;
    } catch (err: unknown) {
        const name = (err as { name?: string })?.name ?? "";
        if (isDefiniteNonApplicationError(name)) {
            // The delta DEFINITELY never applied (insufficient balance /
            // user vanished) — safe to remove the claim immediately so a
            // future legitimate retry isn't permanently blocked by it.
            await LoyaltyLedger.deleteOne({ _id: claim._id, status: "pending" }).catch((rollbackErr) =>
                console.error("LOYALTY_CLAIM_ROLLBACK_FAILED", {
                    userId: opts.userId, orderMongoId: opts.orderMongoId, type: opts.type, error: rollbackErr,
                })
            );
        } else {
            // Ambiguous — we do NOT know whether _applyBalanceDelta's
            // write actually landed before this error surfaced (network
            // blip, timeout, process kill). Leaving the row as "pending"
            // is the safe choice: resolveStalePendingClaim() will later
            // determine the true outcome from the ledger sum vs. the live
            // balance, never from a guess made here.
            console.error("LOYALTY_CLAIM_AMBIGUOUS_OUTCOME — left pending for stale-claim resolution", {
                userId: opts.userId, orderMongoId: opts.orderMongoId, type: opts.type, claimId: String(claim._id), error: err,
            });
        }
        throw err;
    }
}

// ── awardPoints (public) ──────────────────────────────────────────────────────
// Used by admin routes for manual credit / debit. Debits now go through the
// same overdraft-guarded path as redemption — see _applyBalanceDelta.

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
// Validates the request shape, then delegates the actual balance check AND
// the idempotency guarantee entirely to _applyPoints()'s atomic claim +
// guarded $inc — see the Phase 17.1B note at the top of this file. Returns
// the ₹ discount. Throws InsufficientLoyaltyPointsError (status 400) if the
// live balance can't cover it at the instant of the write.
//
// IMPORTANT: `orderMongoId` must be the MongoDB ObjectId string (order._id)
// NOT the short display orderId like "FK-XXXX". Passing the wrong id causes
// the ledger entry to silently store null for the order reference, which
// breaks the idempotency guard and the transaction history display.
//
// Deliberately does NOT emit a notification — redemption is a debit the
// user themselves just actively triggered at checkout (they see the result
// immediately in the checkout UI); it isn't a "surprise credit" the way
// order_reward/referral credits are.

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

    // Cheap fast-path — avoids an unnecessary claim-insert attempt for the
    // common "retrying an already-redeemed order" case. NOT the source of
    // the idempotency guarantee itself anymore (that's _applyPoints'
    // DB-enforced unique claim below) — just an optimization.
    const alreadyRedeemed = await LoyaltyLedger.exists({
        user:  opts.userId,
        order: opts.orderMongoId,
        type:  "redemption",
        status: "completed", // a "pending" row means another call is mid-flight, not done — let _applyPoints' claim path handle that correctly (it polls)
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

// ── Phase 12: atomic debit/credit for Digital Spin ────────────────────────────
// debitPointsAtomic() predates and is independent of the Phase 17.1B
// _applyBalanceDelta() guard above — kept exactly as-is (same atomic
// conditional-$inc pattern, just not routed through _applyPoints since Spin
// has its own idempotency-key mechanism at the caller level, not an
// order reference). Not modified by this phase.

export async function debitPointsAtomic(opts: {
    userId: string;
    points: number;
    type: LedgerType;
    note?: string;
}): Promise<{ balanceAfter: number }> {
    const updated = await User.findOneAndUpdate(
        { _id: opts.userId, loyaltyPoints: { $gte: opts.points } },
        { $inc: { loyaltyPoints: -opts.points } },
        { new: true }
    )
        .select("loyaltyPoints")
        .lean<{ loyaltyPoints?: number } | null>();

    if (!updated) {
        throw Object.assign(new Error("Not enough loyalty points"), { status: 400 });
    }

    const balanceAfter = updated.loyaltyPoints ?? 0;

    await LoyaltyLedger.create({
        user: opts.userId,
        type: opts.type,
        points: -opts.points,
        balanceAfter,
        note: opts.note ?? "",
    });

    return { balanceAfter };
}

/** Compensating credit — reward issuance failed after debitPointsAtomic succeeded. Unconditional $inc is safe here (a credit can never overdraw). */
export async function creditPointsAtomic(opts: {
    userId: string;
    points: number;
    type: LedgerType;
    // Phase 17.3 (found by real integration testing): this parameter was
    // missing entirely — orderCancellation.ts's reverseLoyaltyRedemption()
    // calls this for its compensating credit with a real orderId, but
    // that orderId was silently dropped, so the resulting
    // "redemption_reversal" ledger entry always had `order: null` instead
    // of the actual order — breaking both the order-linked DB-enforced
    // uniqueness guarantee (Phase 17.1B's whole point) and any future
    // audit/diagnostic query that looks up a reversal by order. Optional
    // and additive — every existing caller (spin.ts, for "spin_reward_points"/
    // "spin_refund", neither of which is order-linked) simply never
    // passes it and is completely unaffected.
    orderMongoId?: string | null;
    note?: string;
}): Promise<{ balanceAfter: number }> {
    const balanceAfter = await _applyPoints({
        userId: opts.userId,
        delta: opts.points,
        type: opts.type,
        orderMongoId: opts.orderMongoId ?? null,
        note: opts.note ?? "",
    });
    return { balanceAfter };
}

// ── handleOrderDelivered (public) ─────────────────────────────────────────────
// Called exactly once when an order's status becomes "delivered" — enforced
// by changeOrderStatus()'s own atomic CAS on the status transition (see
// orderStatus.ts), which only ever lets ONE caller observe `changed: true`
// for a given received/preparing/out_for_delivery → delivered transition;
// every call site in this codebase gates its call to this function on that
// flag. The LoyaltyLedger idempotency guard below is defense-in-depth, not
// the only protection against double-crediting.

export async function handleOrderDelivered(orderId: string): Promise<void> {
    const order = await Order.findById(orderId).select("user totalAmount").lean();
    if (!order) throw new Error(`handleOrderDelivered: order ${orderId} not found`);

    const userId = (order as any).user?.toString();
    if (!userId) return; // guest order — no loyalty

    // Idempotency guard — "pending" means another call is mid-flight
    // (shouldn't happen given changeOrderStatus()'s own CAS, but if it
    // ever did, falling through to _applyPoints' claim path correctly
    // polls rather than silently skipping a possibly-never-finishing row).
    const alreadyProcessed = await LoyaltyLedger.exists({
        order: orderId,
        type:  "order_reward",
        status: "completed",
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
        const note = `Earned on delivered order — ₹${orderTotal}`;
        const balanceAfter = await _applyPoints({
            userId,
            delta:        earnedPoints,
            type:         "order_reward",
            orderMongoId: orderId,   // orderId here IS the MongoDB _id (passed from admin route)
            note,
        });

        // NEW: notify the user their points were credited. Fire-and-forget,
        // error-isolated — a notification failure must never affect point
        // crediting, which has already succeeded above.
        try {
            notificationEngine.emit({
                name: "loyalty.points_credited",
                data: { points: earnedPoints, balance: balanceAfter, note },
                target: { userId },
            });
        } catch (notifyErr) {
            console.error("LOYALTY_POINTS_CREDITED_NOTIFY_ERROR", notifyErr);
        }
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

    // PERF: referee credit and referrer credit touch two entirely different
    // user documents and write two independent ledger entries — there is no
    // ordering dependency between them. Running them concurrently instead
    // of sequentially halves the wall-clock time of this tail section
    // without changing which writes happen or what they contain. Each
    // branch keeps its own error-isolated notification, identical to the
    // pre-existing sequential version.
    await Promise.all([
        (async () => {
            await _applyPoints({
                userId,
                delta:           LOYALTY_CONFIG.REFEREE_REWARD,
                type:            "referral_referee",
                orderMongoId:    orderId,
                referredUserId:  userId,
                note:            "Welcome bonus — joined via referral",
            });

            try {
                notificationEngine.emit({
                    name: "referral.reward_granted",
                    data: { points: LOYALTY_CONFIG.REFEREE_REWARD, role: "referee" },
                    target: { userId },
                });
            } catch (notifyErr) {
                console.error("REFERRAL_REWARD_REFEREE_NOTIFY_ERROR", notifyErr);
            }
        })(),
        (async () => {
            await _applyPoints({
                userId:          referrerId,
                delta:           LOYALTY_CONFIG.REFERRER_REWARD,
                type:            "referral_referrer",
                orderMongoId:    orderId,
                referredUserId:  userId,
                note:            "Referral reward — your friend's first order was delivered",
            });

            try {
                notificationEngine.emit({
                    name: "referral.reward_granted",
                    data: { points: LOYALTY_CONFIG.REFERRER_REWARD, role: "referrer" },
                    target: { userId: referrerId },
                });
            } catch (notifyErr) {
                console.error("REFERRAL_REWARD_REFERRER_NOTIFY_ERROR", notifyErr);
            }
        })(),
    ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 17.1B — READ-ONLY DIAGNOSTIC + ADMIN-TRIGGERED REPAIR
//
// Addresses the Phase 17.0 finding: createOrderCore.ts calls redeemPoints()
// AFTER Order.create() has already succeeded. If that call throws (DB
// hiccup, or — now that redeemPoints() is atomic — a genuine insufficient-
// balance race), the order is left with redeemedPoints/redeemedAmount set
// in its financial snapshot but NO corresponding LoyaltyLedger "redemption"
// entry and NO balance decrement ever applied. createOrderCore.ts records
// this durably on the order itself (Order.loyaltyRedemptionFailure — see
// Order.ts) instead of only logging it.
//
// Neither function here ever creates an order, reverses a payment, or
// mutates anything automatically. findInconsistentLoyaltyRedemptions() is
// pure read. retryFailedLoyaltyRedemption() performs exactly one, bounded,
// idempotent action — the SAME redeemPoints() call createOrderCore.ts
// itself would have made — and is only ever invoked from an explicit,
// admin-gated route (see src/app/api/admin/loyalty/inconsistencies/route.ts).
// ─────────────────────────────────────────────────────────────────────────────

export interface InconsistentRedemptionCandidate {
    orderMongoId:   string;
    orderId:        string;
    userId:         string;
    redeemedPoints: number;
    redeemedAmount: number;
    failedAt:       Date | null;
    reason:         string;
}

/**
 * Bounded, read-only scan for orders whose recorded redemption was never
 * actually applied to the user's ledger/balance. Never modifies anything.
 * Cross-checks against LoyaltyLedger directly (the true source of truth)
 * rather than trusting the loyaltyRedemptionFailure flag alone — the flag
 * is only used to narrow the candidate set efficiently.
 */
export async function findInconsistentLoyaltyRedemptions(limit = 50): Promise<InconsistentRedemptionCandidate[]> {
    const candidates = await Order.find({
        redeemedPoints: { $gt: 0 },
        user: { $ne: null },
        "loyaltyRedemptionFailure.resolvedAt": null,
        "loyaltyRedemptionFailure.failedAt": { $exists: true },
    })
        .sort({ "loyaltyRedemptionFailure.failedAt": 1 })
        .limit(Math.max(1, Math.min(limit, 200)))
        .select("orderId user redeemedPoints redeemedAmount loyaltyRedemptionFailure")
        .lean<Array<{
            _id: unknown;
            orderId: string;
            user?: unknown;
            redeemedPoints: number;
            redeemedAmount: number;
            loyaltyRedemptionFailure?: { failedAt?: Date; reason?: string; resolvedAt?: Date | null };
        }>>();

    const results: InconsistentRedemptionCandidate[] = [];
    for (const order of candidates) {
        const userId = order.user ? String(order.user) : null;
        if (!userId) continue;

        // Authoritative confirmation — never trust the flag alone. A
        // "pending" row belongs to the separate stale-claim diagnostic
        // (findStalePendingLedgerClaims), not this one — don't conflate them.
        const hasCompletedLedgerEntry = await LoyaltyLedger.exists({
            user: userId, order: order._id, type: "redemption", status: "completed",
        });
        if (hasCompletedLedgerEntry) continue; // actually fine — flag write just never got cleared

        results.push({
            orderMongoId:   String(order._id),
            orderId:        order.orderId,
            userId,
            redeemedPoints: Number(order.redeemedPoints) || 0,
            redeemedAmount: Number(order.redeemedAmount) || 0,
            failedAt:       order.loyaltyRedemptionFailure?.failedAt ?? null,
            reason:         order.loyaltyRedemptionFailure?.reason ?? "",
        });
    }
    return results;
}

export type RedemptionRepairOutcome =
    | { ok: true; alreadyConsistent: true }
    | { ok: true; alreadyConsistent: false; balanceAfter: number }
    | { ok: false; reason: string };

/**
 * Explicit, bounded repair for exactly one order — never a bulk/unbounded
 * operation. Re-confirms the inconsistency fresh (never trusts a prior
 * diagnostic read) before doing anything, and performs the same atomic
 * redeemPoints() call the order-creation path itself would have made —
 * no second, parallel mutation mechanism.
 */
export async function retryFailedLoyaltyRedemption(orderMongoId: string): Promise<RedemptionRepairOutcome> {
    const order = await Order.findById(orderMongoId)
        .select("orderId user redeemedPoints")
        .lean<{ _id: unknown; orderId: string; user?: unknown; redeemedPoints: number } | null>();

    if (!order) return { ok: false, reason: "Order not found" };

    const userId = order.user ? String(order.user) : null;
    if (!userId) return { ok: false, reason: "Order has no linked user — nothing to repair" };

    const redeemedPoints = Number(order.redeemedPoints) || 0;
    if (redeemedPoints <= 0) return { ok: false, reason: "Order has no recorded redemption" };

    const alreadyApplied = await LoyaltyLedger.exists({ user: userId, order: orderMongoId, type: "redemption", status: "completed" });
    if (alreadyApplied) {
        await Order.updateOne(
            { _id: orderMongoId },
            { $set: { "loyaltyRedemptionFailure.resolvedAt": new Date() } }
        ).catch((err) => console.error("LOYALTY_REPAIR_FLAG_CLEAR_ERROR", { orderMongoId, err }));
        return { ok: true, alreadyConsistent: true };
    }

    try {
        await redeemPoints({
            userId,
            points: redeemedPoints,
            orderMongoId: String(order._id),
            note: `Redeemed ${redeemedPoints} pts at checkout (repaired)`,
        });
        const user = await User.findById(userId).select("loyaltyPoints").lean<{ loyaltyPoints?: number } | null>();
        await Order.updateOne(
            { _id: orderMongoId },
            { $set: { "loyaltyRedemptionFailure.resolvedAt": new Date() } }
        ).catch((err) => console.error("LOYALTY_REPAIR_FLAG_CLEAR_ERROR", { orderMongoId, err }));
        return { ok: true, alreadyConsistent: false, balanceAfter: user?.loyaltyPoints ?? 0 };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Repair attempt failed";
        await Order.updateOne(
            { _id: orderMongoId },
            { $set: { "loyaltyRedemptionFailure.failedAt": new Date(), "loyaltyRedemptionFailure.reason": message } }
        ).catch((flagErr) => console.error("LOYALTY_REPAIR_FLAG_UPDATE_ERROR", { orderMongoId, flagErr }));
        return { ok: false, reason: message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 17.1B FOLLOW-UP — stale pending-claim diagnostic + repair
//
// Addresses the specific crash window identified in review: a process can
// die between _applyPoints() inserting the "pending" claim row and that
// row being finalized to "completed" (or rolled back). Neither function
// here ever guesses the outcome — resolveStaleClaim() (loyaltyLogic.ts)
// cross-checks the user's ledger-derived "completed"-only sum against the
// live cached balance to determine, with certainty, whether the delta
// already landed before deciding anything.
// ─────────────────────────────────────────────────────────────────────────────

export interface StalePendingClaim {
    claimId:   string;
    userId:    string;
    orderId:   string | null;
    type:      string;
    points:    number;
    createdAt: Date;
}

/** Bounded, read-only scan for claim rows stuck in "pending" past the stale threshold. Never modifies anything. */
export async function findStalePendingLedgerClaims(limit = 50): Promise<StalePendingClaim[]> {
    const now = new Date();
    const rows = await LoyaltyLedger.find({
        status: "pending",
        type: { $in: ORDER_LINKED_LEDGER_TYPES as readonly string[] },
        createdAt: { $lte: new Date(now.getTime() - STALE_CLAIM_THRESHOLD_MS) },
    })
        .sort({ createdAt: 1 })
        .limit(Math.max(1, Math.min(limit, 200)))
        .select("user order type points createdAt")
        .lean<Array<{ _id: unknown; user: unknown; order?: unknown; type: string; points: number; createdAt: Date }>>();

    return rows
        .filter((r) => isStaleClaimCandidate({ status: "pending", createdAt: r.createdAt, now }))
        .map((r) => ({
            claimId:   String(r._id),
            userId:    String(r.user),
            orderId:   r.order ? String(r.order) : null,
            type:      r.type,
            points:    r.points,
            createdAt: r.createdAt,
        }));
}

export type StaleClaimRepairOutcome =
    | { ok: true; action: "marked_completed"; balanceAfter: number }
    | { ok: true; action: "deleted"; }
    | { ok: false; action: "needs_manual_review"; message: string };

/**
 * Explicit, bounded repair for exactly ONE stale pending claim. Re-reads
 * everything fresh (never trusts a prior diagnostic snapshot). Uses a CAS
 * (status:"pending" in every write filter) so a concurrent repair attempt,
 * or the ORIGINAL caller finally finishing late, can never both apply an
 * outcome to the same row — whichever write lands first wins; the other's
 * conditional update matches zero documents and safely no-ops.
 */
export async function resolveStalePendingClaim(claimId: string): Promise<StaleClaimRepairOutcome> {
    const claim = await LoyaltyLedger.findById(claimId)
        .select("user order type points status createdAt")
        .lean<{ _id: unknown; user: unknown; order?: unknown; type: string; points: number; status: string; createdAt: Date } | null>();

    if (!claim) return { ok: false, action: "needs_manual_review", message: "Claim no longer exists" };
    if (claim.status !== "pending") {
        return { ok: true, action: "marked_completed", balanceAfter: 0 }; // already resolved by someone else — idempotent
    }
    if (!isStaleClaimCandidate({ status: "pending", createdAt: claim.createdAt, now: new Date() })) {
        return { ok: false, action: "needs_manual_review", message: "Claim is not yet stale — the original request may still be in flight" };
    }

    const userId = String(claim.user);

    // Ground truth: sum of every OTHER completed ledger entry for this
    // user, vs. the live cached balance — see resolveStaleClaim()'s
    // doc comment for exactly what each outcome means.
    const [user, sumAgg] = await Promise.all([
        User.findById(userId).select("loyaltyPoints").lean<{ loyaltyPoints?: number } | null>(),
        LoyaltyLedger.aggregate<{ total: number }>([
            { $match: { user: new mongoose.Types.ObjectId(userId), status: "completed" } },
            { $group: { _id: null, total: { $sum: "$points" } } },
        ]),
    ]);

    if (!user) return { ok: false, action: "needs_manual_review", message: "User no longer exists" };

    const cachedBalance = Number(user.loyaltyPoints) || 0;
    const completedLedgerSum = sumAgg[0]?.total ?? 0;

    const resolution = resolveStaleClaim({ cachedBalance, completedLedgerSum, claimDelta: claim.points });

    if (resolution.action === "needs_manual_review") {
        return {
            ok: false,
            action: "needs_manual_review",
            message: `Cached balance (${cachedBalance}) matches neither "delta never applied" (${completedLedgerSum}) nor "delta already applied" (${completedLedgerSum + claim.points}) — an unrelated balance drift exists for this user and must be investigated manually before this claim can be resolved.`,
        };
    }

    if (resolution.action === "delete_claim") {
        const result = await LoyaltyLedger.deleteOne({ _id: claimId, status: "pending" });
        return result.deletedCount === 1
            ? { ok: true, action: "deleted" }
            : { ok: true, action: "marked_completed", balanceAfter: cachedBalance }; // lost the race to someone else resolving it — fine either way
    }

    // mark_completed — the delta was already applied; finalize the
    // existing claim with the balance it actually produced. Never
    // re-applies the $inc.
    await LoyaltyLedger.updateOne(
        { _id: claimId, status: "pending" },
        { $set: { balanceAfter: cachedBalance, status: "completed" } }
    );
    return { ok: true, action: "marked_completed", balanceAfter: cachedBalance };
}

export interface DuplicateLedgerKeyGroup {
    user:  string;
    order: string;
    type:  string;
    count: number;
    ids:   string[];
}

/**
 * Read-only preflight for the production unique-index migration — finds
 * any EXISTING {user, order, type} duplicates (among order-linked types)
 * that would violate the partial unique index before it's created.
 * Bounded, never deletes or rewrites anything. See Phase 17.1B delivery
 * report for the exact migration runbook this feeds into.
 */
export async function findDuplicateLedgerKeys(limit = 50): Promise<DuplicateLedgerKeyGroup[]> {
    const groups = await LoyaltyLedger.aggregate<{
        _id: { user: unknown; order: unknown; type: string };
        count: number;
        ids: unknown[];
    }>([
        { $match: { order: { $type: "objectId" }, type: { $in: ORDER_LINKED_LEDGER_TYPES as readonly string[] } } },
        { $group: { _id: { user: "$user", order: "$order", type: "$type" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: Math.max(1, Math.min(limit, 200)) },
    ]);

    return groups.map((g) => ({
        user:  String(g._id.user),
        order: String(g._id.order),
        type:  g._id.type,
        count: g.count,
        ids:   g.ids.map(String),
    }));
}
