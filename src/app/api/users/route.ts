// src/app/api/users/route.ts
// FIXED:
//   1. Added admin-only auth guard — previously had ZERO authentication
//   2. Replaced O(all-orders) loop with a single MongoDB aggregation
//   3. Added force-dynamic

import { NextRequest, NextResponse } from "next/server";
import { connectDB }  from "@/lib/db";
import User           from "@/models/User";
import Order          from "@/models/Order";
import { requireAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

// Phase 17.2: previously a hand-rolled, JWT-claim-only isAdmin() check —
// see src/app/api/orders/route.ts's sibling comment for the exact risk
// this closes. Now uses the centralized, DB-verified requireAdmin().

function normalizePhone(phone: string) {
    return String(phone || "").replace(/\D/g, "").slice(-10);
}

export async function GET(req: NextRequest) {
    // ✅ Auth check — this endpoint exposes PII (email, phone, address)
    const admin = await requireAdmin(req);
    if (!admin) {
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

        // PHASE 9: the flat 500-item cap (Phase 6) silently truncated the
        // unfiltered list once the user base passed 500 — real users at
        // the tail became invisible to admin search/browsing with no
        // indication anything was missing. Real pagination (page/limit +
        // total count) replaces the hard cap; default page size matches
        // the old cap's order of magnitude so nothing changes for an
        // admin who never passes ?page=.
        const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "500", 10) || 500));
        const skip  = (page - 1) * limit;

        const total = await User.countDocuments(query);

        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .select("-password")
            .skip(skip)
            .limit(limit)
            .lean();

        if (users.length === 0) {
            return NextResponse.json({ success: true, users: [], total, page, limit });
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

        return NextResponse.json({ success: true, users: shaped, total, page, limit });
    } catch (error) {
        console.error("GET_USERS_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch users" },
            { status: 500 }
        );
    }
}
