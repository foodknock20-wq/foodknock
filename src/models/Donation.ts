// src/models/Donation.ts
//
// Pre-Phase 17 — Phase 2: Street Animal Support donation.
//
// A completely independent financial record from Order/PendingPayment —
// deliberately NOT linked into the food-order Razorpay amount, totalAmount,
// coupon, or loyalty calculations (see src/lib/donations.ts). One document
// per donation attempt; the authoritative, permanent record IS this
// document (unlike PendingPayment, which is a short-lived reconciliation
// aid for the food-order flow and TTLs out after 48h — a donation must
// never expire/disappear).
//
// Atomicity / idempotency — same proven pattern as PendingPayment
// (src/models/PendingPayment.ts):
//   razorpayOrderId is unique — one Donation per checkout attempt.
//   razorpayPaymentId is unique + sparse and is only ever set via a single
//   conditional findOneAndUpdate({razorpayPaymentId: {$exists:false},
//   status:"pending"}) — see settleDonationSuccess() in
//   src/lib/donations.ts. Unlike the food-order flow, settling a donation
//   has no further side effects (no order to create), so claim and
//   completion happen in that one atomic update — no separate two-phase
//   claim-then-create needed.

import { Schema, model, models } from "mongoose";

const DonationSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        amountPaise: { type: Number, required: true, min: 3000 }, // ₹30 floor, enforced again in app code
        currency: { type: String, default: "INR" },

        status: {
            type: String,
            enum: ["pending", "success", "failed", "cancelled"],
            default: "pending",
            index: true,
        },

        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        // Set ONLY via the atomic settle update — unique + sparse so pending
        // rows (which omit the field) never collide.
        razorpayPaymentId: {
            type: String,
            unique: true,
            sparse: true,
        },

        // Informational only — a food order this donation was made alongside,
        // when safely available. Donation success is never dependent on it.
        linkedOrderId: { type: String, default: null },

        failureReason: { type: String, default: "" },
        verifiedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Admin/customer list reads: "my donations" / "recent donations" ordering.
DonationSchema.index({ userId: 1, createdAt: -1 });
DonationSchema.index({ status: 1, createdAt: -1 });

const Donation = models.Donation || model("Donation", DonationSchema);

export default Donation;
