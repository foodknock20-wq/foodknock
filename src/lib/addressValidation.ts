// src/lib/addressValidation.ts
//
// Shared validation/sanitization for the two saved-address route handlers
// (POST /api/users/me/addresses, PATCH /api/users/me/addresses/[addressId]).
// Pure, DB-free — just turns an arbitrary request body into either a clean,
// allowlisted address object or a validation error message. Never trust the
// client beyond these fields; isDefault handling (the single-default
// invariant) is enforced by the route handlers themselves, not here.

export const MAX_ADDRESSES_PER_USER = 10;

export type AddressInput = {
    label: string;
    flatNo: string;
    addressLine: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    landmark: string;
    deliveryInstructions: string;
    lat: number | null;
    lng: number | null;
};

const PINCODE_RE = /^\d{6}$/;

function str(value: unknown, maxLen: number): string {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLen);
}

/**
 * Validates+sanitizes a full address payload (used by POST, i.e. create).
 * Returns { ok: true, data } or { ok: false, message }.
 */
export function parseAddressInput(
    body: Record<string, unknown>
): { ok: true; data: AddressInput } | { ok: false; message: string } {
    const addressLine = str(body.addressLine, 200);
    const city = str(body.city, 80);
    const state = str(body.state, 80);
    const pincode = str(body.pincode, 10);

    if (!addressLine) return { ok: false, message: "Address line is required" };
    if (!city) return { ok: false, message: "City is required" };
    if (!state) return { ok: false, message: "State is required" };
    if (!PINCODE_RE.test(pincode)) return { ok: false, message: "Pincode must be a 6-digit number" };

    const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
    const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;

    return {
        ok: true,
        data: {
            label: str(body.label, 40),
            flatNo: str(body.flatNo, 60),
            addressLine,
            locality: str(body.locality, 100),
            city,
            state,
            pincode,
            landmark: str(body.landmark, 120),
            deliveryInstructions: str(body.deliveryInstructions, 200),
            lat,
            lng,
        },
    };
}

/**
 * Validates+sanitizes a PARTIAL address payload (used by PATCH, i.e. edit).
 * Only keys actually present in `body` are validated/returned — omitted
 * keys are left untouched by the caller. Returns {} if nothing to update.
 */
export function parsePartialAddressInput(
    body: Record<string, unknown>
): { ok: true; data: Partial<AddressInput> } | { ok: false; message: string } {
    const data: Partial<AddressInput> = {};

    if (body.addressLine !== undefined) {
        const v = str(body.addressLine, 200);
        if (!v) return { ok: false, message: "Address line cannot be empty" };
        data.addressLine = v;
    }
    if (body.city !== undefined) {
        const v = str(body.city, 80);
        if (!v) return { ok: false, message: "City cannot be empty" };
        data.city = v;
    }
    if (body.state !== undefined) {
        const v = str(body.state, 80);
        if (!v) return { ok: false, message: "State cannot be empty" };
        data.state = v;
    }
    if (body.pincode !== undefined) {
        const v = str(body.pincode, 10);
        if (!PINCODE_RE.test(v)) return { ok: false, message: "Pincode must be a 6-digit number" };
        data.pincode = v;
    }
    if (body.label !== undefined) data.label = str(body.label, 40);
    if (body.flatNo !== undefined) data.flatNo = str(body.flatNo, 60);
    if (body.locality !== undefined) data.locality = str(body.locality, 100);
    if (body.landmark !== undefined) data.landmark = str(body.landmark, 120);
    if (body.deliveryInstructions !== undefined) data.deliveryInstructions = str(body.deliveryInstructions, 200);
    if (typeof body.lat === "number" && Number.isFinite(body.lat)) data.lat = body.lat;
    if (typeof body.lng === "number" && Number.isFinite(body.lng)) data.lng = body.lng;

    return { ok: true, data };
}
