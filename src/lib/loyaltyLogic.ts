// src/lib/loyaltyLogic.ts
//
// ── PURE LOYALTY DECISION LOGIC (Phase 17.1B) ───────────────────────────────
//
// Deliberately has ZERO imports (no mongoose, no Next.js) — same discipline
// as src/lib/paymentReconciliationLogic.ts (Phase 17.1A). Every function
// here is pure and synchronous, so it can be unit-tested with nothing but
// Node's own built-in `node:assert`/`node:test` — no new devDependency, no
// database mocking required to verify the actual business/validation rules.
//
// src/lib/loyaltyService.ts (the I/O layer) imports and re-exports the
// config + math functions from here unchanged, so no existing caller of
// loyaltyService.ts needs to change its import path.

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

export function calcOrderPoints(orderTotal: number): number {
    if (!Number.isFinite(orderTotal) || orderTotal < LOYALTY_CONFIG.MIN_ORDER_FOR_POINTS) return 0;
    return Math.floor(orderTotal * LOYALTY_CONFIG.POINTS_PER_RUPEE);
}

export function pointsToRupees(points: number): number {
    return Number((points * LOYALTY_CONFIG.POINT_VALUE_INR).toFixed(2));
}

export function maxRedeemablePoints(orderTotal: number, userBalance: number): number {
    if (!Number.isFinite(orderTotal) || !Number.isFinite(userBalance)) return 0;
    const maxByOrder = Math.floor(
        (orderTotal * LOYALTY_CONFIG.MAX_REDEMPTION_PCT) / LOYALTY_CONFIG.POINT_VALUE_INR
    );
    return Math.max(0, Math.min(userBalance, maxByOrder));
}

/**
 * Validates a requested redemption point count on its own terms — finite,
 * positive, integer-valued, and at least the configured minimum. Does NOT
 * check it against a live balance or order total (that needs a DB read —
 * see loyaltyService.ts's redeemPoints) — this is purely the shape/range
 * validation every entry point (the API route AND the service function)
 * should apply identically, extracted once so the two can never drift.
 */
export function isValidRedeemRequest(points: unknown): points is number {
    return (
        typeof points === "number" &&
        Number.isFinite(points) &&
        Number.isInteger(points) &&
        points >= LOYALTY_CONFIG.MIN_REDEEM_POINTS
    );
}

/** Same shape validation for a manual admin credit/debit amount — non-zero, finite, integer. Sign is handled by the caller (admin_credit vs admin_debit). */
export function isValidAdminPointAmount(points: unknown): points is number {
    return (
        typeof points === "number" &&
        Number.isFinite(points) &&
        Number.isInteger(points) &&
        points !== 0
    );
}

/**
 * Ledger entry types that represent a single, order-scoped logical
 * operation — at most one entry of a given type should ever exist per
 * (user, order) pair. These are the types protected by LoyaltyLedger's
 * partial unique index (see src/models/LoyaltyLedger.ts) and routed
 * through the claim-then-finalize-or-rollback path in
 * loyaltyService.ts's _applyPoints().
 *
 * Deliberately EXCLUDES admin_credit / admin_debit / spin_cost /
 * spin_refund / spin_reward_points / expiry — those have no order (or, for
 * spin, are already protected by their own atomic mechanism via
 * debitPointsAtomic + an idempotency key at the caller level) and are
 * expected to legitimately repeat for the same user over time.
 */
export const ORDER_LINKED_LEDGER_TYPES = [
    "order_reward",
    "redemption",
    "referral_referrer",
    "referral_referee",
    "redemption_reversal",
] as const;

export type OrderLinkedLedgerType = (typeof ORDER_LINKED_LEDGER_TYPES)[number];

export function isOrderLinkedLedgerType(type: string): type is OrderLinkedLedgerType {
    return (ORDER_LINKED_LEDGER_TYPES as readonly string[]).includes(type);
}

/**
 * Whether a $inc-style balance delta requires the overdraft guard (debit)
 * or is always safe unconditionally (credit). Pure, trivial, but named so
 * every call site reads the same intent rather than re-deriving `< 0`.
 */
