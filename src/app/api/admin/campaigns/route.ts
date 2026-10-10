export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { createCampaign, listCampaigns, type CampaignInput } from "@/lib/adminCampaigns";
import type { CampaignStatus } from "@/models/Campaign";

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const url = new URL(req.url);
        const result = await listCampaigns({
            status: (url.searchParams.get("status") as CampaignStatus | null) ?? undefined,
            page: Number(url.searchParams.get("page") ?? 1),
            limit: Number(url.searchParams.get("limit") ?? 25),
        });
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("ADMIN_CAMPAIGNS_LIST_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load campaigns" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const body = (await req.json().catch(() => ({}))) as CampaignInput;
        const campaign = await createCampaign(body);
        return NextResponse.json({ success: true, campaign }, { status: 201 });
    } catch (error) {
        console.error("ADMIN_CAMPAIGN_CREATE_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to create campaign";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
