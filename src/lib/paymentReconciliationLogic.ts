// src/lib/paymentReconciliationLogic.ts
//
// ── PURE DECISION LOGIC FOR ORPHANED-PAYMENT RECONCILIATION (Phase 17.1A) ───
//
// Deliberately has ZERO imports (no mongoose, no Razorpay SDK, no Next.js).
// Every function here is a pure, synchronous, side-effect-free decision
// rule used by src/lib/paymentReconciliation.ts (the I/O layer). Keeping
// these rules import-free means they can be unit-tested with nothing but
// Node's own built-in `node:assert`/`node:test` — no new devDependency,
// no mocking of the database or the Razorpay client required to verify the
// actual business logic (candidate selection, state-transition guards,
// amount/currency matching, retention-extension math).
//
// See src/models/PendingPayment.ts for the field definitions these
// functions reason about (`reconciliationState`, `expiresAt`, etc.) and
// src/lib/paymentReconciliation.ts for how they're wired to real DB/
// Razorpay calls.

/** One full payment-reconciliation grace period — see RECONCILE_GRACE_PERIOD_MS. */
export const RECONCILE_GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 minutes

/** Original/default PendingPayment retention — unchanged for normal rows. */
export const DEFAULT_RETENTION_MS = 48 * 60 * 60 * 1000; // 48 hours

/** Retention window granted once a row is confirmed to need human attention. */
export const EXTENDED_RETENTION_MS = 365 * 24 * 60 * 60 * 1000; // 365 days

/** Bounded batch size for one cron/scan invocation — never unbounded. */
export const RECONCILE_BATCH_LIMIT = 25;

/**
 * How long a row may sit in "processing" before it's treated as an
 * abandoned claim (the process that won claimPendingPayment() crashed or
 * was killed before calling markCompleted()/releaseClaim()).
 *
 * Deliberately keyed off `updatedAt`, NOT `createdAt` — PendingPaymentSchema
 * already has `{timestamps: true}`, and Mongoose automatically bumps
 * `updatedAt` on every `findOneAndUpdate`/`updateOne` (not just `.save()`),
 * which means `updatedAt` already reflects the exact moment
 * claimPendingPayment() set status:"processing" — no new field/lease
 * mechanism was invented for this. See isStaleProcessingCandidate below.
 *
 * 10 minutes is chosen to be far longer than any realistic single-request
 * claim->create->complete cycle on this architecture: the whole
 * createOrderFromPendingPayment() call is normally sub-second-to-a-few-
 * seconds, and every request handler here runs under Vercel's serverless
 * function timeout, which is well under 10 minutes on any plan this
 * project could plausibly be on. A still-"processing" row this old did not
 * just get unlucky with a slow request — its owning process is gone. This
 * is a heuristic, not a proof (see the Phase 17.1A follow-up report's
 * explicit limitation note), which is why detection here only ever leads
 * to a conservative "pending_review" flag or a guarded CAS reset — never
 * a direct auto-recovery.
 */
export const STALE_PROCESSING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export type PendingPaymentStatus = "created" | "processing" | "completed" | "failed";
export type ReconciliationState = "pending_review" | "recovered" | "recovery_failed" | "dismissed" | null;

/**
 * A row is a reconciliation *candidate* only if:
 *   - it never reached "completed" (an order was never created for it), and
 *   - it isn't currently mid-flight ("processing" — the normal verify/webhook
 *     race is already handling it; reconciliation must never interfere with
 *     an in-progress atomic claim), and
 *   - it has never been classified before (reconciliationState === null) —
 *     once flagged, the admin UI is the surface of truth; re-scanning an
 *     already-flagged row is the admin's "attempt recovery" action, not the
 *     background scanner's job, and
 *   - enough grace period has elapsed since creation that the normal client
 *     /verify call or the webhook has clearly already had its chance.
 */
export function isReconcileCandidate(params: {
    status: PendingPaymentStatus;
    reconciliationState: ReconciliationState;
    createdAt: Date;
    now: Date;
    gracePeriodMs?: number;
}): boolean {
    const gracePeriodMs = params.gracePeriodMs ?? RECONCILE_GRACE_PERIOD_MS;
    if (params.status !== "created" && params.status !== "failed") return false;
    if (params.reconciliationState !== null) return false;
    return params.now.getTime() - params.createdAt.getTime() >= gracePeriodMs;
}

