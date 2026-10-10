// src/lib/__tests__/loyaltyLogic.test.ts
//
// Zero-dependency unit tests for the pure loyalty decision rules (Phase
// 17.1B). Same convention as paymentReconciliationLogic.test.ts (Phase
// 17.1A): Node's own built-in test runner + TS type-stripping, no new
// devDependency, no database/mocking needed to verify the actual
// validation/math rules.
//
//   node --experimental-strip-types --test src/lib/__tests__/loyaltyLogic.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
    LOYALTY_CONFIG,
    calcOrderPoints,
    pointsToRupees,
    maxRedeemablePoints,
    isValidRedeemRequest,
    isValidAdminPointAmount,
    isOrderLinkedLedgerType,
    requiresOverdraftGuard,
    ORDER_LINKED_LEDGER_TYPES,
    isStaleClaimCandidate,
    resolveStaleClaim,
    isDefiniteNonApplicationError,
    STALE_CLAIM_THRESHOLD_MS,
} from "../loyaltyLogic.ts";

const NOW = new Date("2026-01-10T12:00:00.000Z");

// ── calcOrderPoints ──────────────────────────────────────────────────────────

test("calcOrderPoints: below minimum order total earns zero points", () => {
    assert.equal(calcOrderPoints(LOYALTY_CONFIG.MIN_ORDER_FOR_POINTS - 1), 0);
    assert.equal(calcOrderPoints(0), 0);
});

test("calcOrderPoints: exactly at minimum earns the floored point value", () => {
    const total = LOYALTY_CONFIG.MIN_ORDER_FOR_POINTS;
    assert.equal(calcOrderPoints(total), Math.floor(total * LOYALTY_CONFIG.POINTS_PER_RUPEE));
});

test("calcOrderPoints: rounding boundary — fractional rupee-to-point conversion always floors, never rounds up", () => {
    // 199 * 0.1 = 19.9 -> floor -> 19, never 20
    assert.equal(calcOrderPoints(199), 19);
});

test("calcOrderPoints: non-finite input is rejected, not coerced", () => {
    assert.equal(calcOrderPoints(Number.NaN), 0);
    assert.equal(calcOrderPoints(Number.POSITIVE_INFINITY), 0);
});

// ── pointsToRupees ───────────────────────────────────────────────────────────

test("pointsToRupees: exact conversion at the configured point value", () => {
    assert.equal(pointsToRupees(100), 100 * LOYALTY_CONFIG.POINT_VALUE_INR);
});

test("pointsToRupees: result is rounded to 2 decimal places, never a long float", () => {
    const result = pointsToRupees(3); // 3 * 0.5 = 1.5
    assert.equal(typeof result, "number");
    const decimalDigits = result.toString().split(".")[1]?.length ?? 0;
    assert.equal(decimalDigits <= 2, true);
});

// ── maxRedeemablePoints ──────────────────────────────────────────────────────

test("maxRedeemablePoints: capped by the lower of (balance) and (order-value percentage cap)", () => {
    // order 1000, 20% cap => 200 rupees => 400 points at 0.5/point; balance 50 is the binding constraint
    assert.equal(maxRedeemablePoints(1000, 50), 50);
    // balance 1000 is plentiful; the 20%-of-order cap binds instead
    const capped = maxRedeemablePoints(1000, 1000);
    assert.equal(capped, Math.floor((1000 * LOYALTY_CONFIG.MAX_REDEMPTION_PCT) / LOYALTY_CONFIG.POINT_VALUE_INR));
});

test("maxRedeemablePoints: never negative, even for a zero or negative order total", () => {
    assert.equal(maxRedeemablePoints(0, 500), 0);
    assert.equal(maxRedeemablePoints(-50, 500), 0);
});

test("maxRedeemablePoints: non-finite inputs never produce NaN/Infinity — fail safe to zero", () => {
    assert.equal(maxRedeemablePoints(Number.NaN, 500), 0);
    assert.equal(maxRedeemablePoints(1000, Number.POSITIVE_INFINITY), 0);
});

// ── isValidRedeemRequest ─────────────────────────────────────────────────────

test("redeem validation: accepts an integer at or above the minimum", () => {
    assert.equal(isValidRedeemRequest(LOYALTY_CONFIG.MIN_REDEEM_POINTS), true);
    assert.equal(isValidRedeemRequest(LOYALTY_CONFIG.MIN_REDEEM_POINTS + 1), true);
});

test("redeem validation: rejects below the minimum, even if positive", () => {
    assert.equal(isValidRedeemRequest(LOYALTY_CONFIG.MIN_REDEEM_POINTS - 1), false);
    assert.equal(isValidRedeemRequest(1), false);
});

test("redeem validation: rejects negative, zero, non-finite, and fractional amounts", () => {
    assert.equal(isValidRedeemRequest(-100), false);
    assert.equal(isValidRedeemRequest(0), false);
    assert.equal(isValidRedeemRequest(Number.NaN), false);
    assert.equal(isValidRedeemRequest(Number.POSITIVE_INFINITY), false);
    assert.equal(isValidRedeemRequest(50.5), false);
});

test("redeem validation: rejects non-number types (string injection, null, undefined, objects)", () => {
    assert.equal(isValidRedeemRequest("100" as unknown), false);
    assert.equal(isValidRedeemRequest(null), false);
    assert.equal(isValidRedeemRequest(undefined), false);
    assert.equal(isValidRedeemRequest({ valueOf: () => 100 } as unknown), false);
});

// ── isValidAdminPointAmount ──────────────────────────────────────────────────

