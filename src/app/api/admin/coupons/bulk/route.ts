export const dynamic = "force-dynamic";

// src/app/api/admin/coupons/bulk/route.ts
//
// Phase 11 — bounded bulk coupon generation (admin only). Hard quantity
// cap + batched inserts live in src/lib/adminCoupons.ts; this route is
// just the authorization boundary.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { bulkGenerateCoupons, type BulkGenerateInput } from "@/lib/adminCoupons";

export async function POST(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
    }

    try {
        await connectDB();
        const body = (await req.json().catch(() => ({}))) as BulkGenerateInput;
        const result = await bulkGenerateCoupons(body);
        return NextResponse.json({ success: true, ...result }, { status: 201 });
    } catch (error) {
        console.error("ADMIN_COUPON_BULK_GENERATE_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to generate coupons";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
