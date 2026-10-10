// src/lib/validation/name.ts
//
// Customer Identity Validation Repair — THE single canonical full-name
// validator for NEW signups and voluntary profile edits.
//
// Deliberately NOT over-engineered: no two-word requirement, no surname
// requirement, no ASCII-only restriction, no ban on initials/single-word
// names. The only rules are: present, trimmed length >= 7 characters, and
// contains at least one real letter (rejects pure digits/symbols).
//
// IMPORTANT — this module does NOT retroactively judge existing stored
// names. It only governs NEW input (new signup, or a profile name the
// user actively chooses to change) — see src/app/api/auth/register/route.ts
// and src/app/api/auth/me/route.ts for how the "voluntary edit" distinction
// is applied.

export type NameValidationResult =
    | { ok: true; value: string }
    | { ok: false; code: "INVALID_NAME" | "NAME_TOO_SHORT"; message: string };

export const FULL_NAME_MIN_LENGTH = 7;

// At least one Unicode letter somewhere in the string (supports Indian/
// non-ASCII names, not just A-Z).
const HAS_LETTER = /\p{L}/u;
// Letters (any script), combining marks, spaces, and the handful of
// punctuation marks that legitimately appear inside real names
// (apostrophe, hyphen, period for initials).
const ALLOWED_CHARACTERS = /^[\p{L}\p{M}\s.'-]+$/u;

/** trim() + collapse repeated internal whitespace — never touches casing. */
export function normalizeFullName(raw: string): string {
    return String(raw ?? "").trim().replace(/\s+/g, " ");
}

export function validateFullName(raw: string): NameValidationResult {
    const value = normalizeFullName(raw);

    if (!value) {
        return { ok: false, code: "INVALID_NAME", message: "Please enter your full name." };
    }
    if (value.length < FULL_NAME_MIN_LENGTH) {
        return { ok: false, code: "NAME_TOO_SHORT", message: `Please enter at least ${FULL_NAME_MIN_LENGTH} characters.` };
    }
    if (!HAS_LETTER.test(value) || !ALLOWED_CHARACTERS.test(value)) {
        return { ok: false, code: "INVALID_NAME", message: "Please enter a valid full name." };
    }
    return { ok: true, value };
}
