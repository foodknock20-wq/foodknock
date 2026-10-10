// src/app/api/shop/status/route.ts
// PERF FIX:
//   GET /api/shop/status was hitting MongoDB on every single page load / customer request.
//   Every MenuPage SSR + every client hydration that checks shop status = DB hit.
//   Fix: Cache-Control s-maxage=10 lets CDN serve cached response for 10 seconds.
//        stale-while-revalidate=5 serves stale while refreshing in background.
//        Result: under normal load, 1 DB query per 10 seconds instead of 1 per request.
//
//   force-dynamic kept — correct for API routes (prevents static build-time optimisation)
//   POST (admin toggle) unchanged — must always hit DB, no caching

export const revalidate = 10;

import { NextResponse } from "next/server";
import { getShopStatus, setShopStatus } from "@/models/Shop";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { isValidCloseReasonCode, describeCloseReason } from "@/lib/shopCloseReasons";

// ── GET — public ──────────────────────────────────────────────────────────────
export async function GET() {
    try {
        const status = await getShopStatus();
        const res = NextResponse.json({
            success: true,
            isOpen: status.isOpen,
            closedReasonCode: status.closedReasonCode,
            closedReasonText: status.closedReasonText,
            // Phase 15E.8 — human label, derived here (not stored) so admin
            // UI/customer messaging never drift if the label catalog changes.
            closedReasonLabel: describeCloseReason(status.closedReasonCode, status.closedReasonText),
        });
        // PERF: CDN caches shop open/closed state for 10 s.
        // Acceptable staleness for a status that changes at most a few times per day.
        // stale-while-revalidate=5 means stale data served for max 5 extra seconds during refresh.
        res.headers.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=5");
        return res;
    } catch (error) {
        console.error("SHOP_STATUS_GET_ERROR", error);
        // Fail open: if we can't reach DB, don't block customers from ordering.
        return NextResponse.json({ success: true, isOpen: true, closedReasonCode: null, closedReasonText: null, closedReasonLabel: null });
    }
}

// ── POST — admin only ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

        if (!token) {
            return NextResponse.json(
                { success: false, message: "Unauthorised" },
                { status: 401 }
            );
        }

        let userId: string;
        try {
            const decoded = verifyToken(token) as { userId?: string };
            if (!decoded?.userId) throw new Error("No userId in token");
            userId = decoded.userId;
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid token" },
                { status: 401 }
            );
        }

        await connectDB();
        const user = await User.findById(userId)
            .select("role isActive")
            .lean<{ role: string; isActive: boolean }>();

        if (!user || user.isActive === false || user.role !== "admin") {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 }
            );
        }

        const body = await req.json();

        if (typeof body.isOpen !== "boolean") {
            return NextResponse.json(
                { success: false, message: "isOpen (boolean) is required" },
                { status: 400 }
            );
        }

        let reason: { code: string | null; text: string | null } | undefined;
        if (body.isOpen === false) {
            const reasonCode = typeof body.reasonCode === "string" ? body.reasonCode : null;
            if (reasonCode && !isValidCloseReasonCode(reasonCode)) {
                return NextResponse.json({ success: false, message: "Invalid close reason" }, { status: 400 });
            }
            const reasonText = typeof body.reasonText === "string" ? body.reasonText.trim().slice(0, 200) : null;
            if (reasonCode === "custom" && !reasonText) {
                return NextResponse.json({ success: false, message: "Custom reason text is required" }, { status: 400 });
            }
            reason = { code: reasonCode, text: reasonText };
        }

        const status = await setShopStatus(body.isOpen, reason);

        return NextResponse.json({
            success: true,
            isOpen: status.isOpen,
            closedReasonCode: status.closedReasonCode,
            closedReasonText: status.closedReasonText,
            closedReasonLabel: describeCloseReason(status.closedReasonCode, status.closedReasonText),
            message: status.isOpen ? "Shop is now open" : "Shop is now closed",
        });
    } catch (error) {
        console.error("SHOP_STATUS_POST_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to update shop status" },
            { status: 500 }
        );
    }
}