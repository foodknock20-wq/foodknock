// src/lib/apiAuth.ts
//
// ── CENTRALIZED SERVER-SIDE AUTHORIZATION (Phase 3) ──────────────────────────
//
// Problem this solves:
//   Several mutation routes (/api/users/[id], /api/products/[id],
//   /api/products, /api/orders/[id], /api/reviews/[id]) had NO authorization
//   check at all — any unauthenticated request could flip a user's role to
//   "admin", change a product's price, delete a product, change any order's
//   status, or moderate/delete any review. Meanwhile ~15 other routes in
//   this codebase already each hand-rolled their own
//   "read cookie → verifyToken → check role" admin guard (all functionally
//   identical). This file is the single place that pattern now lives for
//   any NEW route, and the fixes in this phase reuse it.
//
// This does NOT replace the existing per-route isAdmin() helpers that were
// already correct (e.g. admin/*, upload/image) — those are untouched.
//
// Trust model:
//   The session cookie's JWT is HMAC-signed server-side (see src/lib/auth.ts)
//   and cannot be forged by a client. getSessionUser() reads its claims
//   without a DB round trip (cheap, used for ownership checks). requireAdmin()
//   and requireUser() additionally re-verify role/isActive live against the
//   User document, because a role can change (or an account can be
//   deactivated) after the JWT was issued but before it expires (7d) — the
//   same reasoning already applied in upload/image.ts and the
//   admin/review-rewards/* routes.

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";

export interface SessionUser {
    userId: string;
    role?: string;
}

export interface AuthorizedUser {
    userId: string;
    role: "user" | "admin";
}

function extractToken(req: Request): string | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Cheap, DB-free identity check from the trusted session cookie. `role` here
 * is the JWT's claim AT LOGIN TIME — fine for "who is this" (e.g. an
 * ownership comparison), but NOT a sufficient admin check on its own (see
 * requireAdmin). Returns null for any missing/invalid/expired token.
 */
export function getSessionUser(req: Request): SessionUser | null {
    const token = extractToken(req);
    if (!token) return null;
    try {
        const decoded = verifyToken(token) as { userId?: string; role?: string };
        if (!decoded?.userId) return null;
        return { userId: decoded.userId, role: decoded.role };
    } catch {
        return null;
    }
}

/**
 * Authenticated AND currently-active, re-verified live against the DB.
 * Use for any endpoint that needs a real, trustworthy user identity
 * (ownership checks, self-service mutations).
 */
export async function requireUser(req: Request): Promise<AuthorizedUser | null> {
    const session = getSessionUser(req);
    if (!session) return null;

    await connectDB();
    const user = await User.findById(session.userId)
        .select("role isActive")
        .lean<{ role?: string; isActive?: boolean } | null>();

    if (!user || user.isActive === false) return null;
    return { userId: session.userId, role: user.role === "admin" ? "admin" : "user" };
}

/**
 * Authenticated, active, AND server-verified admin role. Never trusts the
 * JWT's `role` claim alone — always confirms against the live User document.
 */
export async function requireAdmin(req: Request): Promise<AuthorizedUser | null> {
    const user = await requireUser(req);
    if (!user || user.role !== "admin") return null;
    return user;
}
