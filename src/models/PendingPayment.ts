// src/models/PendingPayment.ts
//
// ── RAZORPAY PAYMENT → ORDER RECONCILIATION ─────────────────────────────────
//
// Problem this solves:
//   Previously, /api/payment/create-order only received {price, quantity}
//   per item and NEVER received customerName/phone/address at all — so even
//   in principle, nothing server-side could reconstruct a FoodKnock order if
//   the client's post-payment /api/payment/verify call never completed
//   (browser closed, network dropped, etc.). The Razorpay webhook was a
//   no-op stub for exactly this reason: it had no trusted order context to
//   work with.
//
// Fix:
//   /api/payment/create-order now persists ONE PendingPayment document per
//   Razorpay order, holding the exact server-validated pricing + full
//   checkout context (items/customer/address) needed to call
//   createOrderCore() later — from EITHER the client's /verify call OR the
//   webhook — without ever trusting re-submitted client data for recovery.
//
// Atomicity / idempotency:
//   razorpayOrderId is unique — one PendingPayment per checkout attempt.
//   razorpayPaymentId is unique + sparse and is only ever set via a single
//   conditional findOneAndUpdate({razorpayPaymentId: {$exists:false}}) —
//   this IS the atomic claim mechanism that lets the client-verify path and
//   the webhook path race safely: whichever caller sets the field first
//   "wins" and proceeds to create the order; the other sees the update
//   match 0 documents and backs off (poll / no-op).
//
// TTL:
//   Documents auto-expire 48h after creation (mirrors PendingSignup's 24h
//   TTL pattern already used in this codebase). Razorpay retries webhooks
//   for a bounded window well under 48h, so this is a safe cleanup horizon
//   that doesn't risk deleting a record before reconciliation can happen.
//   The authoritative, permanent record of a completed payment is always
//   the Order document itself — PendingPayment is only a short-lived
//   reconciliation aid.
//
// ── PHASE 17.1A — RECONCILIATION / RETENTION EXTENSION ──────────────────────
// Audit finding F1: a payment captured by Razorpay that never produces an
// Order (client never calls /verify, webhook mis-fires or is misconfigured,
// stock/DB failure exhausts Razorpay's retry window) relied on this SAME
// 48h TTL — which deleted the only evidence needed to investigate before
// anyone could notice. Fix, additive/minimal, zero change to existing
// fields' meaning or the existing verify/webhook code paths:
//
//   expiresAt — NEW. Replaces the old fixed `createdAt + 48h` TTL index
//     with a per-document Date the reconciliation scanner can push forward.
//     Defaults to createdAt + 48h (byte-for-byte the same effective
//     retention as before) for every row that resolves normally. ONLY a
//     row that reconciliation confirms is a genuine captured-but-orphaned
//     payment ever gets this extended (see src/lib/paymentReconciliationLogic.ts
//     computeExtendedExpiry — monotonic, never moves backward). A plain
//     abandoned checkout (nothing captured) is untouched and still expires
//     on schedule — this is deliberate; only money-received cases are worth
//     retaining indefinitely.
//
//   reconciliationState / reviewReason / reviewNote / reviewedAt /
//   reviewedBy / recoveryAttempts / lastRecoveryError — NEW, all additive
//     and default null/0/"" so every pre-existing row is simply untouched
//     (reads as "never examined by reconciliation", same as a fresh row).
//     Managed exclusively by src/lib/paymentReconciliation.ts's new
//     scan/recover/dismiss functions — the existing claimPendingPayment /
//     releaseClaim / markCompleted functions (used by /api/payment/verify
//     and /api/payment/webhook) are completely unmodified and never read
//     or write these fields, so the fast (normal) payment path has zero
//     behavior change.
//
// INDEX DEPLOYMENT NOTE (not executed by this change — see Phase 17.1A
// delivery report §I): Mongoose does not alter an already-existing index
// on a live collection just because the schema definition changed. The old
// `{createdAt:1}` TTL index and this new `{expiresAt:1}` TTL index are
// DIFFERENT indexes — both will exist simultaneously after a deploy until
// the old one is explicitly dropped. Until that manual step is done in the
// target environment, the OLD createdAt-based 48h TTL remains active in
// parallel and would still delete a row at 48h regardless of expiresAt.
// Dropping the old index is therefore REQUIRED (not optional) for this fix
// to actually take effect — see deployment instructions.

import { Schema, model, models } from "mongoose";
import { computeDefaultExpiry } from "@/lib/paymentReconciliationLogic";

