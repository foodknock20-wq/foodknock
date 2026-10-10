// src/lib/notifications/safeDestination.ts
//
// Notification System 2.0 — Phase 38 deep-link security.
//
// Server-side mirror of public/sw.js's ALLOWED_ROUTE_BASES/resolveSafeUrl().
// The service worker is plain, unbundled JS (no import support) so it keeps
// its own literal copy — this file is the version real route handlers
// (admin broadcast, structured-destination builders) import, so a
// client-supplied destination is validated BEFORE it's ever persisted to
// NotificationLog or handed to the engine, not just at push-delivery time.
// Keep both lists in sync if a new destination type is added.

export const ALLOWED_ROUTE_BASES = [
    "/",
    "/menu",
    "/my-orders",
    "/track-order",
    "/reviews",
    "/cart",
    "/loyalty",
    "/account",
    "/campaigns",
] as const;

/**
 * Validates a relative notification destination path against the allowlist.
 * Always returns a safe, same-origin relative path — "/" for anything
 * invalid, non-relative, or outside the allowlist. Mirrors sw.js's
 * resolveSafeUrl() exactly (prefix match for dynamic sub-paths like
 * "/my-orders/FK-1234" or "/campaigns/diwali-2026").
 */
export function resolveSafeDestination(rawUrl: string | null | undefined): string {
    const value = (rawUrl ?? "").trim();
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";

    // Strip query/hash before matching — the allowlist is path-based only.
    const pathname = value.split("?")[0].split("#")[0] || "/";
    if (pathname === "/") return "/";

    const isAllowed = ALLOWED_ROUTE_BASES.some((base) => {
        if (base === "/") return false;
        return pathname === base || pathname.startsWith(base + "/");
    });

    return isAllowed ? pathname : "/";
}
