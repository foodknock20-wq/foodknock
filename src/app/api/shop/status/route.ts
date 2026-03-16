export const dynamic = "force-dynamic";

// src/app/api/shop/status/route.ts
//
// GET  /api/shop/status  — returns current shop open/closed state (public)
// POST /api/shop/status  — toggles or explicitly sets shop state (admin only)
//
// POST body: { isOpen: boolean }

import { NextResponse } from "next/server";
import { getShopStatus, setShopStatus } from "@/models/Shop";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

// ── GET — public ──────────────────────────────────────────────────────────────
export async function GET() {
    try {
        const { isOpen } = await getShopStatus();
        return NextResponse.json({ success: true, isOpen });
    } catch (error) {
        console.error("SHOP_STATUS_GET_ERROR", error);
        // Fail open: if we can't reach DB, don't block customers from ordering.
        return NextResponse.json({ success: true, isOpen: true });
    }
}

// ── POST — admin only ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        // ── Auth guard: must be an admin ──
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
        const user = await User.findById(userId).select("role isActive").lean<{ role: string; isActive: boolean }>();

        if (!user || user.isActive === false || user.role !== "admin") {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 }
            );
        }

        // ── Parse body ──
        const body = await req.json();

        if (typeof body.isOpen !== "boolean") {
            return NextResponse.json(
                { success: false, message: "isOpen (boolean) is required" },
                { status: 400 }
            );
        }

        const { isOpen } = await setShopStatus(body.isOpen);

        return NextResponse.json({
            success: true,
            isOpen,
            message: isOpen ? "Shop is now open" : "Shop is now closed",
        });
    } catch (error) {
        console.error("SHOP_STATUS_POST_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to update shop status" },
            { status: 500 }
        );
    }
}