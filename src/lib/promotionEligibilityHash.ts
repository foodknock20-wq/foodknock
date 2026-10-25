// src/lib/promotionEligibilityHash.ts
//
// Pure, dependency-free identifier hashing for the promotion eligibility
// ledger. Kept in its own module (no DB import) so the cryptographic
// behaviour can be unit-tested without pulling in @/lib/db — see
// src/lib/promotionEligibility.ts for the DB-backed read/write helpers and
// the full privacy rationale.

import crypto from "crypto";

function getSecret(): string {
    const secret = process.env.PROMO_ELIGIBILITY_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("PROMO_ELIGIBILITY_SECRET / JWT_SECRET is not configured");
    }
    return secret;
}

/** Normalize an email exactly like the User model stores it (lowercase, trimmed). */
function normalizeEmail(email: string): string {
    return String(email || "").trim().toLowerCase();
}

/**
 * Keyed HMAC-SHA256 of the normalized email. Deterministic for a given
 * email+secret, so a returning identity maps to the same ledger row.
 * Returns null for an empty/invalid email (never hash an empty string).
 */
export function hashIdentifier(email: string | null | undefined): string | null {
    const normalized = normalizeEmail(email ?? "");
    if (!normalized || !normalized.includes("@")) return null;
    return crypto.createHmac("sha256", getSecret()).update(normalized).digest("hex");
}
