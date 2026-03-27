export const dynamic = "force-dynamic";
// src/app/api/admin/users/export/route.ts
// Admin-only endpoint — returns all users with name + phone for marketing use.
// Secured with the same isAdmin() guard used across all /api/admin/* routes.

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/lib/db";
import User            from "@/models/User";
import { verifyToken } from "@/lib/auth";

// ── Admin guard (mirrors the pattern in /api/admin/loyalty/route.ts) ───────
function isAdmin(req: NextRequest): boolean {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match        = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token        = match ? decodeURIComponent(match[1]) : null;
    if (!token) return false;
    try {
        const decoded = verifyToken(token) as { role?: string };
        return decoded?.role === "admin";
    } catch {
        return false;
    }
}

// ── GET /api/admin/users/export ────────────────────────────────────────────
// Returns: { success: true, total: number, users: { name, phone }[] }
export async function GET(req: NextRequest) {
    if (!isAdmin(req)) {
        return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
        );
    }

    try {
        await connectDB();

        // Only fetch active regular users; select only the fields we need.
        const users = await User.find({ role: "user", isActive: true })
            .select("name phone")
            .sort({ createdAt: -1 })
            .lean();

        const payload = (users as any[]).map((u) => ({
            name:  u.name  ?? "—",
            phone: u.phone ?? "—",
        }));

        return NextResponse.json({
            success: true,
            total:   payload.length,
            users:   payload,
        });
    } catch (err) {
        console.error("ADMIN_USERS_EXPORT_ERROR", err);
        return NextResponse.json(
            { success: false, message: "Failed to fetch users" },
            { status: 500 }
        );
    }
}