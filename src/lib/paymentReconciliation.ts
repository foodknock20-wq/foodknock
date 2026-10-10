// src/lib/paymentReconciliation.ts
//
// ── SHARED RAZORPAY → ORDER RECONCILIATION LOGIC ────────────────────────────
//
// Used by BOTH /api/payment/verify (client path) and /api/payment/webhook
// (server-recovery path) so the two can race safely and always converge on
// exactly one order per payment. See src/models/PendingPayment.ts for the
// full design rationale.
//
// The atomic claim:
//   PendingPayment.razorpayPaymentId is unique+sparse. claimPendingPayment()
//   sets it via a SINGLE conditional findOneAndUpdate guarded by
//   {razorpayPaymentId: {$exists:false}}. Only one concurrent caller can
//   ever win this update for a given PendingPayment document — the other
//   gets `null` back and must not proceed to createOrderCore(). This is the
//   mechanism that prevents double stock-decrement / double order creation
//   when the client and the webhook process the same payment concurrently.

import Razorpay from "razorpay";
import PendingPayment from "@/models/PendingPayment";
import Order from "@/models/Order";
import { createOrderCore, type CreateOrderResult } from "@/lib/createOrderCore";
import {
    RECONCILE_GRACE_PERIOD_MS,
    RECONCILE_BATCH_LIMIT,
    STALE_PROCESSING_THRESHOLD_MS,
    isReconcileCandidate,
    isStaleProcessingCandidate,
    classifyCapturedPayment,
    canAttemptRecovery,
    canDismiss,
    computeExtendedExpiry,
    sanitizeRecoveryError,
    type ReconciliationState,
} from "@/lib/paymentReconciliationLogic";

export type PendingPaymentDoc = {
    _id: unknown;
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    status: "created" | "processing" | "completed" | "failed";
    expectedAmount: number;
    orderId: string | null;
    createdAt?: Date;
    // Bumped automatically by Mongoose's `{timestamps:true}` on every
    // findOneAndUpdate/updateOne — including claimPendingPayment's status
    // transition to "processing". This is what the stale-processing
    // detector below uses; no separate lease/claimedAt field was added.
    updatedAt?: Date;
    // Phase 17.1A — reconciliation/retention fields. Optional on the type
    // since pre-existing callers (verify/webhook) never select or use them.
    expiresAt?: Date;
    reconciliationState?: ReconciliationState;
    reviewReason?: string | null;
    reviewNote?: string;
    reviewedAt?: Date | null;
    reviewedBy?: unknown;
    recoveryAttempts?: number;
    lastRecoveryError?: string;
    payload: {
        customerName: string;
        phone: string;
        address: string;
        landmark: string;
        note: string;
        orderType: string;
        items: Array<{ _id: string; name: string; price: number; quantity: number; image?: string }>;
        linkedUserId: string | null;
        validatedRedeemPoints: number;
        latitude?: number | null;
        longitude?: number | null;
        deliveryInstructions?: string;
        // Phase 11 — coupon snapshot locked in at create-order time.
        couponId?: string | null;
        couponCode?: string | null;
        couponDiscountType?: "FIXED" | "PERCENTAGE" | "FREE_DELIVERY" | null;
        couponDiscountValue?: number | null;
        couponDiscountAmount?: number;
        // Phase 12 — automatic offer snapshot.
        offerId?: string | null;
        offerCampaignId?: string | null;
        offerName?: string | null;
        offerDiscountType?: "FIXED" | "PERCENTAGE" | "FREE_DELIVERY" | null;
        offerDiscountValue?: number | null;
        offerDiscountAmount?: number;
    };
};

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Rupees → paise, matching how Razorpay reports `payment.amount`. */
export function toPaise(rupees: number): number {
    return Math.round(rupees * 100);
}

/**
 * Phase 17.1A hardening — the ONE failure window orphaned-payment
 * reconciliation genuinely cannot recover from is PendingPayment.create()
 * itself failing in /api/payment/create-order: if there's no row at all,
 * there's no checkout context for the scanner, an admin, the webhook, or
 * /verify to recover from — Razorpay's own payment record is the only
 * trace left, and nothing in this codebase can safely reconstruct a
 * customer's cart/address from that alone (see Phase 17.1A delivery
 * report §H for why that remains an explicit, documented limitation
 * rather than something this change fabricates a fix for).
 *
 * This narrows (does not eliminate) that window: a transient DB hiccup on
 * the FIRST attempt no longer permanently loses the row. A duplicate-key
 * error on retry (razorpayOrderId is unique) means an earlier attempt in
 * this same call actually succeeded despite throwing — treated as
 * success, not a failure, since the row we wanted now exists either way.
 * Never blocks or fails the checkout itself — same contract as before.
 */
