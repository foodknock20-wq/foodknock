export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import OfflineDistribution from "@/models/OfflineDistribution";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const { id } = await params;
        const body = await req.json().catch(() => ({}));

        const update: Record<string, unknown> = {};
        if (body.locationLabel !== undefined) update.locationLabel = String(body.locationLabel).trim().slice(0, 120);
        if (body.distributedCount !== undefined) update.distributedCount = Math.max(0, Number(body.distributedCount));
        if (body.redeemedCount !== undefined) update.redeemedCount = Math.max(0, Number(body.redeemedCount));
        if (body.notes !== undefined) update.notes = String(body.notes).trim().slice(0, 500);

        const updated = await OfflineDistribution.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
        if (!updated) return NextResponse.json({ success: false, message: "Entry not found" }, { status: 404 });
        return NextResponse.json({ success: true, entry: updated });
    } catch (error) {
        console.error("ADMIN_OFFLINE_DISTRIBUTION_UPDATE_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to update entry" }, { status: 400 });
    }
}
