// src/lib/securityLogic.ts
//
// Phase 17.2 — pure, zero-Next/zero-Mongoose-import security helpers,
// same discipline as paymentReconciliationLogic.ts (Phase 17.1A) and
// loyaltyLogic.ts (Phase 17.1B): testable with nothing but Node's own
// built-in `node:assert`/`node:test` (crypto is a Node builtin too, so
// the idempotency-key hashing below is fully covered, not just its shape).

import crypto from "crypto";

/**
 * Masks a phone number to its last 4 digits — used by the guest
 * order-tracking endpoint (F11) so guessing an order ID no longer
 * discloses a full phone number. Returns "" for anything that isn't a
 * non-empty string (never throws on malformed input).
 */
export function maskPhoneLast4(phone: unknown): string {
    if (typeof phone !== "string" || phone.length === 0) return "";
    const last4 = phone.slice(-4);
    return `••••••${last4}`;
}

/**
 * Deterministic idempotency key for an admin notification broadcast
 * (F15) — identical content from the same admin within the dedupe window
 * produces the identical key; any different field produces a different
 * key. The actual dedupe enforcement (limit=1 within a time window) is
 * performed by the existing isRateLimited() primitive at the call site
 * (src/app/api/admin/notifications/broadcast/route.ts) — this function is
 * only the pure key derivation.
 */
export function broadcastIdempotencyKey(params: {
    adminId: string;
    mode: string;
    title: string;
    body: string;
    url: string;
    targetUserId?: string;
}): string {
    const raw = `${params.adminId}:${params.mode}:${params.title}:${params.body}:${params.url}:${params.targetUserId ?? ""}`;
    return `broadcast-idem:${crypto.createHash("sha256").update(raw).digest("hex")}`;
}