export async function persistPendingPaymentWithRetry(
    doc: Record<string, unknown>,
    attempts = 3,
    delayMs = 150
): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
        try {
            await PendingPayment.create(doc);
            return true;
        } catch (err: unknown) {
            const code = (err as { code?: number })?.code;
            const isDuplicateOrderId = code === 11000 && String((err as { message?: string })?.message ?? "").includes("razorpayOrderId");
            if (isDuplicateOrderId) {
                // A prior attempt in this same call already persisted it.
                return true;
            }
            if (i < attempts - 1) {
                await sleep(delayMs);
                continue;
            }
            console.error("PENDING_PAYMENT_PERSIST_ERROR — webhook/reconciliation recovery unavailable for this payment", {
                razorpayOrderId: doc.razorpayOrderId,
                attempts,
                error: err instanceof Error ? err.message : err,
            });
            return false;
        }
    }
    return false;
}

/**
 * Attempts to atomically claim a PendingPayment for processing by setting
 * its razorpayPaymentId. Only the first caller for a given document
 * succeeds; everyone else gets `null`.
 *
 * Phase 17.3 (found by real integration testing, not previously caught):
 * the filter used to require status:"created" ONLY. releaseClaim() always
 * resets a failed attempt to status:"failed" (so a future retry "can
 * attempt it again" — see that function's own doc comment) — but with
 * "created" as the only acceptable starting status here, a "failed" row
 * could NEVER actually be re-claimed by anyone: not a webhook retry, not
 * the customer's own /verify retry, and not Phase 17.1A's admin-triggered
 * attemptRecovery(), which calls this exact function for its "clean
 * recovery" path. That silently defeated the entire point of recovering a
 * "failed" PendingPayment — the majority case the reconciliation feature
 * exists for. "failed" now accepts a fresh claim attempt, exactly as
 * releaseClaim()'s own contract already promised; "completed" and
 * "processing" remain correctly unclaimable.
 */
export async function claimPendingPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string
): Promise<PendingPaymentDoc | null> {
    const claimed = await PendingPayment.findOneAndUpdate(
        {
            razorpayOrderId,
            razorpayPaymentId: { $exists: false },
            status: { $in: ["created", "failed"] },
        },
        { $set: { razorpayPaymentId, status: "processing" } },
        { new: true }
    ).lean<PendingPaymentDoc>();

    return claimed;
}

/** Releases a failed claim so a future retry (client or webhook) can attempt it again. */
export async function releaseClaim(razorpayOrderId: string, failureReason: string): Promise<void> {
    await PendingPayment.updateOne(
        { razorpayOrderId, status: "processing" },
        { $unset: { razorpayPaymentId: "" }, $set: { status: "failed", failureReason } }
    ).catch((err) => console.error("PENDING_PAYMENT_RELEASE_CLAIM_ERROR", { razorpayOrderId, err }));
}

/**
 * Phase 17.1A follow-up — resets a STALE "processing" claim back to
 * "failed" so it re-enters the normal recovery path, WITHOUT ever racing
 * the process that might still legitimately own it.
 *
 * Safety: this is a compare-and-swap, not a blind reset. The filter
 * requires BOTH `status: "processing"` AND `updatedAt: expectedUpdatedAt`
 * (the exact value read moments earlier). If the real claim holder is
 * still alive and calls markCompleted()/releaseClaim() between that read
 * and this write, `updatedAt` will have changed server-side and this
 * update matches ZERO documents — it fails closed, never stealing an
 * active claim. The caller MUST re-read the document's current state when
 * `modifiedCount` comes back 0 rather than assuming the reset happened.
 *
 * `expectedUpdatedAt` being missing is treated as "cannot safely CAS" —
 * no-op, matching isStaleProcessingCandidate's conservative stance on
 * ambiguous/missing claim metadata.
 */
async function releaseStaleProcessingClaim(
    pendingId: unknown,
    expectedUpdatedAt: Date | null | undefined
): Promise<boolean> {
    if (!expectedUpdatedAt) return false;
    const result = await PendingPayment.updateOne(
        { _id: pendingId, status: "processing", updatedAt: expectedUpdatedAt },
        { $unset: { razorpayPaymentId: "" }, $set: { status: "failed", failureReason: "stale_processing_claim_reset" } }
    ).catch((err) => {
        console.error("RECONCILE_RELEASE_STALE_CLAIM_ERROR", { pendingId: String(pendingId), err });
        return null;
    });
    return Boolean(result && result.modifiedCount === 1);
}

