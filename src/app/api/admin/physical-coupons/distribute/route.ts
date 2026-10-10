export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { markPhysicalCouponsDistributed } from "@/lib/physicalCoupons";

export async function POST(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const body = await req.json().catch(() => ({}));
        if (!body.campaignId) throw new Error("campaignId is required");
        const result = await markPhysicalCouponsDistributed({
            campaignId: String(body.campaignId),
            rewardLabel: body.rewardLabel ? String(body.rewardLabel) : undefined,
            quantity: Number(body.quantity),
        });
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("ADMIN_PHYSICAL_COUPON_DISTRIBUTE_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to mark coupons distributed";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
