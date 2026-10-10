export const dynamic = "force-dynamic";

// src/app/api/admin/spin-rewards/route.ts
//
// Phase 12 — list the Digital Spin's 8-slot catalog (seeded on first read
// via getSpinCatalog()). No POST here — the catalog is a fixed-shape
// config table, not a free-growing collection; admin edits existing slots
// via PATCH /api/admin/spin-rewards/[id].

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { getSpinCatalog } from "@/lib/spin";

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const slots = await getSpinCatalog();
        return NextResponse.json({ success: true, slots });
    } catch (error) {
        console.error("ADMIN_SPIN_REWARDS_LIST_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load spin rewards" }, { status: 500 });
    }
}