async function markCompleted(razorpayOrderId: string, orderId: string): Promise<void> {
    await PendingPayment.updateOne(
        { razorpayOrderId },
        { $set: { status: "completed", orderId, failureReason: "" } }
    ).catch((err) => console.error("PENDING_PAYMENT_MARK_COMPLETED_ERROR", { razorpayOrderId, err }));
}

/**
 * Creates the order from a claimed PendingPayment's trusted stored payload.
 * Caller MUST have already won claimPendingPayment() for this document.
 * On failure, releases the claim (so it can be retried) and rethrows.
 */
export async function createOrderFromPendingPayment(
    pending: PendingPaymentDoc,
    razorpayPaymentId: string
): Promise<CreateOrderResult> {
    try {
        const result = await createOrderCore({
            paymentMethod: "razorpay",
            customerName: pending.payload.customerName,
            phone: pending.payload.phone,
            address: pending.payload.address,
            landmark: pending.payload.landmark,
            note: pending.payload.note,
            orderType: pending.payload.orderType,
            items: pending.payload.items,
            linkedUserId: pending.payload.linkedUserId,
            razorpayOrderId: pending.razorpayOrderId,
            razorpayPaymentId,
            validatedRedeemPoints: pending.payload.validatedRedeemPoints,
            latitude: pending.payload.latitude ?? null,
            longitude: pending.payload.longitude ?? null,
            deliveryInstructions: pending.payload.deliveryInstructions ?? "",
            // Phase 11 — trusted snapshot, not recomputed (see createOrderCore.ts).
            couponSnapshot: pending.payload.couponId
                ? {
                      couponId:       pending.payload.couponId,
                      code:           pending.payload.couponCode ?? "",
                      discountType:   pending.payload.couponDiscountType ?? "FIXED",
                      discountValue:  pending.payload.couponDiscountValue ?? 0,
                      discountAmount: pending.payload.couponDiscountAmount ?? 0,
                  }
                : null,
            offerSnapshot: pending.payload.offerId
                ? {
                      offerId:        pending.payload.offerId,
                      campaignId:     pending.payload.offerCampaignId ?? null,
                      name:           pending.payload.offerName ?? "",
                      discountType:   pending.payload.offerDiscountType ?? "FIXED",
                      discountValue:  pending.payload.offerDiscountValue ?? 0,
                      discountAmount: pending.payload.offerDiscountAmount ?? 0,
                      freeDelivery:   pending.payload.offerDiscountType === "FREE_DELIVERY",
                  }
                : null,
        });

        await markCompleted(pending.razorpayOrderId, result.orderId);
        return result;
    } catch (err) {
        console.error("PAYMENT_RECONCILIATION_ORDER_CREATE_FAILED", {
            razorpayOrderId: pending.razorpayOrderId,
            razorpayPaymentId,
            error: err instanceof Error ? err.message : err,
        });
        await releaseClaim(pending.razorpayOrderId, err instanceof Error ? err.message : "unknown error");
        throw err;
    }
}

/**
 * Validates a reported payment amount (paise) against the PendingPayment's
 * server-computed expected amount. This is the strongest amount check the
 * current architecture supports without a broader pricing rewrite (Phase 2):
 * it confirms the Razorpay charge matches what create-order authoritatively
 * computed, but does not independently re-verify each item's price against
 * the live Product catalog (that remains a Phase 2 item — see audit §15/§7).
 */
export function amountMatches(pending: PendingPaymentDoc, amountPaise: number): boolean {
    return toPaise(pending.expectedAmount) === amountPaise;
}

