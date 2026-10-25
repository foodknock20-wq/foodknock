// src/models/PromotionEligibility.ts
//
// ── Recreation-proof promotion eligibility ledger ────────────────────────
//
// WHY THIS EXISTS
//   First-order free delivery was previously keyed ONLY on the User
//   document (firstDeliveryFreeUsed + deliveredOrderCount). Deleting an
//   account and signing up again produced a brand-new User with both
//   fields reset — so the benefit could be farmed indefinitely by the
//   delete→recreate loop. This collection survives account deletion and
//   is consulted on every eligibility check so a returning identity that
//   already consumed the benefit cannot reclaim it.
//
// PRIVACY NOTE (see Privacy Policy + src/lib/promotionEligibility.ts)
//   `identifierHash` is a KEYED HMAC-SHA256 of the user's normalized,
//   verified email (email is the only identifier verified at signup —
//   phone is never verified; see verify-signup-otp/route.ts). It is a
//   pseudonymous identifier, NOT anonymous: with the server-side secret
//   it is linkable back to an email, so it is treated as personal data.
//   The raw email is NEVER stored here, never logged, and never exposed
//   to clients/admin UI. Only the minimum state required to prevent
//   benefit re-grant is kept.
//
// This ledger is intentionally SEPARATE from all financial/revenue
// records — deleting it would only re-open the exploit, never alter any
// historical money figure.

import { Schema, model, models } from "mongoose";

const PromotionEligibilitySchema = new Schema(
    {
        // Keyed HMAC of the normalized verified email. Unique so a given
        // identity has exactly one ledger row regardless of how many times
        // the account is deleted and recreated.
        identifierHash: { type: String, required: true, unique: true, index: true },

        // Minimum state: has the first-order free-delivery benefit already
        // been consumed by this identity on a genuinely placed order?
        firstDeliveryConsumed:   { type: Boolean, default: false },
        firstDeliveryConsumedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

const PromotionEligibility =
    models.PromotionEligibility || model("PromotionEligibility", PromotionEligibilitySchema);

export default PromotionEligibility;
