// src/models/RateLimitHit.ts
//
// Minimal, serverless-safe rate-limit counter — same DB-backed pattern
// already used by LoginAttempt (src/models/LoginAttempt.ts) and the OTP
// request-window fields on PendingSignup/User.passwordReset, instead of an
// in-memory counter (which resets per cold start / per Vercel instance and
// so is not reliable here) or introducing Redis (explicitly out of scope
// for Phase 3 — see task constraints).
//
// One document per (key, windowStart). `key` is caller-defined, e.g.
// `track-order:<ip>` or `review-submit:<ip>`, so unrelated endpoints never
// share a counter.

import { Schema, model, models } from "mongoose";

const RateLimitHitSchema = new Schema(
    {
        key:         { type: String, required: true, unique: true, index: true },
        count:       { type: Number, default: 0 },
        windowStart: { type: Date, required: true },
    },
    { timestamps: true }
);

// Auto-expire 1 hour after last write — these are short-lived counters, not
// an audit trail.
RateLimitHitSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 });

const RateLimitHit = models.RateLimitHit || model("RateLimitHit", RateLimitHitSchema);

export default RateLimitHit;
