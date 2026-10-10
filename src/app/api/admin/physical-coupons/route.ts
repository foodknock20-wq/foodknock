export const dynamic = "force-dynamic";

// src/app/api/admin/physical-coupons/route.ts
//
// Phase 12 completion — Physical Diwali coupon pool. GET lists (bounded,
// filterable) + returns the real summary counts; POST generates a new
// batch. Admin-only — client users can never generate codes.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import {
    generatePhysicalCouponPool,
    listPhysicalCoupons,
    getPhysicalPoolSummary,
    type GeneratePhysicalPoolInput,
} from "@/lib/physicalCoupons";

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const url = new URL(req.url);
        const campaignId = url.searchParams.get("campaignId") ?? undefined;

        const [list, summary] = await Promise.all([
            listPhysicalCoupons({
                campaignId,
                physicalStatus: (url.searchParams.get("physicalStatus") as "GENERATED" | "DISTRIBUTED" | null) ?? undefined,
                rewardLabel: url.searchParams.get("rewardLabel") ?? undefined,
                search: url.searchParams.get("search") ?? undefined,
                page: Number(url.searchParams.get("page") ?? 1),
                limit: Number(url.searchParams.get("limit") ?? 50),
            }),
            getPhysicalPoolSummary(campaignId),
        ]);

        return NextResponse.json({ success: true, ...list, summary });
    } catch (error) {
        console.error("ADMIN_PHYSICAL_COUPONS_LIST_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load physical coupons" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const body = (await req.json().catch(() => ({}))) as GeneratePhysicalPoolInput;
        const result = await generatePhysicalCouponPool(body);
        return NextResponse.json({ success: true, ...result }, { status: 201 });
    } catch (error) {
        console.error("ADMIN_PHYSICAL_COUPON_GENERATE_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to generate physical coupon pool";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
