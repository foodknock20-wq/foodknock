export const dynamic = "force-dynamic";
export const revalidate = 0;

// src/app/api/navbar/route.ts
//
// Single combined endpoint for the Navbar component. Replaces three
// separate client-side fetches (GET /api/auth/me, GET /api/loyalty,
// GET /api/notifications) with one route that opens a single Mongo
// connection and queries User, LoyaltyLedger/Order, and NotificationLog
// (via the existing fetchUnreadCount helper) directly — no internal
// fetch() calls to the other route handlers.
//
// Auth: identical cookie + JWT verification logic to GET /api/auth/me,
// including the same isActive suspension check and cookie-clearing
// behaviour on a blocked account.
//
// Loyalty: identical stale-cache repair logic to GET /api/loyalty's
// balance calculation (prefers User.loyaltyPoints, falls back to a
// LoyaltyLedger aggregate sum, and fire-and-forget repairs the cached
// field) — but skips the ledger history fetch/populate since the
// navbar only ever renders the numeric balance.
//
// Notifications: identical unread count to GET /api/notifications,
// sourced from the same fetchUnreadCount(userId) helper used there —
// no duplicated counting logic.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import LoyaltyLedger from "@/models/LoyaltyLedger";
import { verifyToken } from "@/lib/auth";
import { fetchUnreadCount } from "@/lib/notifications/inboxQuery";

function getTokenFromCookie(req: NextRequest): string | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    return tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
}

export async function GET(req: NextRequest) {
    const token = getTokenFromCookie(req);

    if (!token) {
        return NextResponse.json({
            success: true,
            user: null,
            loyaltyBalance: null,
            unreadNotifications: 0,
        });
    }

    let decoded: { userId: string } & Record<string, unknown>;
    try {
        decoded = verifyToken(token) as typeof decoded;
    } catch {
        return NextResponse.json({
            success: true,
            user: null,
            loyaltyBalance: null,
            unreadNotifications: 0,
        });
    }

    if (!decoded?.userId) {
        return NextResponse.json({
            success: true,
            user: null,
            loyaltyBalance: null,
            unreadNotifications: 0,
        });
    }

    const userId = decoded.userId;

    try {
        await connectDB();

        const userDoc = await User.findById(userId)
            .select("_id name email role phone address isActive loyaltyPoints")
            .lean();

        if (!userDoc) {
            return NextResponse.json({
                success: true,
                user: null,
                loyaltyBalance: null,
                unreadNotifications: 0,
            });
        }

        // ── Suspension check — same behaviour as GET /api/auth/me ─────────
        if (userDoc.isActive === false) {
            const res = NextResponse.json(
                { success: false, message: "Your account has been suspended. Please contact support." },
                { status: 403 }
            );
            res.cookies.set("token", "", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                expires: new Date(0),
            });
            return res;
        }

        // ── loyaltyBalance — same stale-cache repair as GET /api/loyalty ──
        let balance: number = (userDoc as any).loyaltyPoints;
        let repairBalance: number | null = null;

        const balancePromise: Promise<number> = (async () => {
            if (balance == null || !Number.isFinite(balance)) {
                const agg = await LoyaltyLedger.aggregate([
                    { $match: { user: userDoc._id } },
                    { $group: { _id: null, total: { $sum: "$points" } } },
                ]);
                const computed = agg[0]?.total ?? 0;
                repairBalance = computed;
                return computed;
            }
            return balance;
        })();

        // ── unreadNotifications — same source as GET /api/notifications ──
        const unreadPromise = fetchUnreadCount(userId);

        const [resolvedBalance, unreadNotifications] = await Promise.all([
            balancePromise,
            unreadPromise,
        ]);

        if (repairBalance !== null) {
            User.findByIdAndUpdate(userId, { $set: { loyaltyPoints: repairBalance } })
                .catch((err) => console.error("NAVBAR_LOYALTY_REPAIR_ERROR", err));
        }

        return NextResponse.json({
            success: true,
            user: {
                id: userDoc._id.toString(),
                name: userDoc.name,
                email: userDoc.email,
                role: userDoc.role ?? "user",
                phone: userDoc.phone ?? "",
                address: userDoc.address ?? "",
                isActive: userDoc.isActive ?? true,
            },
            loyaltyBalance: Math.max(0, Math.floor(Number(resolvedBalance) || 0)),
            unreadNotifications: Number(unreadNotifications) || 0,
        });
    } catch (error) {
        console.error("NAVBAR_ROUTE_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to load navbar data" },
            { status: 500 }
        );
    }
}