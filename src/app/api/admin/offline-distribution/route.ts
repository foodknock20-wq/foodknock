export const dynamic = "force-dynamic";

// src/app/api/admin/offline-distribution/route.ts
//
// Phase 12 — simple manual log for the physical Diwali wheel (see
// OfflineDistribution.ts). Bounded list, explicit allowlist on create.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import OfflineDistribution from "@/models/OfflineDistribution";
import mongoose from "mongoose";

const MAX_LIMIT = 100;

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const url = new URL(req.url);
        const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
        const entries = await OfflineDistribution.find({}).sort({ date: -1 }).limit(limit).lean();
        return NextResponse.json({ success: true, entries });
    } catch (error) {
        console.error("ADMIN_OFFLINE_DISTRIBUTION_LIST_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load entries" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const body = await req.json().catch(() => ({}));

        const locationLabel = String(body.locationLabel ?? "").trim();
        if (!locationLabel) throw new Error("Location label is required");

        const date = body.date ? new Date(body.date) : new Date();
        if (Number.isNaN(date.getTime())) throw new Error("Invalid date");

        const campaignId = body.campaignId && mongoose.Types.ObjectId.isValid(body.campaignId) ? body.campaignId : null;

        const entry = await OfflineDistribution.create({
            campaignId,
            locationLabel,
            date,
            distributedCount: Math.max(0, Number(body.distributedCount ?? 0)),
            redeemedCount: Math.max(0, Number(body.redeemedCount ?? 0)),
            notes: String(body.notes ?? "").trim().slice(0, 500),
        });

        return NextResponse.json({ success: true, entry }, { status: 201 });
    } catch (error) {
        console.error("ADMIN_OFFLINE_DISTRIBUTION_CREATE_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to create entry";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
