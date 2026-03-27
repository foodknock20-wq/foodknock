export const dynamic = "force-dynamic";

// src/app/api/loyalty/route.ts
// GET  — returns the logged-in user's live loyalty balance + transaction history
// POST — validates and executes a point redemption request at checkout

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/lib/db";
import User            from "@/models/User";
import LoyaltyLedger  from "@/models/LoyaltyLedger";
import Order           from "@/models/Order";
import { verifyToken } from "@/lib/auth";
import {
    redeemPoints,
    LOYALTY_CONFIG,
    maxRedeemablePoints,
    pointsToRupees,
} from "@/lib/loyaltyService";

// ── Auth helper ─────────────────────────────────────────────────────────────
function getUserIdFromCookie(req: NextRequest): string | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match        = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token        = match ? decodeURIComponent(match[1]) : null;
    if (!token) return null;
    try {
        const decoded = verifyToken(token) as { userId?: string };
        return decoded?.userId ?? null;
    } catch {
        // Token is expired, tampered, or JWT_SECRET changed — not authenticated.
        return null;
    }
}

// ── GET /api/loyalty ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const userId = getUserIdFromCookie(req);
    if (!userId) {
        return NextResponse.json(
            { success: false, message: "Not authenticated" },
            { status: 401 }
        );
    }

    try {
        await connectDB();

        const [user, ledgerDocs] = await Promise.all([
            User.findById(userId)
                .select("loyaltyPoints referralCode deliveredOrderCount isActive")
                .lean(),
            LoyaltyLedger.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(50)
                .populate("order",        "orderId totalAmount")
                .populate("referredUser", "name")
                .lean(),
        ]);

        if (!user) {
            return NextResponse.json(
                { success: false, message: "User not found" },
                { status: 404 }
            );
        }

        // Honour the same account-suspension check that auth/me applies.
        // This keeps the loyalty page consistent with the rest of the app.
        if ((user as any).isActive === false) {
            return NextResponse.json(
                { success: false, message: "Your account has been suspended. Please contact support." },
                { status: 403 }
            );
        }

        // ── loyaltyPoints — prefer cached value, fall back to ledger sum ──
        //
        // User.loyaltyPoints is a denormalised cache of the ledger sum.  It can
        // be stale or null on old documents or after a failed transaction-era
        // write.  When that happens, recompute from the ledger and repair the
        // cached value so future reads are fast again.

        let balance: number = (user as any).loyaltyPoints;
        const repairFields: Record<string, number> = {};

        if (balance == null || !Number.isFinite(balance)) {
            const agg = await LoyaltyLedger.aggregate([
                { $match: { user: (user as any)._id } },
                { $group: { _id: null, total: { $sum: "$points" } } },
            ]);
            balance = agg[0]?.total ?? 0;
            repairFields.loyaltyPoints = balance;
        }

        // ── deliveredOrderCount — same stale-field treatment ─────────────
        let deliveredOrderCount: number = (user as any).deliveredOrderCount;

        if (deliveredOrderCount == null || !Number.isFinite(deliveredOrderCount)) {
            deliveredOrderCount = await Order.countDocuments({
                user:   (user as any)._id,
                status: "delivered",
            });
            repairFields.deliveredOrderCount = deliveredOrderCount;
        }

        // Persist repairs fire-and-forget — next request will be fast.
        if (Object.keys(repairFields).length > 0) {
            User.findByIdAndUpdate(userId, { $set: repairFields })
                .lean()
                .catch((err) => console.error("LOYALTY_GET_REPAIR_ERROR", err));
        }

        // ── Build a stable, explicit response shape ───────────────────────
        //
        // Every numeric field is coerced with Number() and given a safe fallback
        // before it leaves this route.  This prevents the frontend from ever
        // rendering NaN / undefined even if something upstream goes wrong.

        return NextResponse.json({
            success:             true,
            balance:             Number(balance)             || 0,
            referralCode:        (user as any).referralCode  ?? null,
            deliveredOrderCount: Number(deliveredOrderCount) || 0,
            pointValueInr:       Number(LOYALTY_CONFIG.POINT_VALUE_INR)  || 0.5,
            minRedeem:           Number(LOYALTY_CONFIG.MIN_REDEEM_POINTS) || 50,
            maxRedemptionPct:    Number(LOYALTY_CONFIG.MAX_REDEMPTION_PCT) || 0.2,
            ledger: (ledgerDocs as any[]).map((e) => ({
                id:           e._id.toString(),
                type:         e.type,
                points:       Number(e.points)       || 0,
                balanceAfter: Number(e.balanceAfter) || 0,
                note:         e.note                 ?? "",
                order: e.order
                    ? {
                        id:      e.order._id.toString(),
                        orderId: e.order.orderId,
                        total:   Number(e.order.totalAmount) || 0,
                      }
                    : null,
                referredUser: e.referredUser
                    ? { name: e.referredUser.name }
                    : null,
                createdAt: e.createdAt,
            })),
        });
    } catch (err) {
        console.error("GET_LOYALTY_ERROR", err);
        return NextResponse.json(
            { success: false, message: "Failed to fetch loyalty data" },
            { status: 500 }
        );
    }
}

