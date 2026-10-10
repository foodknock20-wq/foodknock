export const dynamic = "force-dynamic";

// src/app/api/admin/loyalty/[userId]/route.ts
// Admin: full ledger + user loyalty summary for a specific user.
//
// Applies the same stale-field repair as the paginated admin list so the
// per-user detail view is always consistent with the user-facing loyalty page.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB }   from "@/lib/db";
import User            from "@/models/User";
import LoyaltyLedger  from "@/models/LoyaltyLedger";
import Order           from "@/models/Order";
import { requireAdmin } from "@/lib/apiAuth";

type RouteContext = { params: Promise<{ userId: string }> };

// Phase 17.1B — see route.ts's sibling comment: now uses the centralized,
// DB-verified requireAdmin() instead of a hand-rolled JWT-claim-only check.

export async function GET(req: NextRequest, context: RouteContext) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { userId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return NextResponse.json({ success: false, message: "Invalid user ID" }, { status: 400 });
    }

    try {
        await connectDB();

        const [user, ledger] = await Promise.all([
            User.findById(userId)
                .select("name email phone loyaltyPoints referralCode referredBy deliveredOrderCount")
                .populate("referredBy", "name email")
                .lean(),
            // PHASE 6: bounded, consistent with the user-facing /api/loyalty
            // ledger limit — an admin viewing one customer's history doesn't
            // need an unbounded fetch either.
            LoyaltyLedger.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(200)
                .populate("order",        "orderId totalAmount createdAt")
                .populate("referredUser", "name email")
                .lean(),
        ]);

        if (!user) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
        }

        // ── Repair stale / missing cached fields (see route.ts for full rationale) ─
        let loyaltyPoints:       number = (user as any).loyaltyPoints       ?? null;
        let deliveredOrderCount: number = (user as any).deliveredOrderCount ?? null;

        const repairFields: Record<string, number> = {};

        if (loyaltyPoints == null || isNaN(loyaltyPoints)) {
            const agg = await LoyaltyLedger.aggregate([
                { $match: { user: (user as any)._id } },
                { $group: { _id: null, total: { $sum: "$points" } } },
            ]);
            loyaltyPoints = agg[0]?.total ?? 0;
            repairFields.loyaltyPoints = loyaltyPoints;
        }

        if (deliveredOrderCount == null || isNaN(deliveredOrderCount)) {
            deliveredOrderCount = await Order.countDocuments({
                user:   (user as any)._id,
                status: "delivered",
            });
            repairFields.deliveredOrderCount = deliveredOrderCount;
        }

        if (Object.keys(repairFields).length > 0) {
            User.findByIdAndUpdate(userId, { $set: repairFields })
                .lean()
                .catch((err) => console.error("ADMIN_USER_LEDGER_REPAIR_ERROR", err));
        }

        return NextResponse.json({
            success: true,
            user: {
                id:                  (user as any)._id.toString(),
                name:                (user as any).name,
                email:               (user as any).email,
                phone:               (user as any).phone               ?? "",
                loyaltyPoints,
                referralCode:        (user as any).referralCode         ?? null,
                deliveredOrderCount,
                referredBy: (user as any).referredBy
                    ? { name: (user as any).referredBy.name, email: (user as any).referredBy.email }
                    : null,
            },
            ledger: (ledger as any[]).map((e) => ({
                id:           e._id.toString(),
                type:         e.type,
                points:       e.points,
                balanceAfter: e.balanceAfter,
                note:         e.note ?? "",
                order: e.order
                    ? { orderId: e.order.orderId, total: e.order.totalAmount, createdAt: e.order.createdAt }
                    : null,
                referredUser: e.referredUser
                    ? { name: e.referredUser.name, email: e.referredUser.email }
                    : null,
                createdAt: e.createdAt,
            })),
        });
    } catch (err) {
        console.error("ADMIN_USER_LEDGER_ERROR", err);
        return NextResponse.json(
            { success: false, message: "Failed to fetch user ledger" },
            { status: 500 }
        );
    }
}
