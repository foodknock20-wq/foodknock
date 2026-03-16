// src/app/api/users/route.ts
// FIXED:
//   1. Added admin-only auth guard — previously had ZERO authentication
//   2. Replaced O(all-orders) loop with a single MongoDB aggregation
//   3. Added force-dynamic

import { NextRequest, NextResponse } from "next/server";
import { connectDB }  from "@/lib/db";
import User           from "@/models/User";
import Order          from "@/models/Order";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ─── Admin auth guard ─────────────────────────────────────────────────────
function extractToken(req: NextRequest): string | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match        = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function isAdmin(req: NextRequest): boolean {
    const token = extractToken(req);
    if (!token) return false;
    try {
        const decoded = verifyToken(token) as { role?: string };
        return decoded?.role === "admin";
    } catch {
        return false;
    }
}

function normalizePhone(phone: string) {
    return String(phone || "").replace(/\D/g, "").slice(-10);
}

export async function GET(req: NextRequest) {
    // ✅ Auth check — this endpoint exposes PII (email, phone, address)
    if (!isAdmin(req)) {
        return NextResponse.json(
            { success: false, message: "Unauthorised" },
            { status: 401 }
        );
    }

    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.trim();

        const query: Record<string, any> = {};

        if (search) {
            query.$or = [
                { name:  { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }

        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .select("-password")
            .lean();

        if (users.length === 0) {
            return NextResponse.json({ success: true, users: [] });
        }

        // ✅ FIXED: single aggregation instead of fetching all orders and looping
        // OLD: await Order.find({ phone: ... }).lean() → could return 100k+ docs
        // NEW: aggregate in MongoDB — O(1) round-trips, indexed on phone
        const orderCountAgg = await Order.aggregate([
            {
                $group: {
                    _id:   "$phone",
                    count: { $sum: 1 },
                },
            },
        ]);

        const countMap: Record<string, number> = {};
        orderCountAgg.forEach((r: any) => {
            const normalized = normalizePhone(r._id ?? "");
            if (normalized) countMap[normalized] = r.count;
        });

        const shaped = users.map((u: any) => {
            const normalizedUserPhone = normalizePhone(u.phone ?? "");
            return {
                _id:       String(u._id),
                name:      u.name      ?? "",
                email:     u.email     ?? "",
                phone:     u.phone     ?? "",
                role:      u.role      ?? "user",
                isActive:  u.isActive  ?? true,
                ordersCount: countMap[normalizedUserPhone] ?? 0,
                createdAt: u.createdAt
                    ? new Date(u.createdAt).toISOString()
                    : new Date().toISOString(),
            };
        });

        return NextResponse.json({ success: true, users: shaped });
    } catch (error) {
        console.error("GET_USERS_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch users" },
            { status: 500 }
        );
    }
}
