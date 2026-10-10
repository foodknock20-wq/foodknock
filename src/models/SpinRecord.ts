// src/models/SpinRecord.ts
//
// Phase 12 — immutable history of every COMPLETED Digital Spin. Only
// written on success (see src/lib/spin.ts) — a failed spin (reward
// issuance error) is refunded and leaves no record, so a user's spin
// history only ever shows spins that actually paid out something real.
//
// Reward fields are a SNAPSHOT (label/type/value copied from
// SpinRewardConfig at the moment of the spin) — an admin later editing or
// deactivating that config entry must never alter historical records,
// exactly like Order's coupon/offer snapshots.

import { Schema, model, models } from "mongoose";

const SpinRecordSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        pointsCost: { type: Number, required: true, min: 0 },

        rewardConfigId: { type: Schema.Types.ObjectId, ref: "SpinRewardConfig", default: null },
        rewardLabel:    { type: String, required: true },
        rewardType:     { type: String, required: true },
        rewardValue:    { type: Number, required: true },

        // Set when the reward issued a coupon (discount/free-delivery types).
        couponId: { type: Schema.Types.ObjectId, ref: "Coupon", default: null },
        // Set when the reward was LOYALTY_POINTS instead.
        pointsAwarded: { type: Number, default: 0 },

        // Phase 12 finalization — client-supplied, lets a dropped-response
        // retry be detected and replayed instead of spinning again. Null
        // for any spin where the client didn't send one (never required).
        idempotencyKey: { type: String, default: null },

        // Spin & Eat — the ₹100 qualifying-spend band (see
        // src/lib/spin.ts's getCurrentSpendBand) this spin's special
        // band-gated reward (currently ₹200 OFF) was granted under. Null
        // for every spin that didn't grant a band-gated reward — this is
        // the field hasConsumedSpecialBand() checks to block a second grant
        // for the same band.
        specialBand: { type: Number, default: null },
    },
    { timestamps: true }
);

SpinRecordSchema.index({ user: 1, createdAt: -1 });
// Eligibility check: "has this user already consumed the special reward
// for band N" — sparse since most spins never set specialBand at all.
SpinRecordSchema.index({ user: 1, specialBand: 1 }, { sparse: true });
// Sparse — only indexes documents that actually have a key, and scoped to
// (user, key) rather than a global unique key so two different users could
// theoretically reuse the same client-generated key without colliding.
SpinRecordSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

const SpinRecord = models.SpinRecord || model("SpinRecord", SpinRecordSchema);

export default SpinRecord;
