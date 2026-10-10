export const dynamic = "force-dynamic";

// src/app/api/spin/history/route.ts
//
// Phase 12 — "My Rewards" wallet: past spins joined with their issued
// coupon's live status (AVAILABLE/USED/EXPIRED), derived from Phase 11's
// own Coupon fields — no duplicate reward-status storage (spec §17/§36).
// Bounded (max 50) — never the full history.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/apiAuth";
import SpinRecord from "@/models/SpinRecord";
import Coupon from "@/models/Coupon";

const MAX_HISTORY = 50;

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) {
        return NextResponse.json({ success: false, message: "Please log in." }, { status: 401 });
    }

    try {
        await connectDB();

        const spins = await SpinRecord.find({ user: user.userId })
            .sort({ createdAt: -1 })
            .limit(MAX_HISTORY)
            .lean<Array<{
                _id: unknown; pointsCost: number; rewardLabel: string; rewardType: string;
                rewardValue: number; couponId: unknown | null; pointsAwarded: number; createdAt: Date;
            }>>();

        const couponIds = spins.map((s) => s.couponId).filter(Boolean);
        const coupons = couponIds.length
            ? await Coupon.find({ _id: { $in: couponIds } })
                  .select("code status usedCount usageLimit expiresAt minimumOrderValue discountType discountValue maximumDiscount")
                  .lean<Array<{ _id: unknown; code: string; status: string; usedCount: number; usageLimit: number | null; expiresAt: Date | null; minimumOrderValue: number; discountType: string; discountValue: number; maximumDiscount: number | null }>>()
            : [];
        const couponMap = new Map(coupons.map((c) => [String(c._id), c]));

        const now = Date.now();

        const items = spins.map((s) => {
            const coupon = s.couponId ? couponMap.get(String(s.couponId)) : null;

            let walletStatus: "AVAILABLE" | "USED" | "EXPIRED" | "POINTS" = "POINTS";
            let code: string | null = null;
            let expiresAt: string | null = null;
            let minimumOrderValue = 0;

            if (coupon) {
                code = coupon.code;
                expiresAt = coupon.expiresAt ? coupon.expiresAt.toISOString() : null;
                minimumOrderValue = coupon.minimumOrderValue;
                const isUsed = coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit;
                const isExpired = coupon.expiresAt && coupon.expiresAt.getTime() < now;
                walletStatus = isUsed ? "USED" : isExpired ? "EXPIRED" : "AVAILABLE";
            }

            return {
                id: String(s._id),
                rewardLabel: s.rewardLabel,
                rewardType: s.rewardType,
                rewardValue: s.rewardValue,
                pointsAwarded: s.pointsAwarded,
                couponCode: code,
                walletStatus,
                expiresAt,
                minimumOrderValue,
                createdAt: s.createdAt,
            };
        });

        return NextResponse.json({ success: true, items });
    } catch (error) {
        console.error("SPIN_HISTORY_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load spin history" }, { status: 500 });
    }
}
