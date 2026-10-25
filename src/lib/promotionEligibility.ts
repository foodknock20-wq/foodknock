// src/lib/promotionEligibility.ts
//
// Server-only helpers for the recreation-proof promotion eligibility
// ledger (see src/models/PromotionEligibility.ts for the data model and
// the privacy rationale).
//
// ── Identifier choice ────────────────────────────────────────────────────
// We key on the user's EMAIL, because email is the only identifier that is
// actually VERIFIED during signup (an OTP is mailed and must be entered —
// see src/app/api/auth/verify-signup-otp/route.ts). The phone number is
// collected but never verified, so it is not proof of identity and must
// not be used to deny a promotion. Email is also the unique key on the
// User model, so one verified email == one identity.
//
// ── Secret ────────────────────────────────────────────────────────────────
// The HMAC key comes from PROMO_ELIGIBILITY_SECRET. If that env var is not
// set we fall back to JWT_SECRET (already required for the app to boot) so
// the feature works out-of-the-box on existing deployments without a
// silent new hard requirement. Rotating the secret re-keys every hash and
// therefore resets the ledger's matching ability — see README / final
// report. The secret value is NEVER logged or returned anywhere.

import { connectDB } from "@/lib/db";
import PromotionEligibility from "@/models/PromotionEligibility";
import { hashIdentifier } from "@/lib/promotionEligibilityHash";

// Re-exported so existing importers of hashIdentifier from this module keep
// working; the implementation lives in the db-free promotionEligibilityHash
// module so it can be unit-tested in isolation.
export { hashIdentifier };

/**
 * Has this identity ALREADY consumed first-order free delivery on a prior
 * (possibly since-deleted) account? Read-only. Fails OPEN (returns false)
 * on any error so a ledger hiccup never wrongly denies a legitimate first
 * order — the User-level flags remain the primary same-account guard.
 */
export async function hasConsumedFirstDelivery(email: string | null | undefined): Promise<boolean> {
    const identifierHash = hashIdentifier(email);
    if (!identifierHash) return false;
    try {
        await connectDB();
        const row = await PromotionEligibility.findOne({
            identifierHash,
            firstDeliveryConsumed: true,
        })
            .select("_id")
            .lean();
        return row !== null;
    } catch (err) {
        console.error("PROMO_ELIGIBILITY_CHECK_ERROR", err);
        return false;
    }
}

/**
 * Record that this identity has consumed the first-order free-delivery
 * benefit. Idempotent upsert keyed by the HMAC. Safe to call repeatedly.
 * Used both when a first order is placed AND when an account is deleted
 * after having consumed the benefit (so recreation cannot reclaim it).
 */
export async function recordFirstDeliveryConsumed(email: string | null | undefined): Promise<void> {
    const identifierHash = hashIdentifier(email);
    if (!identifierHash) return;
    try {
        await connectDB();
        await PromotionEligibility.updateOne(
            { identifierHash },
            {
                $set: { firstDeliveryConsumed: true },
                $setOnInsert: { firstDeliveryConsumedAt: new Date() },
            },
            { upsert: true }
        );
    } catch (err) {
        // Non-fatal: never block order creation or account deletion on a
        // ledger write. Worst case the benefit check falls back to the
        // User-level flags, which still protect the same-account path.
        console.error("PROMO_ELIGIBILITY_RECORD_ERROR", err);
    }
}
