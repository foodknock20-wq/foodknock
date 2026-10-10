export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import SpinRewardConfig from "@/models/SpinRewardConfig";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const { id } = await params;
        const body = await req.json().catch(() => ({}));

        // Explicit allowlist — never spread the raw body into the document.
        const update: Record<string, unknown> = {};
        if (body.label !== undefined) update.label = String(body.label).trim().slice(0, 60);
        if (body.value !== undefined) update.value = Math.max(0, Number(body.value));
        if (body.maximumDiscount !== undefined) {
            update.maximumDiscount = body.maximumDiscount == null ? null : Math.max(0, Number(body.maximumDiscount));
        }
        if (body.minimumOrderValue !== undefined) update.minimumOrderValue = Math.max(0, Number(body.minimumOrderValue));
        if (body.weight !== undefined) update.weight = Math.max(1, Number(body.weight));
        if (body.expiryDays !== undefined) update.expiryDays = Math.max(1, Math.floor(Number(body.expiryDays)));
        if (body.active !== undefined) update.active = !!body.active;

        const updated = await SpinRewardConfig.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
        if (!updated) {
            return NextResponse.json({ success: false, message: "Reward slot not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, slot: updated });
    } catch (error) {
        console.error("ADMIN_SPIN_REWARD_UPDATE_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to update reward slot" }, { status: 400 });
    }
}
