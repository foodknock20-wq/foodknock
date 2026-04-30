
// src/app/api/auth/me/first-delivery/route.ts
//
// GET /api/auth/me/first-delivery
//
// Read-only endpoint used by the checkout page to determine whether the
// current user qualifies for first-order free delivery.
//
// The frontend uses this ONLY for display — showing the promo banner and
// zeroing the displayed delivery fee.  The backend re-validates at order
// creation time (checkFirstFreeDelivery) and writes the flag after a
// successful order (consumeFirstFreeDelivery).
//
// Eligibility mirrors the same two-condition check in firstFreeDelivery.ts:
//   1. firstDeliveryFreeUsed === false
//   2. deliveredOrderCount   === 0       ← old-user guard
//
// Both must be true.  This means a user who was created before this field
// existed and has already received delivered orders will correctly get
// eligible: false without any migration.

import { NextResponse } from "next/server";
import { connectDB }   from "@/lib/db";
import User            from "@/models/User";
import { verifyToken } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        // ── Parse token ───────────────────────────────────────────────────
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

        if (!token) {
            return NextResponse.json({ eligible: false });
        }

        let decoded: { userId?: string };
        try {
            decoded = verifyToken(token) as { userId?: string };
        } catch {
            return NextResponse.json({ eligible: false });
        }

        if (!decoded?.userId) {
            return NextResponse.json({ eligible: false });
        }

        await connectDB();

        // ── Query: both conditions must be true ───────────────────────────
        const user = await User.findOne({
            _id:                   decoded.userId,
            isActive:              { $ne: false },  // blocked users are ineligible
            firstDeliveryFreeUsed: false,
            deliveredOrderCount:   0,
        })
            .select("_id")
            .lean();

        return NextResponse.json({ eligible: user !== null });
    } catch (error) {
        console.error("FIRST_DELIVERY_ELIGIBILITY_ERROR", error);
        // Fail safe: return ineligible rather than crashing the checkout page
        return NextResponse.json({ eligible: false });
    }
}