export function requiresOverdraftGuard(delta: number): boolean {
    return delta < 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 17.1B FOLLOW-UP — claim/finalize/rollback state machine
//
// A LoyaltyLedger row for an order-linked operation moves through:
//   pending  --(balance delta applied + finalize write succeeds)-->  completed
//   pending  --(delta DEFINITELY never applied)-->                   deleted (rollback)
//   pending  --(ambiguous outcome / crash before finalize)-->        stays pending,
//                                                                     resolved later
//              by resolveStalePendingClaim() in loyaltyService.ts, which NEVER
//              guesses — it cross-checks the user's ledger-derived "completed"-only
//              sum against the live cached balance to determine, with certainty,
//              whether the delta already landed before deciding what to do.
// ─────────────────────────────────────────────────────────────────────────────

/** How long a ledger row may sit in "pending" before it's treated as a stale/crashed claim — same reasoning as Phase 17.1A's STALE_PROCESSING_THRESHOLD_MS: loyalty operations complete in well under a second normally, so this is generous, not tight. */
export const STALE_CLAIM_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export type LedgerClaimStatus = "pending" | "completed";

/**
 * A pending claim is a stale-claim candidate only if it has actually sat
 * long enough that its owning process is almost certainly gone — never
 * touched based on a short delay alone (a legitimately in-flight request
 * well under this threshold must never be treated as abandoned).
 */
export function isStaleClaimCandidate(params: { status: LedgerClaimStatus; createdAt: Date; now: Date; thresholdMs?: number }): boolean {
    if (params.status !== "pending") return false;
    const thresholdMs = params.thresholdMs ?? STALE_CLAIM_THRESHOLD_MS;
    return params.now.getTime() - params.createdAt.getTime() >= thresholdMs;
}

export type StaleClaimResolution =
    | { action: "mark_completed"; reason: "delta_already_applied" }
    | { action: "delete_claim"; reason: "delta_never_applied" }
    | { action: "needs_manual_review"; reason: "preexisting_balance_drift" };

/**
 * THE disambiguation rule for a stale pending claim — never a guess.
 * `completedLedgerSum` is the sum of every OTHER "completed" ledger entry
 * for this user (i.e. excluding the pending claim itself) — the
 * authoritative, ledger-derived balance if this claim's delta had never
 * applied. `cachedBalance` is the live User.loyaltyPoints value right now.
 *
 *   cachedBalance === completedLedgerSum                  -> the delta was
 *     never applied (the cache matches the world without it) -> safe to
 *     delete the claim; the original caller's error path already handled
 *     reporting the failure, nothing else to do.
 *   cachedBalance === completedLedgerSum + claimDelta      -> the delta WAS
 *     already applied (the cache matches the world WITH it, even though
 *     the ledger row never got marked "completed") -> safe to finalize the
 *     existing claim with balanceAfter = cachedBalance, re-applying NOTHING.
 *   neither match                                          -> something
 *     else (unrelated to this claim) has already desynced the cache from
 *     the ledger — never guess; flag for manual review instead of ever
 *     silently repairing a balance that might be wrong for an unrelated
 *     reason.
 */
export function resolveStaleClaim(params: {
    cachedBalance: number;
    completedLedgerSum: number;
    claimDelta: number;
}): StaleClaimResolution {
    if (params.cachedBalance === params.completedLedgerSum) {
        return { action: "delete_claim", reason: "delta_never_applied" };
    }
    if (params.cachedBalance === params.completedLedgerSum + params.claimDelta) {
        return { action: "mark_completed", reason: "delta_already_applied" };
    }
    return { action: "needs_manual_review", reason: "preexisting_balance_drift" };
}

/**
 * Whether an error thrown by the balance-update step DEFINITELY means the
 * delta was never applied (so rolling back/deleting the claim is safe
 * immediately, no ambiguity) — as opposed to an unexpected/ambiguous error
 * (network blip, timeout) where we genuinely don't know if the write
 * landed, and must NOT delete the claim.
 */
export function isDefiniteNonApplicationError(errorName: string): boolean {
    return errorName === "InsufficientLoyaltyPointsError" || errorName === "UserNotFoundError";
}
