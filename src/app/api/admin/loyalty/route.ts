export const dynamic = "force-dynamic";

// src/app/api/admin/loyalty/route.ts
// Admin-only loyalty management.
// GET  — paginated list of users with loyalty balances
// POST — manual credit or debit for a specific user

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB }   from "@/lib/db";
import User            from "@/models/User";
import LoyaltyLedger  from "@/models/LoyaltyLedger";
import Order           from "@/models/Order";
import { verifyToken } from "@/lib/auth";
import { awardPoints } from "@/lib/loyaltyService";

// ── Admin guard ────────────────────────────────────────────────────────────
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

// ── GET /api/admin/loyalty ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    if (!isAdmin(req)) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const limit  = 20;
        const search = searchParams.get("search")?.trim() ?? "";

        const filter: Record<string, unknown> = { role: "user" };
        if (search) {
            const re = new RegExp(search, "i");
            filter.$or = [{ name: re }, { email: re }, { phone: re }];
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select("_id name email phone loyaltyPoints referralCode deliveredOrderCount createdAt")
                .sort({ loyaltyPoints: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            User.countDocuments(filter),
        ]);

        // ── Repair stale / missing cached fields ───────────────────────────
        //
        // loyaltyPoints and deliveredOrderCount can be null / undefined on
        // documents that pre-date the loyalty system, or on documents where
        // the old transaction-based write path failed silently on Atlas free
        // tier, leaving LoyaltyLedger entries but no corresponding User update.
        //
        // The repairs here are fire-and-forget (non-blocking) because the
        // corrected values are returned to the UI in-memory immediately.
        //
        // ⚠️  The POST debit handler does NOT rely on these writes completing.
        // It applies its own synchronous repair so the $inc in awardPoints
        // always starts from the correct base value — see the POST handler.

        const repairOps: Promise<unknown>[] = [];

        const repairedUsers = await Promise.all(
            (users as any[]).map(async (u) => {
                let { loyaltyPoints, deliveredOrderCount } = u;

                const loyaltyStale =
                    loyaltyPoints == null || !Number.isFinite(loyaltyPoints);
                const countStale   =
                    deliveredOrderCount == null || !Number.isFinite(deliveredOrderCount);

                if (!loyaltyStale && !countStale) return u;

                const repairFields: Record<string, number> = {};

                if (loyaltyStale) {
                    const agg = await LoyaltyLedger.aggregate([
                        { $match: { user: u._id } },
                        { $group: { _id: null, total: { $sum: "$points" } } },
                    ]);
                    loyaltyPoints = agg[0]?.total ?? 0;
                    repairFields.loyaltyPoints = loyaltyPoints;
                }

                if (countStale) {
                    deliveredOrderCount = await Order.countDocuments({
                        user:   u._id,
                        status: "delivered",
                    });
                    repairFields.deliveredOrderCount = deliveredOrderCount;
                }

                repairOps.push(
                    User.findByIdAndUpdate(u._id, { $set: repairFields }).lean()
                );

                return { ...u, loyaltyPoints, deliveredOrderCount };
            })
        );

        if (repairOps.length > 0) {
            Promise.all(repairOps).catch((err) =>
                console.error("ADMIN_LOYALTY_REPAIR_ERROR", err)
            );
        }

        return NextResponse.json({
            success:    true,
            page,
            totalPages: Math.ceil(total / limit),
            total,
            users: repairedUsers.map((u: any) => ({
                id:                  u._id.toString(),
                name:                u.name,
                email:               u.email,
                phone:               u.phone               ?? "",
                loyaltyPoints:       u.loyaltyPoints        ?? 0,
                referralCode:        u.referralCode         ?? null,
                deliveredOrderCount: u.deliveredOrderCount  ?? 0,
                joinedAt:            u.createdAt,
            })),
        });
    } catch (err) {
        console.error("ADMIN_LOYALTY_GET_ERROR", err);
        return NextResponse.json(
            { success: false, message: "Failed to fetch loyalty data" },
            { status: 500 }
        );
    }
}

// ── POST /api/admin/loyalty — manual credit or debit ──────────────────────
export async function POST(req: NextRequest) {
    if (!isAdmin(req)) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    try {
        await connectDB();

        const { userId, points, type, note } = await req.json();

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json(
                { success: false, message: "Valid userId required" },
                { status: 400 }
            );
        }
        if (typeof points !== "number" || points === 0 || !Number.isFinite(points)) {
            return NextResponse.json(
                { success: false, message: "points must be a non-zero finite number" },
                { status: 400 }
            );
        }
        if (!["admin_credit", "admin_debit"].includes(type)) {
            return NextResponse.json(
                { success: false, message: 'type must be "admin_credit" or "admin_debit"' },
                { status: 400 }
            );
        }

        const isDebit      = type === "admin_debit";
        const signedPoints = isDebit ? -Math.abs(points) : Math.abs(points);

        if (isDebit) {
            const user = await User.findById(userId).select("loyaltyPoints name").lean();
            if (!user) {
                return NextResponse.json(
                    { success: false, message: "User not found" },
                    { status: 404 }
                );
            }

            // ── Synchronous stale-field repair before balance check ────────
            //
            // The GET handler repairs User.loyaltyPoints fire-and-forget so the
            // list response stays fast.  This creates a race window:
            //
            //   1. GET returns loyaltyPoints = 275 (recomputed from ledger in memory).
            //   2. Admin sees 275, opens the debit modal, submits 100 pts.
            //   3. The async DB write from step 1 may not have landed yet.
            //   4. This POST reads User.loyaltyPoints → still null / 0 in DB.
            //   5. Balance check: (null ?? 0) = 0 < 100 → "insufficient points" ❌
            //
            // FIX: if the stored value is stale, recompute from the ledger and
            // AWAIT the repair write before doing the balance check.
            //
            // The await is also required for correctness of the subsequent
            // awardPoints call: awardPoints uses $inc against the stored value,
            // so the stored value must be accurate before we mutate it.
            // Without the await, $inc(null, -100) would make MongoDB initialise
            // the field to -100 instead of (liveBalance - 100).

            let liveBalance = (user as any).loyaltyPoints as number;

            if (liveBalance == null || !Number.isFinite(liveBalance)) {
                const agg = await LoyaltyLedger.aggregate([
                    { $match: { user: new mongoose.Types.ObjectId(userId) } },
                    { $group: { _id: null, total: { $sum: "$points" } } },
                ]);
                liveBalance = agg[0]?.total ?? 0;

                // Must be awaited — awardPoints will $inc from this value.
                await User.findByIdAndUpdate(userId, { $set: { loyaltyPoints: liveBalance } });
            }

            if (liveBalance < Math.abs(points)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `User has insufficient points to debit (balance: ${liveBalance}, requested: ${Math.abs(points)})`,
                    },
                    { status: 400 }
                );
            }
        }

        await awardPoints({
            userId,
            points: signedPoints,
            type,
            note:   note ?? (isDebit ? "System debit" : "System credit"),
        });

        const updated = await User.findById(userId).select("loyaltyPoints name").lean();

        return NextResponse.json({
            success:    true,
            message:    `${Math.abs(points)} points ${isDebit ? "debited from" : "credited to"} ${(updated as any)?.name}`,
            newBalance: (updated as any)?.loyaltyPoints ?? 0,
        });
    } catch (err: any) {
        console.error("ADMIN_LOYALTY_POST_ERROR", err);
        return NextResponse.json(
            { success: false, message: err.message ?? "Failed to update points" },
            { status: 500 }
        );
    }
}