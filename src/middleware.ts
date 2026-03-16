// src/middleware.ts
// Lightweight middleware — only checks JWT cookie PRESENCE for /admin routes.
// DB-backed role/isActive validation is done in admin layout (server component).
// This gives early redirects without expensive DB calls on every request.

import { NextRequest, NextResponse } from "next/server";

// ─── Routes to protect ────────────────────────────────────────────────────
const ADMIN_PREFIX = "/admin";

// ─── Cookie name (must match login route) ────────────────────────────────
const TOKEN_COOKIE = "token";

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Only run for /admin routes
    if (!pathname.startsWith(ADMIN_PREFIX)) {
        return NextResponse.next();
    }

    const token = req.cookies.get(TOKEN_COOKIE)?.value;

    // No token at all → redirect to /auth?redirect=/admin
    if (!token) {
        const loginUrl = new URL("/auth", req.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Token exists — let the admin layout do DB-backed role/isActive check
    return NextResponse.next();
}

export const config = {
    // Match all /admin routes including nested ones
    matcher: ["/admin", "/admin/:path*"],
};