// ── POST /api/loyalty — redeem points at checkout ────────────────────────────
export async function POST(req: NextRequest) {
    const userId = getUserIdFromCookie(req);
    if (!userId) {
        return NextResponse.json(
            { success: false, message: "Not authenticated" },
            { status: 401 }
        );
    }

    try {
        await connectDB();

        const body                                    = await req.json();
        const { pointsToRedeem, orderTotal, orderId } = body;

        // ── Input validation ───────────────────────────────────────────────
        if (
            typeof pointsToRedeem !== "number" ||
            !Number.isFinite(pointsToRedeem)    ||
            pointsToRedeem <= 0
        ) {
            return NextResponse.json(
                { success: false, message: "pointsToRedeem must be a positive finite number" },
                { status: 400 }
            );
        }
        if (!orderId || typeof orderId !== "string") {
            return NextResponse.json(
                { success: false, message: "orderId is required" },
                { status: 400 }
            );
        }
        if (typeof orderTotal !== "number" || orderTotal <= 0) {
            return NextResponse.json(
                { success: false, message: "orderTotal must be a positive number" },
                { status: 400 }
            );
        }

        // ── Live balance ───────────────────────────────────────────────────
        const user = await User.findById(userId).select("loyaltyPoints").lean();
        if (!user) {
            return NextResponse.json(
                { success: false, message: "User not found" },
                { status: 404 }
            );
        }
        const balance = Number((user as any).loyaltyPoints) || 0;

        // ── Business rules ─────────────────────────────────────────────────
        if (pointsToRedeem < LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
            return NextResponse.json(
                { success: false, message: `Minimum ${LOYALTY_CONFIG.MIN_REDEEM_POINTS} points required to redeem` },
                { status: 400 }
            );
        }
        const maxRedeemable = maxRedeemablePoints(orderTotal, balance);
        if (pointsToRedeem > maxRedeemable) {
            return NextResponse.json(
                {
                    success:        false,
                    message:        `You can redeem at most ${maxRedeemable} points on this order`,
                    maxRedeemable,
                },
                { status: 400 }
            );
        }

        // ── Idempotency guard ──────────────────────────────────────────────
        const alreadyRedeemed = await LoyaltyLedger.exists({
            user:  userId,
            order: orderId,
            type:  "redemption",
        });
        if (alreadyRedeemed) {
            return NextResponse.json(
                { success: false, message: "Points have already been redeemed for this order" },
                { status: 409 }
            );
        }

        // ── Execute ────────────────────────────────────────────────────────
        const discountRupees = await redeemPoints({
    userId,
    points:  pointsToRedeem,
    orderMongoId: orderId,   // ✅ FIXED
    note: `Redeemed ${pointsToRedeem} pts → ₹${pointsToRupees(pointsToRedeem)} discount`,
});

        return NextResponse.json({
            success:        true,
            pointsRedeemed: pointsToRedeem,
            discountRupees,
            newBalance:     balance - pointsToRedeem,
        });
    } catch (err: any) {
        console.error("REDEEM_LOYALTY_ERROR", err);
        return NextResponse.json(
            { success: false, message: err.message ?? "Failed to redeem points" },
            { status: 500 }
        );
    }
}