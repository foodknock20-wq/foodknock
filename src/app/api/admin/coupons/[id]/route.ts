export const dynamic = "force-dynamic";

// src/app/api/admin/coupons/[id]/route.ts
//
// Phase 11 — admin single-coupon edit (incl. pause/activate). No DELETE —
// pausing is the intended lifecycle action; a coupon already referenced by
// a CouponRedemption/Order snapshot must never be hard-deleted (would
// corrupt historical order display — see Order.ts coupon snapshot fields).

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { updateCoupon, type CouponUpdateInput } from "@/lib/adminCoupons";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
    }

    try {
        await connectDB();
        const { id } = await params;
        const body = (await req.json().catch(() => ({}))) as CouponUpdateInput;
        const coupon = await updateCoupon(id, body);
        return NextResponse.json({ success: true, coupon });
    } catch (error) {
        console.error("ADMIN_COUPON_UPDATE_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to update coupon";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
