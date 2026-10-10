// src/lib/__tests__/paymentReconciliationLogic.test.ts
//
// Zero-dependency unit tests for the pure reconciliation decision rules.
// Run with Node's own built-in test runner + TS type-stripping — no new
// devDependency (Jest/Vitest/etc.) was installed for this (see Phase
// 17.1A delivery report, section G, for why):
//
//   node --experimental-strip-types --test src/lib/__tests__/paymentReconciliationLogic.test.ts
//
// This file deliberately imports ONLY the pure, import-free logic module —
// never mongoose/Razorpay/Next — so it needs no DB, no network, no mocking
// framework, and cannot touch any real record.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
    isReconcileCandidate,
    isStaleProcessingCandidate,
    classifyCapturedPayment,
    canAttemptRecovery,
    canDismiss,
    computeExtendedExpiry,
    computeDefaultExpiry,
    toPaiseLogic,
    sanitizeRecoveryError,
    RECONCILE_GRACE_PERIOD_MS,
    DEFAULT_RETENTION_MS,
    EXTENDED_RETENTION_MS,
    STALE_PROCESSING_THRESHOLD_MS,
} from "../paymentReconciliationLogic.ts";

const NOW = new Date("2026-01-10T12:00:00.000Z");

// ── isReconcileCandidate ────────────────────────────────────────────────────

test("candidate: created status, never scanned, past grace period -> true", () => {
    const createdAt = new Date(NOW.getTime() - RECONCILE_GRACE_PERIOD_MS - 1000);
    assert.equal(
        isReconcileCandidate({ status: "created", reconciliationState: null, createdAt, now: NOW }),
        true
    );
});

test("candidate: failed status, never scanned, past grace period -> true", () => {
    const createdAt = new Date(NOW.getTime() - RECONCILE_GRACE_PERIOD_MS - 1000);
    assert.equal(
        isReconcileCandidate({ status: "failed", reconciliationState: null, createdAt, now: NOW }),
        true
    );
});

test("candidate: within grace period -> false (normal fast path still has time)", () => {
    const createdAt = new Date(NOW.getTime() - 1000); // 1s old
    assert.equal(
        isReconcileCandidate({ status: "created", reconciliationState: null, createdAt, now: NOW }),
        false
    );
});

test("candidate: completed status -> false (order already exists)", () => {
    const createdAt = new Date(NOW.getTime() - RECONCILE_GRACE_PERIOD_MS - 1000);
    assert.equal(
        isReconcileCandidate({ status: "completed", reconciliationState: null, createdAt, now: NOW }),
        false
    );
});

test("candidate: processing status -> false (an atomic claim is already in flight)", () => {
    const createdAt = new Date(NOW.getTime() - RECONCILE_GRACE_PERIOD_MS - 1000);
    assert.equal(
        isReconcileCandidate({ status: "processing", reconciliationState: null, createdAt, now: NOW }),
        false
    );
});

test("candidate: already flagged pending_review -> false (admin UI, not the scanner, owns it now)", () => {
    const createdAt = new Date(NOW.getTime() - RECONCILE_GRACE_PERIOD_MS - 1000);
    assert.equal(
        isReconcileCandidate({ status: "failed", reconciliationState: "pending_review", createdAt, now: NOW }),
        false
    );
});

// ── classifyCapturedPayment ─────────────────────────────────────────────────

test("classify: order already exists -> self_heal, regardless of amount", () => {
    const result = classifyCapturedPayment({
        expectedAmountRupees: 500,
        reportedAmountPaise: 999999,
        reportedCurrency: "INR",
        orderAlreadyExists: true,
    });
    assert.deepEqual(result, { outcome: "self_heal" });
});

test("classify: amount matches, INR, no order -> pending_review/captured_no_order", () => {
    const result = classifyCapturedPayment({
        expectedAmountRupees: 499.5,
        reportedAmountPaise: 49950,
        reportedCurrency: "INR",
        orderAlreadyExists: false,
    });
    assert.deepEqual(result, { outcome: "pending_review", reviewReason: "captured_no_order" });
});

test("classify: amount mismatch -> pending_review/amount_mismatch, never auto-recoverable", () => {
    const result = classifyCapturedPayment({
        expectedAmountRupees: 500,
        reportedAmountPaise: 40000, // ₹400 reported vs ₹500 expected
        reportedCurrency: "INR",
        orderAlreadyExists: false,
    });
    assert.deepEqual(result, { outcome: "pending_review", reviewReason: "amount_mismatch" });
});

