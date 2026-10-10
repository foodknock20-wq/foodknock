// src/models/Order.ts
// FIXED: razorpayPaymentId / razorpayOrderId have NO default: null
//        so the fields are never written to MongoDB unless explicitly set.
//        This prevents E11000 duplicate-key errors on the sparse unique index.

import mongoose, { Schema, model, models } from "mongoose";

const OrderItemSchema = new Schema(
    {
        productId: {
            type:     Schema.Types.ObjectId,
            ref:      "Product",
            required: false,
            default:  null,
        },
        name:     { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        price:    { type: Number, required: true, min: 0 },
        image:    { type: String, default: "" },
    },
    { _id: false }
);

const OrderSchema = new Schema(
    {
        orderId: {
            type:     String,
            required: true,
            unique:   true,
            index:    true,
        },

        user: {
            type:     Schema.Types.ObjectId,
            ref:      "User",
            required: false,
            default:  null,
        },

        customerName: { type: String, required: true, trim: true },
        phone:        { type: String, required: true, trim: true },
        address:      { type: String, required: true, trim: true },
        landmark:     { type: String, default: "", trim: true },

        orderType: {
            type:    String,
            enum:    ["delivery", "pickup"],
            default: "delivery",
        },

        items: { type: [OrderItemSchema], required: true },

        totalAmount: { type: Number, required: true, min: 0 },
        deliveryFee: { type: Number, default: 0, min: 0 },
        platformFee: { type: Number, default: 0, min: 0 },

        // ── Phase 10: delivery location snapshot ────────────────────────────
        // Additive, optional — historical orders simply don't have these.
        // NEVER recalculated retroactively when admin changes kitchen
        // coordinates/radius/fees later; this is what was true AT ORDER TIME.
        deliveryLatitude:   { type: Number, default: null },
        deliveryLongitude:  { type: Number, default: null },
        distanceKm:         { type: Number, default: null },
        freeDeliveryReason: { type: String, default: null },
        // Phase 10B — rider-facing delivery guidance, distinct from the
        // general order `note`. Additive/optional; historical orders
        // simply don't have it.
        deliveryInstructions: { type: String, default: "", trim: true },

        // ── Loyalty redemption ─────────────────────────────────────────────
        redeemedPoints: { type: Number, default: 0, min: 0 },
        redeemedAmount: { type: Number, default: 0, min: 0 },

        // ── Phase 17.1B: durable record of a failed post-order-creation
        // loyalty deduction ──────────────────────────────────────────────
        // Additive/optional — historical orders simply don't have this.
        // Set by createOrderCore.ts ONLY when redeemedPoints > 0 was
        // recorded on this order but the corresponding redeemPoints() call
        // afterward threw (see createOrderCore.ts's loyalty-deduction
        // block). NEVER set as a side effect of a successful redemption —
        // this field existing at all is itself the signal something needs
        // attention. resolvedAt is set by retryFailedLoyaltyRedemption()
        // (src/lib/loyaltyService.ts) once the ledger/balance has actually
        // been confirmed consistent — never fabricated, never set as a
        // side effect of merely reading this field.
        loyaltyRedemptionFailure: {
            failedAt:   { type: Date, default: null },
            reason:     { type: String, default: "" },
            resolvedAt: { type: Date, default: null },
        },

        // ── Phase 11: coupon snapshot ────────────────────────────────────────
        // Additive, optional — historical orders simply don't have this.
        // NEVER recalculated from the current Coupon document (which may
        // later be edited, paused, or have its config changed) — this is
        // what was true AT ORDER TIME, exactly like the Phase 10 delivery
        // snapshot above.
        coupon: {
            couponId:      { type: Schema.Types.ObjectId, ref: "Coupon", default: null },
            code:          { type: String, default: null },
            discountType:  { type: String, default: null },
            discountValue: { type: Number, default: null },
            discountAmount: { type: Number, default: 0 },
        },

        // ── Phase 12: automatic campaign-offer snapshot ─────────────────────
        // Mutually exclusive with `coupon` above (one discount source per
        // order — see Offer.ts). Additive/optional; never recalculated from
        // the current Offer document later.
        offer: {
            offerId:        { type: Schema.Types.ObjectId, ref: "Offer", default: null },
            campaignId:     { type: Schema.Types.ObjectId, ref: "Campaign", default: null },
            name:           { type: String, default: null },
            discountType:   { type: String, default: null },
            discountValue:  { type: Number, default: null },
            discountAmount: { type: Number, default: 0 },
        },

        note: { type: String, default: "", trim: true },

        status: {
            type:    String,
            enum:    ["received", "preparing", "out_for_delivery", "delivered", "cancelled"],
            default: "received",
        },

        paymentMethod: {
            type:    String,
            enum:    ["cod", "razorpay"],
            default: "cod",
        },

        // ── Razorpay fields ────────────────────────────────────────────────
        // NO `default: null` on either field.
        // When absent the key is simply not stored, which means the sparse
        // unique index on razorpayPaymentId correctly ignores those documents.
        // Multiple COD orders can coexist without any index collision.
        razorpayOrderId: {
            type:  String,
            index: true,
            // intentionally no default
        },

        razorpayPaymentId: {
            type:   String,
            unique: true,
            sparse: true,
            // intentionally no default
        },

        whatsappSent: {
            type:    Boolean,
            default: false,
        },

        isFirstDeliveryFreeApplied: {
            type:    Boolean,
            default: false,
        },

        // ── Phase 14: cancellation record ────────────────────────────────────
        // Additive/optional — historical pre-Phase-14 orders simply don't have
        // this. Only ever written once, atomically, together with the
        // "cancelled" status write itself (see changeOrderStatus()) so an
        // order can never end up "cancelled" without a reason recorded.
        // stockRestoredAt / loyaltyReversedAt are idempotency markers for the
        // compensating actions below (src/lib/orderCancellation.ts) — each is
        // set via its own conditional update guarded on being unset, so a
        // retried/duplicate cancellation request can never double-restore
        // stock or double-reverse a loyalty redemption.
        cancellation: {
            reason:          { type: String, default: null },
            note:            { type: String, default: "", trim: true },
            cancelledAt:     { type: Date, default: null },
            cancelledBy: {
                type:   { type: String, enum: ["customer", "admin", "system"], default: null },
                userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
            },
            stockRestoredAt:   { type: Date, default: null },
            loyaltyReversedAt: { type: Date, default: null },
            // "not_applicable" (COD, or no payment captured) | "pending_manual"
            // (Razorpay payment was captured — no automated refund exists yet,
            // see Phase 14 audit §5; requires manual processing via the
            // Razorpay dashboard) | "completed" (reserved for when/if real
            // refund automation is built — never set by current code).
            refundStatus: { type: String, enum: ["not_applicable", "pending_manual", "completed"], default: "not_applicable" },
        },

        // ── Phase 15C: soft-archive (operational removal, never financial
        // destruction) ───────────────────────────────────────────────────────
        // Additive/optional — historical orders simply don't have this
        // (reads as null, same as "not archived"). Set only via the
        // server-enforced delete authority (src/lib/orderDeletion.ts) when
        // a hard delete would orphan LoyaltyLedger/CouponRedemption/payment
        // references. Archived orders are excluded from the default admin
        // list query but remain fully intact in the database — nothing
        // about their financial/audit data is touched.
        archivedAt: { type: Date, default: null },

        // ── Phase 14: status history ─────────────────────────────────────────
        // Additive/optional — historical orders simply have an empty array.
        // Appended to atomically alongside every status write in
        // changeOrderStatus() — never written anywhere else. This is a
        // lightweight audit trail ("what happened, when, who"), not an
        // event-sourcing system.
        statusHistory: [
            {
                _id:       false,
                status:    { type: String, required: true },
                changedAt: { type: Date, required: true },
                changedBy: {
                    type:   { type: String, enum: ["customer", "admin", "system"], default: "system" },
                    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
                },
                reason: { type: String, default: null },
            },
        ],
    },
    { timestamps: true }
);

OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ phone: 1 });

// ── Stale-model-cache guard (same pattern/rationale as User.ts /
// LoyaltyLedger.ts) ──────────────────────────────────────────────────────
// `mongoose.models.Order` persists across dev-server hot reloads. A
// process that was already running when `archivedAt` (Phase 15C) was
// added is still holding the OLD compiled schema in memory — Mongoose's
// default strict mode silently DROPS any field not in its cached schema
// on write, so `{$set:{archivedAt: ...}}` would appear to succeed but
// never actually persist. Detect that stale state and force a clean
// recompile; a no-op on every fresh process (production cold start, or
// any dev session started after this field existed).
if (
    models.Order &&
    (!models.Order.schema.path("archivedAt") || !models.Order.schema.path("loyaltyRedemptionFailure.failedAt"))
) {
    mongoose.deleteModel("Order");
}

const Order = models.Order || model("Order", OrderSchema);

export default Order;
