export const dynamic = "force-dynamic";

// src/app/api/admin/coupons/route.ts
//
// Phase 11 — admin coupon list (bounded/paginated, never the full
// collection) and single-coupon creation. Mirrors the requireAdmin()
// pattern already used by /api/admin/delivery-settings.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { createCoupon, listCoupons, type CouponInput } from "@/lib/adminCoupons";

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
    }

    try {
        await connectDB();
        const url = new URL(req.url);
        const result = await listCoupons({
            status: (url.searchParams.get("status") as "ACTIVE" | "PAUSED" | null) ?? undefined,
            search: url.searchParams.get("search") ?? undefined,
            page: Number(url.searchParams.get("page") ?? 1),
            limit: Number(url.searchParams.get("limit") ?? 25),
        });
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("ADMIN_COUPONS_LIST_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load coupons" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
    }

    try {
        await connectDB();
        const body = (await req.json().catch(() => ({}))) as CouponInput;
        const coupon = await createCoupon(body);
        return NextResponse.json({ success: true, coupon }, { status: 201 });
    } catch (error) {
        console.error("ADMIN_COUPON_CREATE_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to create coupon";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
