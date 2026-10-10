// src/lib/couponCode.ts
//
// Phase 11 — secure random coupon code generation.
//
// Codes must be unpredictable (no sequence, no DB id, no campaign/shop/
// prize encoding — see Phase 11 spec §5/§39) so a future physical-coupon
// or campaign-allocation system can safely attach meaning to an already-
// generated, otherwise-meaningless code. crypto.randomInt is a CSPRNG
// (Node's crypto module, not Math.random()) — codes are infeasible to
// guess in sequence.

import { randomInt } from "crypto";

// Excludes 0/O and 1/I — visually confusing in print/SMS/screenshots.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 9;

export function generateCouponCode(length: number = CODE_LENGTH): string {
    let code = "";
    for (let i = 0; i < length; i++) {
        code += ALPHABET[randomInt(0, ALPHABET.length)];
    }
    return code;
}

/** trim + uppercase — the one normalization rule every lookup/insert must apply. */
export function normalizeCouponCode(raw: string): string {
    return String(raw ?? "").trim().toUpperCase();
}