/** Waits briefly for a concurrently-processing PendingPayment to resolve, then returns the current Order if completed. */
export async function waitForCompletion(
    razorpayOrderId: string,
    maxAttempts = 6,
    intervalMs = 400
): Promise<{ orderId: string; order: unknown } | null> {
    for (let i = 0; i < maxAttempts; i++) {
        const doc = await PendingPayment.findOne({ razorpayOrderId })
            .select("status orderId")
            .lean<{ status: string; orderId: string | null }>();

        if (doc?.status === "completed" && doc.orderId) {
            const order = await Order.findOne({ orderId: doc.orderId }).lean();
            if (order) return { orderId: doc.orderId, order };
        }

        await sleep(intervalMs);
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 17.1A — ORPHANED-PAYMENT RECONCILIATION (audit finding F1)
//
// Everything below is NEW. It never modifies the behavior of
// claimPendingPayment / releaseClaim / markCompleted / createOrderFromPendingPayment
// above (used verbatim, unmodified, by both /api/payment/verify and
// /api/payment/webhook) — it only adds a second, separate way to reach the
// SAME claim-then-create path: an admin-triggered (or scanner-flagged)
// recovery for a row the normal fast paths never resolved.
//
// Design (see Phase 17.1A delivery report for the full rationale):
//   - The background scanner (scanForOrphanedPayments, called by the new
//     cron route) ONLY detects, self-heals (see below), and preserves
//     evidence (extends expiresAt). It NEVER creates an order unattended.
//   - Actual order creation during recovery only ever happens via
//     attemptRecovery(), which is called exclusively from an admin-gated
//     API route and re-verifies everything fresh (status/amount/currency/
//     existing-order) before touching anything, using the exact same
//     atomic claim + createOrderCore path as the normal flow.
// ─────────────────────────────────────────────────────────────────────────────

let _razorpay: Razorpay | null = null;
function getRazorpay(): Razorpay {
    if (!_razorpay) {
        _razorpay = new Razorpay({
            key_id:     process.env.RAZORPAY_KEY_ID!,
            key_secret: process.env.RAZORPAY_KEY_SECRET!,
        });
    }
    return _razorpay;
}

export interface RazorpayCapturedPayment {
    id: string;
    amountPaise: number;
    currency: string;
}

/**
 * Looks up every payment attempt Razorpay has recorded against a Razorpay
 * order and returns the captured one, if any. This is the ONLY Razorpay
 * call the reconciliation subsystem makes to discover a payment ID — it
 * works even when our own PendingPayment row never got as far as storing
 * razorpayPaymentId (e.g. the client never called /verify AND the webhook
 * never fired), because it asks Razorpay directly instead of relying on
 * our own possibly-incomplete local record.
 *
 * Returns `null` for "no captured payment found" (a genuinely abandoned
 * checkout — not an error). Throws on a real provider/network failure so
 * the caller can distinguish "confirmed not captured" from "couldn't ask."
 */
export async function findCapturedPaymentOnRazorpay(
    razorpayOrderId: string
): Promise<RazorpayCapturedPayment | null> {
    const result = await getRazorpay().orders.fetchPayments(razorpayOrderId);
    const items = (result?.items ?? []) as Array<{ id: string; amount: string | number; currency: string; status: string }>;
    const captured = items.find((p) => p.status === "captured");
    if (!captured) return null;
    return {
        id:          captured.id,
        amountPaise: Number(captured.amount),
        currency:    captured.currency,
    };
}

/**
 * Monotonically extends a PendingPayment's retention so it survives long
 * enough for reconciliation/admin review, regardless of what the original
 * 48h createdAt-based horizon would have done. Safe to call repeatedly —
 * never moves expiresAt earlier (see computeExtendedExpiry).
 */
async function extendRetention(pendingId: unknown): Promise<void> {
    const doc = await PendingPayment.findById(pendingId).select("expiresAt").lean<{ expiresAt?: Date }>();
    const nextExpiry = computeExtendedExpiry(doc?.expiresAt ?? null, new Date());
    await PendingPayment.updateOne(
        { _id: pendingId, $or: [{ expiresAt: { $lt: nextExpiry } }, { expiresAt: { $exists: false } }] },
        { $set: { expiresAt: nextExpiry } }
    ).catch((err) => console.error("RECONCILE_EXTEND_RETENTION_ERROR", { pendingId: String(pendingId), err }));
}

export interface ScanSummary {
    scanned:          number;
    selfHealed:       number;
    flaggedForReview: number;
    deferred:         number; // provider/DB error while checking — retried next run
    abandoned:        number; // confirmed not captured — left to expire normally, no action
    staleProcessingScanned: number; // Phase 17.1A follow-up — separate counter for the stale-"processing" pass below
}

/**
 * Bounded, idempotent background scan for captured-but-orphaned payments.
 * Intended to be called by the cron route only — see
 * src/app/api/cron/payment-reconciliation/route.ts. Processes at most
 * RECONCILE_BATCH_LIMIT rows per call; never an unbounded sweep, never
 * calls Razorpay for a row that's already been classified before.
 *
 * Detection-only by design: the only mutation this function ever makes to
 * an ORDER is none at all — it either self-heals a PendingPayment whose
 * order already exists (pure bookkeeping catch-up) or flags a row
 * "pending_review" for a human to act on via attemptRecovery(). It never
 * calls createOrderCore / createOrderFromPendingPayment itself.
 */
export async function scanForOrphanedPayments(): Promise<ScanSummary> {
    const now = new Date();
    const summary: ScanSummary = { scanned: 0, selfHealed: 0, flaggedForReview: 0, deferred: 0, abandoned: 0, staleProcessingScanned: 0 };

    const candidates = await PendingPayment.find({
        status: { $in: ["created", "failed"] },
        reconciliationState: null,
        createdAt: { $lte: new Date(now.getTime() - RECONCILE_GRACE_PERIOD_MS) },
    })
        .sort({ createdAt: 1 })
        .limit(RECONCILE_BATCH_LIMIT)
        .select("_id razorpayOrderId status reconciliationState createdAt expiresAt expectedAmount")
        .lean<Array<Pick<PendingPaymentDoc, "_id" | "razorpayOrderId" | "status" | "reconciliationState" | "createdAt" | "expiresAt" | "expectedAmount">>>();

    for (const candidate of candidates) {
        summary.scanned++;

        // Defense-in-depth re-check against the pure rule itself (the query
        // above already encodes it, but this keeps the two in sync by
        // construction rather than by the query alone).
        if (
            !isReconcileCandidate({
                status: candidate.status,
                reconciliationState: candidate.reconciliationState ?? null,
                createdAt: candidate.createdAt ?? now,
                now,
            })
        ) {
            continue;
        }

        let captured: RazorpayCapturedPayment | null;
        try {
            captured = await findCapturedPaymentOnRazorpay(candidate.razorpayOrderId);
        } catch (err) {
            console.error("RECONCILE_SCAN_PROVIDER_ERROR", { pendingId: String(candidate._id), error: err instanceof Error ? err.message : err });
            // Can't yet tell if money was taken — preserve evidence defensively and retry next run.
            await extendRetention(candidate._id);
            summary.deferred++;
            continue;
        }

        if (!captured) {
            // Confirmed: no money was ever taken for this checkout attempt.
            // Let the normal 48h horizon stand — nothing to reconcile.
            summary.abandoned++;
            continue;
        }

        const existingOrder = await Order.findOne({
            $or: [{ razorpayPaymentId: captured.id }, { razorpayOrderId: candidate.razorpayOrderId }],
        }).select("_id orderId").lean<{ _id: unknown; orderId: string } | null>();

        const classification = classifyCapturedPayment({
            expectedAmountRupees: candidate.expectedAmount,
            reportedAmountPaise:  captured.amountPaise,
            reportedCurrency:     captured.currency,
            orderAlreadyExists:   Boolean(existingOrder),
        });

        await extendRetention(candidate._id);

        if (classification.outcome === "self_heal" && existingOrder) {
            await PendingPayment.updateOne(
                { _id: candidate._id, reconciliationState: null },
                { $set: { status: "completed", orderId: existingOrder.orderId, failureReason: "" } }
            );
            console.log("RECONCILE_SELF_HEALED", { pendingId: String(candidate._id), orderId: existingOrder.orderId });
            summary.selfHealed++;
            continue;
        }

        if (classification.outcome === "pending_review") {
            await PendingPayment.updateOne(
                { _id: candidate._id, reconciliationState: null },
                { $set: { reconciliationState: "pending_review", reviewReason: classification.reviewReason, reviewedAt: now } }
            );
            console.error("RECONCILE_FLAGGED_PENDING_REVIEW", {
                pendingId: String(candidate._id),
                razorpayOrderId: candidate.razorpayOrderId,
                reviewReason: classification.reviewReason,
            });
            summary.flaggedForReview++;
        }
    }

    // ── Phase 17.1A follow-up — stale "processing" claims ──────────────────
    // Separate, independently-bounded pass. A row stuck in "processing"
    // means some earlier process won claimPendingPayment() (which also
    // atomically set razorpayPaymentId on this exact document) and then
    // never called markCompleted() or releaseClaim() — almost always a
    // crashed/killed serverless invocation mid-createOrderFromPendingPayment.
    // This NEVER calls Razorpay or claimPendingPayment() itself — see the
    // function-level comments on releaseStaleProcessingClaim and
    // isStaleProcessingCandidate for why a direct auto-recovery here would
    // be unsafe; this pass only self-heals (order already exists — no
    // provider call needed, razorpayPaymentId is already known) or
    // conservatively flags for admin review after a guarded CAS reset.
    const staleProcessingCandidates = await PendingPayment.find({
        status: "processing",
        reconciliationState: null,
        updatedAt: { $lte: new Date(now.getTime() - STALE_PROCESSING_THRESHOLD_MS) },
    })
        .sort({ updatedAt: 1 })
        .limit(RECONCILE_BATCH_LIMIT)
        .select("_id razorpayOrderId razorpayPaymentId status reconciliationState updatedAt expiresAt")
        .lean<Array<Pick<PendingPaymentDoc, "_id" | "razorpayOrderId" | "razorpayPaymentId" | "status" | "reconciliationState" | "updatedAt" | "expiresAt">>>();

    for (const candidate of staleProcessingCandidates) {
        summary.staleProcessingScanned++;

        if (
            !isStaleProcessingCandidate({
                status: candidate.status,
                reconciliationState: candidate.reconciliationState ?? null,
                updatedAt: candidate.updatedAt,
                now,
            })
        ) {
            continue; // defense-in-depth re-check, same pattern as the main loop above
        }

        // razorpayPaymentId is guaranteed present on any genuinely
        // "processing" row — claimPendingPayment() sets both fields in the
        // SAME atomic update. No Razorpay call needed to discover it.
        const existingOrder = candidate.razorpayPaymentId
            ? await Order.findOne({ razorpayPaymentId: candidate.razorpayPaymentId }).select("_id orderId").lean<{ _id: unknown; orderId: string } | null>()
            : null;

        await extendRetention(candidate._id);

        if (existingOrder) {
            // Order.create() succeeded but the process died before
            // markCompleted() ran — pure bookkeeping catch-up, no judgment
            // call, no Razorpay call, nothing left ambiguous.
            await PendingPayment.updateOne(
                { _id: candidate._id, status: "processing", reconciliationState: null },
                { $set: { status: "completed", orderId: existingOrder.orderId, failureReason: "" } }
            );
            console.log("RECONCILE_STALE_PROCESSING_SELF_HEALED", { pendingId: String(candidate._id), orderId: existingOrder.orderId });
            summary.selfHealed++;
            continue;
        }

        const reset = await releaseStaleProcessingClaim(candidate._id, candidate.updatedAt);
        if (!reset) {
            // CAS lost — the real owner just finished (or another tick beat
            // us to it) between our read and this write. Leave it alone;
            // the next scan tick re-evaluates its now-current state.
            console.log("RECONCILE_STALE_PROCESSING_CAS_LOST", { pendingId: String(candidate._id) });
            continue;
        }

        await PendingPayment.updateOne(
            { _id: candidate._id, reconciliationState: null },
            { $set: { reconciliationState: "pending_review", reviewReason: "stale_processing_claim", reviewedAt: now } }
        );
        console.error("RECONCILE_STALE_PROCESSING_FLAGGED", { pendingId: String(candidate._id), razorpayOrderId: candidate.razorpayOrderId });
        summary.flaggedForReview++;
    }

    return summary;
}

export type RecoveryOutcome =
    | { ok: true; alreadyResolved: true; orderId: string }
    | { ok: true; alreadyResolved: false; orderId: string; result: CreateOrderResult }
    | { ok: false; reason: "not_found" | "already_terminal" | "not_captured" | "amount_mismatch" | "currency_mismatch" | "claim_lost_still_processing" | "recovery_failed"; message: string };

/**
 * Admin-triggered recovery attempt for one PendingPayment row. Re-verifies
 * everything fresh against Razorpay/the DB (never trusts a prior scan's
 * cached classification) and, only if every check passes, reuses the
 * EXACT SAME atomic claim (claimPendingPayment) and order-creation call
 * (createOrderFromPendingPayment -> createOrderCore) the normal
 * verify/webhook paths use. Idempotent: calling this twice for an
 * already-recovered row just returns the existing result; calling it
 * concurrently from two admin clicks is resolved by the same single
 * atomic claim that already protects the client/webhook race.
 */
export async function attemptRecovery(pendingId: string, adminUserId: string): Promise<RecoveryOutcome> {
    const pending = await PendingPayment.findById(pendingId).lean<PendingPaymentDoc>();
    if (!pending) return { ok: false, reason: "not_found", message: "Payment record no longer exists." };

    if (!canAttemptRecovery(pending.reconciliationState ?? null)) {
        return { ok: false, reason: "already_terminal", message: `Already ${pending.reconciliationState}.` };
    }

    // ── Phase 17.1A follow-up — a "processing" row needs its own path ─────
    // claimPendingPayment() can only ever claim a row whose status is
    // "created" — it structurally cannot touch a "processing" row, so
    // falling through to the normal flow below would silently do nothing
    // useful. Decide here, conservatively, using the same updatedAt-based
    // staleness check and CAS reset the background scanner uses — never
    // a blind reset, never a direct auto-recovery from this branch alone.
    if (pending.status === "processing") {
        const stale = isStaleProcessingCandidate({
            status: pending.status,
            reconciliationState: pending.reconciliationState ?? null,
            updatedAt: pending.updatedAt,
            now: new Date(),
        });

        if (!stale) {
            return { ok: false, reason: "claim_lost_still_processing", message: "This payment is actively being processed right now. Refresh shortly." };
        }

        const reset = await releaseStaleProcessingClaim(pendingId, pending.updatedAt);
        if (!reset) {
            // CAS lost — the real owner just finished between our read and
            // this write. Re-check rather than assume either outcome.
            const fresh = await PendingPayment.findById(pendingId).select("status orderId").lean<{ status: string; orderId: string | null }>();
            if (fresh?.status === "completed" && fresh.orderId) {
                await PendingPayment.updateOne(
                    { _id: pendingId },
                    { $set: { reconciliationState: "recovered", reviewedAt: new Date(), reviewedBy: adminUserId } }
                );
                return { ok: true, alreadyResolved: true, orderId: fresh.orderId };
            }
            return { ok: false, reason: "claim_lost_still_processing", message: "This payment just finished processing elsewhere — refresh to see its current state." };
        }

        // Reset succeeded: the document is now status:"failed",
        // razorpayPaymentId unset — exactly the shape the rest of this
        // function already handles for any ordinary failed row. Reflect
        // that locally and fall through into the unchanged logic below
        // instead of duplicating it.
        pending.status = "failed";
        pending.razorpayPaymentId = undefined;
    }

    // Self-heal check first — a concurrent webhook/verify/earlier recovery
    // attempt may have already finished this since the admin's page loaded.
    if (pending.status === "completed" && pending.orderId) {
        await PendingPayment.updateOne(
            { _id: pendingId },
            { $set: { reconciliationState: "recovered", reviewedAt: new Date(), reviewedBy: adminUserId } }
        );
        return { ok: true, alreadyResolved: true, orderId: pending.orderId };
    }

    let captured: RazorpayCapturedPayment | null;
    try {
        captured = await findCapturedPaymentOnRazorpay(pending.razorpayOrderId);
    } catch (err) {
        console.error("RECONCILE_RECOVERY_PROVIDER_ERROR", { pendingId, error: err instanceof Error ? err.message : err });
        return { ok: false, reason: "recovery_failed", message: "Could not reach Razorpay to re-verify this payment. Try again shortly." };
    }

    if (!captured) {
        await PendingPayment.updateOne(
            { _id: pendingId },
            { $set: { reviewReason: "not_captured_on_recheck" }, $inc: { recoveryAttempts: 1 } }
        );
        return { ok: false, reason: "not_captured", message: "Razorpay no longer reports a captured payment for this checkout." };
    }

    const existingOrder = await Order.findOne({
        $or: [{ razorpayPaymentId: captured.id }, { razorpayOrderId: pending.razorpayOrderId }],
    }).select("_id orderId").lean<{ _id: unknown; orderId: string } | null>();

    const classification = classifyCapturedPayment({
        expectedAmountRupees: pending.expectedAmount,
        reportedAmountPaise:  captured.amountPaise,
        reportedCurrency:     captured.currency,
        orderAlreadyExists:   Boolean(existingOrder),
    });

    if (classification.outcome === "self_heal" && existingOrder) {
        await PendingPayment.updateOne(
            { _id: pendingId },
            { $set: { status: "completed", orderId: existingOrder.orderId, failureReason: "", reconciliationState: "recovered", reviewedAt: new Date(), reviewedBy: adminUserId } }
        );
        return { ok: true, alreadyResolved: true, orderId: existingOrder.orderId };
    }

    // PHASE 17.7 BUG FIX: classifyCapturedPayment() deliberately returns
    // outcome:"pending_review" for THREE distinct reasons — reviewReason
    // "amount_mismatch", "currency_mismatch", AND "captured_no_order" (see
    // that function's own doc comment: "this module only classifies; the
    // I/O layer decides whether/when an actual order-creation attempt
    // happens"). "captured_no_order" is the CLEAN, fully-verified,
    // recoverable case — exactly what this function exists to act on.
    // This branch previously matched on `outcome === "pending_review"`
    // alone, which caught "captured_no_order" too and returned early with
    // a mislabeled "currency_mismatch" error — meaning the clean-recovery
    // code path below could NEVER be reached, for ANY payment, ever. The
    // admin "Recover" action was structurally incapable of succeeding.
    // Found by a real integration test exercising this exact branch
    // against a mocked-but-realistic Razorpay response (never a real
    // provider call) — see
    // paymentRecoverySuccess.integration.test.ts.
    if (classification.outcome === "pending_review" && classification.reviewReason !== "captured_no_order") {
        await PendingPayment.updateOne(
            { _id: pendingId },
            { $set: { reconciliationState: "pending_review", reviewReason: classification.reviewReason, reviewedAt: new Date() }, $inc: { recoveryAttempts: 1 } }
        );
        const reason = classification.reviewReason === "amount_mismatch" ? "amount_mismatch" : "currency_mismatch";
        return {
            ok: false,
            reason,
            message: reason === "amount_mismatch"
                ? "The captured amount does not match the expected charge. Recovery blocked — requires manual investigation."
                : "The captured payment currency does not match the expected currency. Recovery blocked — requires manual investigation.",
        };
    }

    // ── Clean case: captured, amount/currency match, no order yet ─────────
    const claimed = await claimPendingPayment(pending.razorpayOrderId, captured.id);

    if (!claimed) {
        // Someone else (webhook, verify, or a concurrent recovery click)
        // is already processing this exact payment right now.
        const resolved = await waitForCompletion(pending.razorpayOrderId, 6, 400);
        if (resolved) {
            await PendingPayment.updateOne(
                { _id: pendingId },
                { $set: { reconciliationState: "recovered", reviewedAt: new Date(), reviewedBy: adminUserId } }
            );
            return { ok: true, alreadyResolved: true, orderId: resolved.orderId };
        }
        return { ok: false, reason: "claim_lost_still_processing", message: "Another process is already handling this payment. Refresh shortly." };
    }

    try {
        const result = await createOrderFromPendingPayment(claimed, captured.id);

        // Never trust the function's return value alone — read back the
        // persisted PendingPayment state to confirm it actually landed.
        const verified = await PendingPayment.findById(pendingId).select("status orderId").lean<{ status: string; orderId: string | null }>();
        if (verified?.status !== "completed" || !verified.orderId) {
            // Extremely defensive — createOrderFromPendingPayment's own
            // markCompleted() should guarantee this, but never report
            // success on an unverified write.
            console.error("RECONCILE_RECOVERY_UNVERIFIED_COMPLETION", { pendingId, orderId: result.orderId });
            return { ok: false, reason: "recovery_failed", message: "Order was created but completion could not be verified — check Admin > Orders manually before retrying." };
        }

        await PendingPayment.updateOne(
            { _id: pendingId },
            { $set: { reconciliationState: "recovered", reviewedAt: new Date(), reviewedBy: adminUserId }, $inc: { recoveryAttempts: 1 } }
        );
        return { ok: true, alreadyResolved: false, orderId: verified.orderId, result };
    } catch (err) {
        // createOrderFromPendingPayment already called releaseClaim() —
        // status is back to "failed". Record the reconciliation-specific
        // outcome on top of that.
        const message = sanitizeRecoveryError(err);
        await PendingPayment.updateOne(
            { _id: pendingId },
            { $set: { reconciliationState: "recovery_failed", lastRecoveryError: message, reviewedAt: new Date(), reviewedBy: adminUserId }, $inc: { recoveryAttempts: 1 } }
        );
        await extendRetention(pendingId);
        return { ok: false, reason: "recovery_failed", message };
    }
}

export interface DismissOutcome {
    ok: boolean;
    message: string;
}

/**
 * Explicit admin disposition for a flagged case WITHOUT creating an order
 * (e.g. confirmed manually refunded, confirmed duplicate of another real
 * order, confirmed handled out-of-band). Requires a non-empty note — this
 * is a financial audit trail, not a silent dismissal. Never usable to
 * dismiss a row that has already been auto/manually recovered.
 */
export async function dismissReconciliation(pendingId: string, adminUserId: string, note: string): Promise<DismissOutcome> {
    const trimmedNote = note.trim();
    if (trimmedNote.length < 5) {
        return { ok: false, message: "A note of at least 5 characters is required to dismiss a reconciliation case." };
    }

    const pending = await PendingPayment.findById(pendingId).select("status reconciliationState").lean<{ status: string; reconciliationState: ReconciliationState }>();
    if (!pending) return { ok: false, message: "Payment record no longer exists." };

    if (pending.status === "completed") {
        return { ok: false, message: "This payment already has an order — refresh the page." };
    }
    if (!canDismiss(pending.reconciliationState)) {
        return { ok: false, message: `Cannot dismiss a case in state "${pending.reconciliationState ?? "unreviewed"}".` };
    }

    await PendingPayment.updateOne(
        { _id: pendingId, status: { $ne: "completed" } },
        { $set: { reconciliationState: "dismissed", reviewNote: trimmedNote, reviewedAt: new Date(), reviewedBy: adminUserId } }
    );
    return { ok: true, message: "Case dismissed." };
}