test("admin amount validation: accepts any non-zero finite integer (sign handled by caller)", () => {
    assert.equal(isValidAdminPointAmount(1), true);
    assert.equal(isValidAdminPointAmount(-1), true);
    assert.equal(isValidAdminPointAmount(100000), true);
});

test("admin amount validation: rejects zero, non-finite, fractional, and non-number input", () => {
    assert.equal(isValidAdminPointAmount(0), false);
    assert.equal(isValidAdminPointAmount(Number.NaN), false);
    assert.equal(isValidAdminPointAmount(Number.POSITIVE_INFINITY), false);
    assert.equal(isValidAdminPointAmount(10.5), false);
    assert.equal(isValidAdminPointAmount("100" as unknown), false);
});

// ── isOrderLinkedLedgerType / requiresOverdraftGuard ────────────────────────

test("order-linked ledger types match exactly the five order-scoped operations", () => {
    for (const t of ORDER_LINKED_LEDGER_TYPES) {
        assert.equal(isOrderLinkedLedgerType(t), true);
    }
    assert.deepEqual(
        [...ORDER_LINKED_LEDGER_TYPES].sort(),
        ["order_reward", "redemption", "referral_referee", "referral_referrer", "redemption_reversal"].sort()
    );
});

test("admin/spin ledger types are correctly excluded from the order-linked uniqueness set", () => {
    for (const t of ["admin_credit", "admin_debit", "spin_cost", "spin_refund", "spin_reward_points", "expiry"]) {
        assert.equal(isOrderLinkedLedgerType(t), false);
    }
});

test("overdraft guard applies to debits (negative delta) only, never credits", () => {
    assert.equal(requiresOverdraftGuard(-50), true);
    assert.equal(requiresOverdraftGuard(50), false);
    assert.equal(requiresOverdraftGuard(0), false);
});

// ── isStaleClaimCandidate (claim/finalize crash-window detection) ──────────

test("stale claim: a fresh pending claim (just claimed) is not flagged", () => {
    const createdAt = new Date(NOW.getTime() - 1000);
    assert.equal(isStaleClaimCandidate({ status: "pending", createdAt, now: NOW }), false);
});

test("stale claim: a pending claim older than the threshold IS flagged", () => {
    const createdAt = new Date(NOW.getTime() - STALE_CLAIM_THRESHOLD_MS - 1000);
    assert.equal(isStaleClaimCandidate({ status: "pending", createdAt, now: NOW }), true);
});

test("stale claim: a completed claim is never flagged, no matter how old", () => {
    const createdAt = new Date(NOW.getTime() - STALE_CLAIM_THRESHOLD_MS * 10);
    assert.equal(isStaleClaimCandidate({ status: "completed", createdAt, now: NOW }), false);
});

// ── resolveStaleClaim (the core disambiguation rule — never a guess) ──────

test("resolveStaleClaim: cached balance matches 'never applied' baseline -> delete_claim", () => {
    const result = resolveStaleClaim({ cachedBalance: 100, completedLedgerSum: 100, claimDelta: -30 });
    assert.deepEqual(result, { action: "delete_claim", reason: "delta_never_applied" });
});

test("resolveStaleClaim: cached balance matches 'already applied' baseline -> mark_completed", () => {
    const result = resolveStaleClaim({ cachedBalance: 70, completedLedgerSum: 100, claimDelta: -30 });
    assert.deepEqual(result, { action: "mark_completed", reason: "delta_already_applied" });
});

test("resolveStaleClaim: matches neither baseline -> needs_manual_review, never a guess", () => {
    const result = resolveStaleClaim({ cachedBalance: 50, completedLedgerSum: 100, claimDelta: -30 });
    assert.deepEqual(result, { action: "needs_manual_review", reason: "preexisting_balance_drift" });
});

test("resolveStaleClaim: works identically for a credit-direction claim (positive delta)", () => {
    // order_reward: +20 credit. Never applied -> cached stays at baseline.
    assert.deepEqual(
        resolveStaleClaim({ cachedBalance: 100, completedLedgerSum: 100, claimDelta: 20 }),
        { action: "delete_claim", reason: "delta_never_applied" }
    );
    // Already applied -> cached reflects baseline + credit.
    assert.deepEqual(
        resolveStaleClaim({ cachedBalance: 120, completedLedgerSum: 100, claimDelta: 20 }),
        { action: "mark_completed", reason: "delta_already_applied" }
    );
});

test("resolveStaleClaim: degenerate case where both baselines coincide (zero delta) still resolves deterministically to delete_claim", () => {
    // Pathological/defensive case — a zero-delta claim shouldn't occur in
    // practice (_applyPoints short-circuits delta===0 before the claim
    // path), but the rule itself must still behave deterministically.
    assert.deepEqual(
        resolveStaleClaim({ cachedBalance: 100, completedLedgerSum: 100, claimDelta: 0 }),
        { action: "delete_claim", reason: "delta_never_applied" }
    );
});

// ── isDefiniteNonApplicationError ───────────────────────────────────────────

test("error classification: insufficient-balance and user-not-found are definite non-application", () => {
    assert.equal(isDefiniteNonApplicationError("InsufficientLoyaltyPointsError"), true);
    assert.equal(isDefiniteNonApplicationError("UserNotFoundError"), true);
});

test("error classification: any other error name is treated as ambiguous, never assumed safe to roll back", () => {
    assert.equal(isDefiniteNonApplicationError("MongoNetworkTimeoutError"), false);
    assert.equal(isDefiniteNonApplicationError("TypeError"), false);
    assert.equal(isDefiniteNonApplicationError(""), false);
});
