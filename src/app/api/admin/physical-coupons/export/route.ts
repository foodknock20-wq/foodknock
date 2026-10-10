export const dynamic = "force-dynamic";

// src/app/api/admin/physical-coupons/export/route.ts
//
// Phase 12 completion — CSV export, bounded (same MAX_LIST_LIMIT-style cap
// as the list route, just higher since this is a deliberate bulk pull —
// still never the literal entire collection unbounded).

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import Coupon from "@/models/Coupon";
import { couponsToCsv } from "@/lib/physicalCoupons";

const MAX_EXPORT = 10_000;

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const url = new URL(req.url);
        const campaignId = url.searchParams.get("campaignId") ?? undefined;

        const filter: Record<string, unknown> = { source: "physical" };
        if (campaignId) filter.campaignId = campaignId;

        const coupons = await Coupon.find(filter)
            .select("code physicalRewardLabel status physicalStatus expiresAt")
            .sort({ createdAt: -1 })
            .limit(MAX_EXPORT)
            .lean();

        const csv = couponsToCsv(coupons);
        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="foodknock-physical-coupons-${Date.now()}.csv"`,
            },
        });
    } catch (error) {
        console.error("ADMIN_PHYSICAL_COUPON_EXPORT_ERROR", error);
        return NextResponse.json({ success: false, message: "Export failed" }, { status: 500 });
    }
}
