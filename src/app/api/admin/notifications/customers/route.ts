export const dynamic = "force-dynamic";

// src/app/api/admin/notifications/customers/route.ts
//
// Notification System 2.0 — Phase 11/12 customer selector for the Admin
// Notification Studio. Deliberately a NEW, narrow endpoint rather than
// reusing/extending GET /api/users (the Users admin page's own endpoint):
// that route is used by an unrelated admin page, and this task's own rules
// say not to modify unrelated systems. Same safe, bounded, admin-gated
// search+pagination pattern as /api/users, plus one bounded extra query to
// report each returned user's real push-subscription state — not a second
// request per user (that would be an N+1 the whole task explicitly forbids).

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import PushSubscription from "@/models/PushSubscription";
import { requireAdmin } from "@/lib/apiAuth";

const MAX_LIMIT = 20;

export async function GET(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
    }

    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.trim() ?? "";
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
        const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(MAX_LIMIT), 10) || MAX_LIMIT));
        const skip = (page - 1) * limit;

        // Require at least a meaningful search term OR an explicit page
        // request — prevents an admin landing on this tab from silently
        // triggering a full, unbounded customer listing by default.
        if (!search && page === 1 && !searchParams.has("page")) {
            return NextResponse.json({ success: true, customers: [], total: 0 });
        }

        const query: Record<string, unknown> = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }

        const [total, users] = await Promise.all([
            User.countDocuments(query),
            User.find(query)
                .select("name email phone isActive")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean<{ _id: unknown; name: string; email: string; phone: string; isActive?: boolean }[]>(),
        ]);

        const userIds = users.map((u) => u._id);
        // ONE bounded query covering this page of results (<=20 ids) —
        // never per-user, never unbounded.
        const activeSubs = userIds.length
            ? await PushSubscription.find({ user: { $in: userIds }, isActive: true }).select("user").lean<{ user: unknown }[]>()
            : [];
        const pushEnabledSet = new Set(activeSubs.map((s) => String(s.user)));

        return NextResponse.json({
            success: true,
            total,
            customers: users.map((u) => ({
                id: String(u._id),
                name: u.name,
                email: u.email,
                phone: u.phone,
                isActive: u.isActive ?? true,
                pushEnabled: pushEnabledSet.has(String(u._id)),
            })),
        });
    } catch (error) {
        console.error("ADMIN_NOTIFICATION_CUSTOMERS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to search customers" }, { status: 500 });
    }
}