/**
 * A "processing" row is a stale-claim candidate only if:
 *   - it's actually in "processing" (not created/completed/failed), and
 *   - it has never been classified before (reconciliationState === null) —
 *     exactly like isReconcileCandidate above, this prevents the scanner
 *     from re-touching a row an admin action is already handling, and
 *   - its `updatedAt` is old enough that the claiming process is almost
 *     certainly gone, and
 *   - `updatedAt` is actually present. A processing row with no `updatedAt`
 *     is a sign something is wrong with the data itself (Mongoose's
 *     `{timestamps:true}` should make this impossible in practice) — the
 *     conservative answer when claim metadata is ambiguous/missing is to
 *     NEVER treat it as stale, never reset it, and let a human notice via
 *     the dry-run/admin tooling instead of guessing.
 */
export function isStaleProcessingCandidate(params: {
    status: PendingPaymentStatus;
    reconciliationState: ReconciliationState;
    updatedAt: Date | null | undefined;
    now: Date;
    thresholdMs?: number;
}): boolean {
    const thresholdMs = params.thresholdMs ?? STALE_PROCESSING_THRESHOLD_MS;
    if (params.status !== "processing") return false;
    if (params.reconciliationState !== null) return false;
    if (!params.updatedAt) return false;
    return params.now.getTime() - params.updatedAt.getTime() >= thresholdMs;
}

/** Rupees → paise. Deliberately duplicated from paymentReconciliation.ts's `toPaise` — kept here only so this module stays zero-import; both must stay in sync (trivial, stable one-liner). */
export function toPaiseLogic(rupees: number): number {
    return Math.round(rupees * 100);
}

export type CapturedClassification =
    | { outcome: "self_heal" }
    | { outcome: "pending_review"; reviewReason: "captured_no_order" }
    | { outcome: "pending_review"; reviewReason: "amount_mismatch" }
    | { outcome: "pending_review"; reviewReason: "currency_mismatch" };

/**
 * Given a Razorpay-confirmed captured payment for a PendingPayment row,
 * decides what the scanner/recovery attempt should do. Never returns a
 * "recovered"/auto-create outcome — this module only classifies; the I/O
 * layer decides whether/when an actual order-creation attempt happens.
 */
export function classifyCapturedPayment(params: {
    expectedAmountRupees: number;
    reportedAmountPaise: number;
    reportedCurrency: string;
    orderAlreadyExists: boolean;
}): CapturedClassification {
    if (params.orderAlreadyExists) return { outcome: "self_heal" };
    if (params.reportedCurrency !== "INR") {
        return { outcome: "pending_review", reviewReason: "currency_mismatch" };
    }
    if (toPaiseLogic(params.expectedAmountRupees) !== params.reportedAmountPaise) {
        return { outcome: "pending_review", reviewReason: "amount_mismatch" };
    }
    return { outcome: "pending_review", reviewReason: "captured_no_order" };
}

/**
 * Whether an admin "attempt recovery" action is allowed to proceed at all,
 * based purely on the row's current reconciliationState. The actual
 * recovery call additionally re-verifies status/amount/currency/order-
 * existence fresh against Razorpay/the DB before touching anything — this
 * guard only prevents acting on a row that's already in a terminal state.
 */
export function canAttemptRecovery(reconciliationState: ReconciliationState): boolean {
    return reconciliationState !== "recovered" && reconciliationState !== "dismissed";
}

/** Dismissal is only meaningful for a row that has actually been reviewed and not already resolved. */
export function canDismiss(reconciliationState: ReconciliationState): boolean {
    return reconciliationState === "pending_review" || reconciliationState === "recovery_failed";
}

/**
 * Monotonic retention extension — NEVER moves expiresAt earlier than it
 * already is. Guards against a slower concurrent writer (e.g. an overlapping
 * cron tick) clobbering a longer extension a faster one already applied.
 */
export function computeExtendedExpiry(currentExpiresAt: Date | null, now: Date, extensionMs: number = EXTENDED_RETENTION_MS): Date {
    const candidate = new Date(now.getTime() + extensionMs);
    if (!currentExpiresAt) return candidate;
    return currentExpiresAt.getTime() > candidate.getTime() ? currentExpiresAt : candidate;
}

/** The default expiresAt assigned at document-creation time — preserves the original 48h behavior for every row that resolves normally. */
export function computeDefaultExpiry(createdAt: Date): Date {
    return new Date(createdAt.getTime() + DEFAULT_RETENTION_MS);
}

/** A short, safe (no stack trace, no secrets) error summary to persist/display for a failed recovery attempt. */
export function sanitizeRecoveryError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    return message.slice(0, 300);
}
