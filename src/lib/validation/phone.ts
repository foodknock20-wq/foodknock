// src/lib/validation/phone.ts
//
// Customer Identity Validation Repair — THE single canonical Indian mobile
// number normalizer + validator, reused by registration and checkout so the
// rule never drifts between two hand-rolled regexes.
//
// Canonical internal representation: bare 10-digit string, no "+91", no
// spaces (e.g. "9876543210") — this matches the format already in use
// across the existing codebase. Confirmed from
// src/lib/notifications/whatsapp/phoneFormat.ts's own documented
// assumption ("User.phone is stored as a free-form trimmed string... a
// bare 10-digit local number is assumed to be Indian") and from every
// existing duplicate-phone check (src/app/api/auth/register/route.ts,
// verify-signup-otp) comparing `User.phone` as a plain string. Adopting
// the SAME canonical form here — rather than inventing a new one — means
// new signups stay exact-match-comparable against existing real user
// records with zero migration and zero duplicate-account risk.
//
// This module does NOT touch the database, the User schema, or any
// existing stored value — it only governs what NEW input is accepted.

export type PhoneValidationResult =
    | { ok: true; value: string }
    | { ok: false; code: "INVALID_PHONE" | "JUNK_PHONE"; message: string };

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Strips everything but digits, then strips a leading "91" country code
 * (or a stray leading trunk "0") IF doing so leaves exactly a 10-digit
 * number — so "+919876543210", "919876543210", "09876543210", and
 * "9876543210" all normalize to the same canonical "9876543210". Never
 * guesses beyond that — a string that doesn't reduce to 10 digits this
 * way is left as-is and will simply fail validateIndianMobile() below.
 */
export function normalizeIndianMobile(raw: string): string {
    let digits = String(raw ?? "").replace(/\D/g, "");

    if (digits.length === 12 && digits.startsWith("91")) {
        digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
        digits = digits.slice(1);
    }

    return digits;
}

/**
 * Obvious synthetic/junk patterns — all-same-digit, and the two canonical
 * 10-digit ascending/descending runs (wrapping through 0, e.g.
 * "1234567890" and "9876543210"). Deliberately NOT a giant blacklist:
 * these three cheap, explainable checks cover every example in the spec
 * without hardcoding each one individually.
 */
function isJunkPattern(digits: string): boolean {
    if (/^(\d)\1{9}$/.test(digits)) return true; // 6666666666, 9999999999, ...

    let ascending = true;
    let descending = true;
    for (let i = 1; i < digits.length; i++) {
        const prev = Number(digits[i - 1]);
        const cur = Number(digits[i]);
        if (cur !== (prev + 1) % 10) ascending = false;
        if (cur !== (prev - 1 + 10) % 10) descending = false;
    }
    return ascending || descending;
}

/**
 * Validates a NEW customer-entered phone number. Always normalizes first,
 * so legacy-formatted input (+91/91 prefixed, spaced) is graduated into
 * the canonical form before the strict checks run — minimizing false
 * rejections of genuinely valid numbers typed/pasted with a prefix.
 */
export function validateIndianMobile(raw: string): PhoneValidationResult {
    const value = normalizeIndianMobile(raw);

    if (!INDIAN_MOBILE_REGEX.test(value)) {
        return { ok: false, code: "INVALID_PHONE", message: "Enter a valid 10-digit Indian mobile number." };
    }
    if (isJunkPattern(value)) {
        return { ok: false, code: "JUNK_PHONE", message: "Please enter your actual mobile number." };
    }
    return { ok: true, value };
}
