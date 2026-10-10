// src/lib/authDeviceMemory.ts
//
// FoodKnock /auth 2.0 — a minimal, dedicated UX-only marker answering
// exactly one question: "has this browser/device ever completed a
// genuine FoodKnock login or signup before?" Used ONLY to pick which
// /auth tab opens by default (Sign In vs Create Account).
//
// SECURITY BOUNDARY — read this before touching this file:
// This marker is NEVER authentication. It does not bypass login, OTP,
// or password. It does not unlock account data or authorize any API
// request. Real auth stays 100% server-side (session cookie +
// requireUser() checks across every protected route) exactly as before.
// If this value is missing, tampered with, or an attacker sets it in
// someone else's browser, the only possible consequence is that the
// wrong /auth TAB opens first — nothing more. Both tabs are always
// reachable regardless of this marker.
//
// Audited first: src/store/authStore.ts (`isLoggedIn`) is in-memory only
// (resets on reload, never persisted) and exists for a different,
// unrelated purpose — an optimistic "likely logged in" hint for
// components that render before their own data fetch resolves (see that
// file's header comment). There was no existing persisted "has
// authenticated before" signal anywhere in the codebase, so this is a
// new, narrowly-scoped key, not a duplicate of something that already
// existed.

const STORAGE_KEY = "foodknock_auth_seen";

/** True only if a genuine login/signup has completed on this browser before. */
export function hasAuthenticatedBefore(): boolean {
    if (typeof window === "undefined") return false;
    try {
        return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
        // Private browsing / storage disabled — fail safe to "new user"
        // (Create Account), never silently assume returning.
        return false;
    }
}

/**
 * Call this ONLY at the exact moment a login or signup genuinely
 * succeeds (after the server has confirmed it — never on page open,
 * form start, or OTP request). Deliberately NOT removed on logout — a
 * user who logs out has still used FoodKnock before; Sign In should
 * remain their default next time (see this file's header comment).
 */
export function markAuthenticatedOnThisDevice(): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
        // Private browsing / storage disabled — nothing to persist; the
        // next visit simply defaults to Create Account again, which is
        // a safe, non-breaking fallback.
    }
}

export type PreferredAuthMode = "login" | "signup";

/**
 * For generic "Sign in to FoodKnock" entry points elsewhere in the app
 * (header icon, account sheet, etc.) — NOT for routes that already force
 * an explicit mode for a specific reason (e.g. a protected-page guard
 * redirecting to `?mode=login`, which should stay explicit).
 */
export function getPreferredAuthMode(): PreferredAuthMode {
    return hasAuthenticatedBefore() ? "login" : "signup";
}
