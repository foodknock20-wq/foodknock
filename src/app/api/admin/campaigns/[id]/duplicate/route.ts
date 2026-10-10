export const dynamic = "force-dynamic";

// Phase 12 spec §51 — duplicate must NOT carry over historical usage,
// redeemed coupons, spin records, or analytics. duplicateCampaign()
// copies only reusable configuration and always resets to status "draft"
// with no start/end dates.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { duplicateCampaign } from "@/lib/adminCampaigns";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const { id } = await params;
        const campaign = await duplicateCampaign(id);
        return NextResponse.json({ success: true, campaign }, { status: 201 });
    } catch (error) {
        console.error("ADMIN_CAMPAIGN_DUPLICATE_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to duplicate campaign";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
