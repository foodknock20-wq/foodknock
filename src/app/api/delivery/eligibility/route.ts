export const dynamic = "force-dynamic";

// src/app/api/delivery/eligibility/route.ts
//
// GET /api/delivery/eligibility
//
// Returns whether the authenticated user qualifies for first-order free delivery.
// Read-only — never mutates anything. Safe to call from any UI component.
//
// Response: { eligible: boolean }
//
// Guests (no token) always get { eligible: false }.
// DB errors also return { eligible: false } so the UI degrades gracefully
// and shows the normal ₹20 fee rather than an error screen.

import { NextResponse } from "next/server";
import { connectDB }    from "@/lib/db";
import { verifyToken }  from "@/lib/auth";
import { checkFirstFreeDelivery } from "@/lib/firstFreeDelivery";

export async function GET(req: Request) {
    try {
        // ── Resolve user from cookie token ────────────────────────────────
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

        if (!token) {
            return NextResponse.json({ eligible: false });
        }

        let userId: string;
        try {
            const decoded = verifyToken(token) as { userId?: string };
            if (!decoded?.userId) return NextResponse.json({ eligible: false });
            userId = decoded.userId;
        } catch {
            return NextResponse.json({ eligible: false });
        }

        // ── Check eligibility (read-only, never mutates) ──────────────────
        await connectDB();
        const { eligible } = await checkFirstFreeDelivery(userId, "delivery");

        return NextResponse.json({ eligible });
    } catch (error) {
        // Fail safe — show normal fee rather than crashing the UI
        console.error("DELIVERY_ELIGIBILITY_ERROR", error);
        return NextResponse.json({ eligible: false });
    }
}