test("classify: non-INR currency -> pending_review/currency_mismatch, takes priority over amount check", () => {
    const result = classifyCapturedPayment({
        expectedAmountRupees: 500,
        reportedAmountPaise: 50000,
        reportedCurrency: "USD",
        orderAlreadyExists: false,
    });
    assert.deepEqual(result, { outcome: "pending_review", reviewReason: "currency_mismatch" });
});

// ── canAttemptRecovery / canDismiss (state-transition guards) ──────────────

test("recovery allowed from null, pending_review, recovery_failed", () => {
    assert.equal(canAttemptRecovery(null), true);
    assert.equal(canAttemptRecovery("pending_review"), true);
    assert.equal(canAttemptRecovery("recovery_failed"), true);
});

test("recovery blocked once terminal (recovered/dismissed) -- never regresses a resolved case", () => {
    assert.equal(canAttemptRecovery("recovered"), false);
    assert.equal(canAttemptRecovery("dismissed"), false);
});

test("dismiss only allowed from pending_review/recovery_failed", () => {
    assert.equal(canDismiss("pending_review"), true);
    assert.equal(canDismiss("recovery_failed"), true);
    assert.equal(canDismiss(null), false);
    assert.equal(canDismiss("recovered"), false);
    assert.equal(canDismiss("dismissed"), false);
});

// ── computeExtendedExpiry (monotonic, never regresses) ─────────────────────

test("extend expiry: no current value -> now + extension", () => {
    const result = computeExtendedExpiry(null, NOW);
    assert.equal(result.getTime(), NOW.getTime() + EXTENDED_RETENTION_MS);
});

test("extend expiry: current value already further out -> keeps the later date (monotonic)", () => {
    const farFuture = new Date(NOW.getTime() + EXTENDED_RETENTION_MS * 2);
    const result = computeExtendedExpiry(farFuture, NOW);
    assert.equal(result.getTime(), farFuture.getTime());
});

test("extend expiry: current value in the near past (about to expire) -> moves forward", () => {
    const nearPast = new Date(NOW.getTime() - 1000);
    const result = computeExtendedExpiry(nearPast, NOW);
    assert.equal(result.getTime(), NOW.getTime() + EXTENDED_RETENTION_MS);
});

// ── computeDefaultExpiry (unchanged 48h behavior for normal rows) ──────────

test("default expiry: createdAt + 48h, matching the original fixed-TTL behavior", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const result = computeDefaultExpiry(createdAt);
    assert.equal(result.getTime(), createdAt.getTime() + DEFAULT_RETENTION_MS);
});

// ── misc pure helpers ────────────────────────────────────────────────────────

test("toPaiseLogic matches rupee->paise conversion used elsewhere", () => {
    assert.equal(toPaiseLogic(499.5), 49950);
    assert.equal(toPaiseLogic(1), 100);
});

test("sanitizeRecoveryError never includes more than 300 chars and handles non-Error throws", () => {
    assert.equal(sanitizeRecoveryError(new Error("insufficient stock")), "insufficient stock");
    assert.equal(sanitizeRecoveryError("plain string error"), "plain string error");
    const long = "x".repeat(500);
    assert.equal(sanitizeRecoveryError(new Error(long)).length, 300);
});

// ── isStaleProcessingCandidate (Phase 17.1A follow-up — stuck "processing" rows) ──

test("stale-processing: active claim (updatedAt just now) is NOT flagged", () => {
    const updatedAt = new Date(NOW.getTime() - 60 * 1000); // 1 minute ago
    assert.equal(
        isStaleProcessingCandidate({ status: "processing", reconciliationState: null, updatedAt, now: NOW }),
        false
    );
});

test("stale-processing: a claim older than the threshold IS flagged", () => {
    const updatedAt = new Date(NOW.getTime() - STALE_PROCESSING_THRESHOLD_MS - 1000);
    assert.equal(
        isStaleProcessingCandidate({ status: "processing", reconciliationState: null, updatedAt, now: NOW }),
        true
    );
});

