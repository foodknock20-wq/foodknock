export const dynamic = "force-dynamic";
// src/app/api/admin/users/export/route.ts
// Admin-only endpoint — returns users with name + phone for marketing use.
// Secured with the same isAdmin() guard used across all /api/admin/* routes.
//
// Phase 15A pagination audit: this had NO limit at all — a genuinely
// unbounded `User.find()` that would ship the entire active user base as
// one JSON response, growing forever as the customer base grows. Capped
// to MAX_EXPORT, mirroring the identical, already-correct pattern in
// /api/admin/physical-coupons/export — a deliberate bulk pull is fine as
// long as it's bounded, never literally "all rows, however many that is".
// `truncated` tells the client when the real total exceeds the cap so the
// UI can say so honestly rather than silently returning a partial list.

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/lib/db";
import User            from "@/models/User";
import { requireAdmin } from "@/lib/apiAuth";

const MAX_EXPORT = 10_000;

// Phase 17.2: previously a hand-rolled, JWT-claim-only isAdmin() check —
// see src/app/api/orders/route.ts's sibling comment. Now uses the
// centralized, DB-verified requireAdmin() — notable here specifically
// since this route exports every active customer's name+phone for
// marketing use, a stale-privilege window on this exact endpoint was the
// highest-exposure instance of this finding.

// ── GET /api/admin/users/export ────────────────────────────────────────────
// Returns: { success: true, total: number, users: { name, phone }[] }
export async function GET(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
        );
    }

    try {
        await connectDB();

        const filter = { role: "user", isActive: true };

        // Only fetch active regular users; select only the fields we need.
        const [users, realTotal] = await Promise.all([
            User.find(filter)
                .select("name phone")
                .sort({ createdAt: -1 })
                .limit(MAX_EXPORT)
                .lean(),
            User.countDocuments(filter),
        ]);

        const payload = (users as Array<{ name?: string; phone?: string }>).map((u) => ({
            name:  u.name  ?? "—",
            phone: u.phone ?? "—",
        }));

        return NextResponse.json({
            success:   true,
            total:     payload.length,
            truncated: realTotal > payload.length,
            realTotal,
            users:     payload,
        });
    } catch (err) {
        console.error("ADMIN_USERS_EXPORT_ERROR", err);
        return NextResponse.json(
            { success: false, message: "Failed to fetch users" },
            { status: 500 }
        );
    }
}