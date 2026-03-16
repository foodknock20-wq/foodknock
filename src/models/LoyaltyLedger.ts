// src/models/LoyaltyLedger.ts
// Immutable append-only ledger.
// Every credit and debit creates one entry.  The `points` field is positive
// for credits and negative for debits/redemptions.
// `balanceAfter` is a snapshot of User.loyaltyPoints taken immediately after
// the corresponding $inc — useful for building a running statement.

import mongoose, { Schema, model, models } from "mongoose";

export type LedgerType =
    | "order_reward"        // earned when order is delivered
    | "referral_referrer"   // paid to the user who shared their code
    | "referral_referee"    // welcome bonus to the newly referred user
    | "redemption"          // spent at checkout (negative)
    | "admin_credit"        // manual positive adjustment
    | "admin_debit"         // manual negative adjustment
    | "expiry";             // future use

const LoyaltyLedgerSchema = new Schema(
    {
        user: {
            type:     Schema.Types.ObjectId,
            ref:      "User",
            required: true,
            index:    true,
        },
        type: {
            type:     String,
            enum:     [
                "order_reward",
                "referral_referrer",
                "referral_referee",
                "redemption",
                "admin_credit",
                "admin_debit",
                "expiry",
            ],
            required: true,
        },
        // Signed delta.  Positive = credit, negative = debit.
        // NO min/max validators — see note in User.ts for the same reason.
        points: {
            type:     Number,
            required: true,
        },
        // Running balance snapshot immediately after this entry.
        balanceAfter: {
            type:     Number,
            required: true,
            default:  0,
        },
        // Optional: the order that triggered this entry
        order: {
            type:    Schema.Types.ObjectId,
            ref:     "Order",
            default: null,
        },
        // Optional: for referral entries, the other party
        referredUser: {
            type:    Schema.Types.ObjectId,
            ref:     "User",
            default: null,
        },
        note: {
            type:    String,
            trim:    true,
            default: "",
        },
    },
    {
        timestamps: true,
        strict:     true,
    }
);

// Per-user statement query (most recent first)
LoyaltyLedgerSchema.index({ user: 1, createdAt: -1 });

// Idempotency index: at most one `order_reward` entry per orderId
// sparse: true so null `order` values don't conflict
LoyaltyLedgerSchema.index({ order: 1, type: 1 }, { sparse: true });

const LoyaltyLedger = models.LoyaltyLedger || model("LoyaltyLedger", LoyaltyLedgerSchema);

export default LoyaltyLedger;