test("stale-processing: a recently-created record that just entered processing is not falsely flagged", () => {
    // Mirrors a brand-new claim: updatedAt == a few seconds ago, regardless
    // of how long ago createdAt was (createdAt is irrelevant to this check
    // by design — see isReconcileCandidate's separate, status-gated rule).
    const updatedAt = new Date(NOW.getTime() - 5000);
    assert.equal(
        isStaleProcessingCandidate({ status: "processing", reconciliationState: null, updatedAt, now: NOW }),
        false
    );
});

test("stale-processing: ambiguous/missing updatedAt is handled conservatively (never flagged)", () => {
    assert.equal(
        isStaleProcessingCandidate({ status: "processing", reconciliationState: null, updatedAt: null, now: NOW }),
        false
    );
    assert.equal(
        isStaleProcessingCandidate({ status: "processing", reconciliationState: null, updatedAt: undefined, now: NOW }),
        false
    );
});

test("stale-processing: a record already completed is never flagged, no matter how old", () => {
    const updatedAt = new Date(NOW.getTime() - STALE_PROCESSING_THRESHOLD_MS * 10);
    assert.equal(
        isStaleProcessingCandidate({ status: "completed", reconciliationState: null, updatedAt, now: NOW }),
        false
    );
});

test("stale-processing: a record already flagged/resolved (reconciliationState set) is never re-flagged — prevents double-processing", () => {
    const updatedAt = new Date(NOW.getTime() - STALE_PROCESSING_THRESHOLD_MS * 10);
    for (const state of ["pending_review", "recovery_failed", "recovered", "dismissed"] as const) {
        assert.equal(
            isStaleProcessingCandidate({ status: "processing", reconciliationState: state, updatedAt, now: NOW }),
            false,
            `expected reconciliationState=${state} to block re-flagging`
        );
    }
});

test("stale-processing: existing created/failed candidate behavior is completely unchanged by this addition", () => {
    // Regression guard — isReconcileCandidate was not touched; re-assert
    // its two core cases still hold exactly as before.
    const createdAtOld = new Date(NOW.getTime() - RECONCILE_GRACE_PERIOD_MS - 1000);
    assert.equal(
        isReconcileCandidate({ status: "created", reconciliationState: null, createdAt: createdAtOld, now: NOW }),
        true
    );
    assert.equal(
        isReconcileCandidate({ status: "processing", reconciliationState: null, createdAt: createdAtOld, now: NOW }),
        false
    );
});

test("stale-processing: retention extension (computeExtendedExpiry) is the same monotonic function used for the created/failed path — no duplicate rule invented", () => {
    const staleSince = new Date(NOW.getTime() - STALE_PROCESSING_THRESHOLD_MS - 1000);
    // A stale-processing row that was never previously extended behaves
    // identically to a freshly-flagged created/failed row.
    const result = computeExtendedExpiry(null, NOW);
    assert.equal(result.getTime(), NOW.getTime() + EXTENDED_RETENTION_MS);
    // And re-applying it never regresses an already-extended row, exactly
    // as required for the CAS-guarded reset path (which may run more than
    // once across retried admin clicks).
    const alreadyExtended = new Date(NOW.getTime() + EXTENDED_RETENTION_MS * 3);
    assert.equal(computeExtendedExpiry(alreadyExtended, NOW).getTime(), alreadyExtended.getTime());
});

// NOTE on "concurrent recovery cannot create duplicate orders" (stale-
// processing path specifically): the actual duplicate-prevention mechanism
// is a database-level compare-and-swap (releaseStaleProcessingClaim's
// updateOne filter requires BOTH status:"processing" AND the exact
// updatedAt value read moments earlier — see src/lib/paymentReconciliation.ts).
// That is an I/O-layer guarantee that cannot be exercised by this
// zero-dependency, no-database pure-logic suite. What IS verified here,
// at the pure-logic level, is the precondition the I/O layer relies on:
// once ANY reconciliation state is set (by either the winning CAS writer
// or an earlier pass), isStaleProcessingCandidate permanently excludes
// that row from being selected again (see the "double-processing" test
// above) — the same exclusion pattern isReconcileCandidate already used
// for created/failed rows, reused here rather than re-invented. True
// concurrent-write-race verification would require an integration test
// against a real MongoDB instance, which is out of scope for this
// no-database-connection task — see the delivery report's "remaining
// risks" section.