const PendingPaymentItemSchema = new Schema(
    {
        _id:      { type: String, required: true },
        name:     { type: String, required: true, trim: true },
        price:    { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
        image:    { type: String, default: "" },
    },
    { _id: false }
);

const PendingPaymentSchema = new Schema(
    {
        // Set at creation (Step 1 of the Razorpay flow). Unique — one row
        // per checkout attempt / Razorpay order.
        razorpayOrderId: {
            type:     String,
            required: true,
            unique:   true,
            index:    true,
        },

        // Set ONLY via the atomic claim update. Unique + sparse so it never
        // collides with other pending rows (which simply omit the field).
        razorpayPaymentId: {
            type:   String,
            unique: true,
            sparse: true,
        },

        status: {
            type:    String,
            enum:    ["created", "processing", "completed", "failed"],
            default: "created",
            index:   true,
        },

        // Server-computed authoritative charge amount (rupees) from
        // create-order — the only trustworthy figure to validate a
        // webhook-reported payment amount against during recovery.
        expectedAmount: { type: Number, required: true, min: 0 },

        // FoodKnock order id (short display id, e.g. "FK-XXXX") once the
        // order has actually been created.
        orderId: { type: String, default: null },

        failureReason: { type: String, default: "" },

        // Everything createOrderCore() needs, captured once, trusted since
        // it mirrors exactly what was used to compute expectedAmount.
        payload: {
            customerName:          { type: String, required: true, trim: true },
            phone:                 { type: String, required: true, trim: true },
            address:               { type: String, default: "", trim: true },
            landmark:              { type: String, default: "", trim: true },
            note:                  { type: String, default: "", trim: true },
            orderType:             { type: String, required: true },
            items:                 { type: [PendingPaymentItemSchema], required: true },
            linkedUserId:          { type: String, default: null },
            validatedRedeemPoints: { type: Number, default: 0 },
            // Phase 10 — delivery coordinates, additive/optional so this
            // schema stays backward-compatible with any in-flight row
            // created before this field existed.
            latitude:              { type: Number, default: null },
            longitude:             { type: Number, default: null },
            deliveryInstructions:  { type: String, default: "", trim: true },
            // Phase 11 — coupon discount LOCKED at the same instant the
            // Razorpay charge amount was computed (create-order), exactly
            // like item prices are locked above. createOrderCore trusts
            // this discountAmount as-is — it does NOT re-run
            // calculateCouponDiscount() a second time. It DOES still
            // perform the atomic usage reservation fresh at order-creation
            // time (see src/lib/coupons.ts) — the amount is a snapshot,
            // the usage slot is a live resource.
            couponId:              { type: String, default: null },
            couponCode:            { type: String, default: null },
            couponDiscountType:    { type: String, default: null },
            couponDiscountValue:   { type: Number, default: null },
            couponDiscountAmount:  { type: Number, default: 0 },
            // Phase 12 — automatic offer snapshot (mutually exclusive with
            // the coupon fields above — see Offer.ts stacking rule).
            offerId:               { type: String, default: null },
            offerCampaignId:       { type: String, default: null },
            offerName:             { type: String, default: null },
            offerDiscountType:     { type: String, default: null },
            offerDiscountValue:    { type: Number, default: null },
            offerDiscountAmount:   { type: Number, default: 0 },
        },

        // ── Phase 17.1A — retention + reconciliation (see file header) ─────
        expiresAt: {
            type:    Date,
            // `this.createdAt` isn't populated yet on first save (timestamps
            // plugin sets it in the same pre-save hook chain) — Mongoose
            // runs default functions with `this` bound to the document
            // being created, and `timestamps:true` has already assigned
            // createdAt by the time defaults for other paths are resolved
            // on insert. Falls back to "now" only if that ever isn't true,
            // which still yields the same ~48h horizon (negligible skew).
            default: function (this: { createdAt?: Date }) {
                return computeDefaultExpiry(this.createdAt ?? new Date());
            },
        },

        reconciliationState: {
            type:    String,
            enum:    ["pending_review", "recovered", "recovery_failed", "dismissed"],
            default: null,
            index:   true,
        },
        reviewReason:      { type: String, default: null },
        reviewNote:        { type: String, default: "", trim: true },
        reviewedAt:        { type: Date, default: null },
        reviewedBy:        { type: Schema.Types.ObjectId, ref: "User", default: null },
        recoveryAttempts:  { type: Number, default: 0, min: 0 },
        lastRecoveryError: { type: String, default: "" },
    },
    { timestamps: true }
);

// TTL cleanup — PHASE 17.1A: now driven by the per-document `expiresAt`
// field instead of a fixed `createdAt + 48h` window, specifically so the
// reconciliation scanner can push a confirmed captured-but-orphaned row's
// expiry forward (see computeExtendedExpiry) without affecting any other
// row. `expireAfterSeconds: 0` tells MongoDB's TTL monitor to delete a
// document as soon as `expiresAt` itself is in the past — the "how long
// from now" logic lives entirely in the field's value, not the index.
//
// DEPLOYMENT: this REPLACES the old `{createdAt:1}` TTL index. Creating
// this new index does not remove the old one on an already-deployed
// collection — see the file-header "INDEX DEPLOYMENT NOTE" and the Phase
// 17.1A delivery report for the required manual index-drop step.
PendingPaymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingPayment = models.PendingPayment || model("PendingPayment", PendingPaymentSchema);

export default PendingPayment;
