export const COD_MAX_ORDER_AMOUNT = 549;

// ── Pre-Phase 17 Phase 2 — Street Animal Support donation ──────────────────
// Server-authoritative (src/lib/donations.ts re-validates independently on
// every request — these are shared with the client purely for inline UX
// validation/display, never trusted as the final check).
export const MIN_DONATION_AMOUNT = 30;
// Anti-abuse ceiling, not a business restriction — this is an authenticated-
// only, low-friction contribution box, not a storefront for large transfers.
// Bounds the blast radius of a compromised session / card-testing attempt
// without blocking any realistic genuine contribution (100x the top preset).
export const MAX_DONATION_AMOUNT = 100000;
export const DONATION_PRESET_AMOUNTS = [30, 50, 100, 200, 500, 1000] as const;

// Phase 14 — customer self-service cancellation window, measured from
// Order.createdAt. Server-authoritative: the client countdown is UI only,
// this constant is what /api/orders/[id]/cancel actually enforces.
// EXACTLY 30 seconds per the final product requirement — not configurable.
export const CUSTOMER_CANCEL_WINDOW_MS = 30 * 1000;

// Phase 14 — stuck-order ALERT thresholds (never auto-cancels anything).
// Measured from Order.createdAt as a proxy for "time in current status"
// (acceptable approximation — a genuinely long-received/preparing/
// out_for_delivery order is old regardless of exactly which prior
// transition took time). Computed client-side in the admin order list from
// data it already has — no new cron job, no new DB query, matching the
// current scale (hundreds, not millions, of orders). Revisit with a real
// per-status-entry timestamp (statusHistory's last entry) if/when volume
// justifies it.
export const STUCK_ORDER_THRESHOLDS_MS: Record<string, number> = {
    received:         10 * 60 * 1000, // 10 min
    preparing:        25 * 60 * 1000, // 25 min
    out_for_delivery: 45 * 60 * 1000, // 45 min
};