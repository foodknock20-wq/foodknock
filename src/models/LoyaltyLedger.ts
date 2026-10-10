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
    | "expiry"               // future use
    // Phase 12 — Digital Spin & Win. Deliberately distinct from
    // "redemption" (checkout) so the two flows are never confused in a
    // user's statement or in debugging.
    | "spin_cost"            // 50-point debit to pay for one spin
    | "spin_refund"          // compensating credit if reward issuance failed after the debit
    | "spin_reward_points"   // credit when the won reward IS loyalty points
    // Phase 14 — compensating credit when a cancelled order had redeemed
    // points at checkout. Deliberately distinct from "redemption" (the
    // original debit stays in the ledger unchanged — this is a reversal
    // entry, not an edit) and from "admin_credit" (system-triggered by
    // cancellation, not a manual adjustment).
    | "redemption_reversal";

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
                "spin_cost",
                "spin_refund",
                "spin_reward_points",
                "redemption_reversal",
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
        // ── Phase 17.1B follow-up: claim/finalize state ───────────────────
        // Additive/optional, defaults to "completed" so every pre-existing
        // historical row (and every admin_credit/admin_debit/spin_* row,
        // which never go through the claim mechanism at all) reads as
        // already-finalized with zero migration needed. ONLY the
        // order-linked claim path in _applyPoints() (loyaltyService.ts)
        // ever explicitly writes "pending" — see that file's header
        // comment for the full claim -> completed/rollback state machine
        // this field drives, and loyaltyLogic.ts's resolveStaleClaim() for
        // how a stuck "pending" row is safely disambiguated, never guessed.
        status: {
            type:    String,
            enum:    ["pending", "completed"],
            default: "completed",
        },
    },
    {
        timestamps: true,
        strict:     true,
    }
);

// Per-user statement query (most recent first)
LoyaltyLedgerSchema.index({ user: 1, createdAt: -1 });

// Non-unique lookup index: used by handleOrderDelivered()'s idempotency
// check, which queries by {order, type} WITHOUT `user` — kept as-is
// alongside the new unique index below, which can't serve that exact
// query shape (it requires `user` as its first key).
// sparse: true so null `order` values don't conflict.
LoyaltyLedgerSchema.index({ order: 1, type: 1 }, { sparse: true });

// ── Phase 17.1B — DB-ENFORCED idempotency for order-linked operations ────
// Previously, "at most one entry per (user, order, type)" was only ever a
// CALLER-level check-then-insert (LoyaltyLedger.exists() followed by a
// separate .create()) — a real race window where two concurrent calls for
// the same logical operation (e.g. two redemption attempts racing for the
// same order) could both pass the exists() check and both insert.
//
// partialFilterExpression restricts this constraint to documents where
// `order` is an actual ObjectId — i.e. only the order-scoped types
// (order_reward / redemption / referral_referrer / referral_referee /
// redemption_reversal — see loyaltyLogic.ts's ORDER_LINKED_LEDGER_TYPES,
// which MUST stay in sync with this filter's intent). admin_credit /
// admin_debit / spin_cost / spin_refund / spin_reward_points / expiry all
// have `order: null` and are correctly left unconstrained by this index —
// those legitimately repeat many times for the same user over time.
LoyaltyLedgerSchema.index(
    { user: 1, order: 1, type: 1 },
    {
        unique: true,
        partialFilterExpression: { order: { $type: "objectId" } },
        name: "user_order_type_unique",
    }
);

// ── Stale-model-cache guard (same pattern/rationale as User.ts) ───────────
// `models.LoyaltyLedger || model(...)` reuses whatever got compiled FIRST
// in this process. A dev server kept running (or hot-reloaded) across the
// Phase 12 edit that added spin_cost/spin_refund/spin_reward_points to the
// enum below would still be holding the OLD compiled schema in memory —
// Mongoose's enum validator rejects any value not in ITS copy of the list,
// regardless of what the source file now says. This is the confirmed root
// cause of "LoyaltyLedger validation failed: type: 'spin_cost' is not a
// valid enum value" — not a logic bug in the spin code itself. Detect the
// stale enum and force a clean recompile; a no-op on every fresh process
// (production cold start, or any dev session started after this fix).
if (models.LoyaltyLedger) {
    const typePath = models.LoyaltyLedger.schema.path("type") as unknown as { enumValues?: string[] };
    const hasStalePath = !typePath?.enumValues?.includes("redemption_reversal") || !models.LoyaltyLedger.schema.path("status");
    if (hasStalePath) {
        mongoose.deleteModel("LoyaltyLedger");
    }
}

const LoyaltyLedger = models.LoyaltyLedger || model("LoyaltyLedger", LoyaltyLedgerSchema);

export default LoyaltyLedger;