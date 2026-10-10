export const dynamic = "force-dynamic";

// src/app/api/admin/delivery-settings/test/route.ts
//
// Phase 10 — small admin-only "Test Serviceability" tool (spec §59). Reuses
// the exact same calculateDeliveryPricing() every checkout/order path uses
// — never a second, parallel calculation — so what the admin sees here is
// guaranteed to match real checkout behavior.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { calculateDeliveryPricing } from "@/lib/serviceability";

export async function POST(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
    }

    try {
        const body = await req.json().catch(() => null);
        const latitude = Number(body?.latitude);
        const longitude = Number(body?.longitude);

        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
            return NextResponse.json({ success: false, message: "Latitude must be between -90 and 90" }, { status: 400 });
        }
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
            return NextResponse.json({ success: false, message: "Longitude must be between -180 and 180" }, { status: 400 });
        }

        const result = await calculateDeliveryPricing({
            latitude,
            longitude,
            cartSubtotal: Number(body?.cartSubtotal) || 0,
            linkedUserId: null,
            orderType: "delivery",
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("ADMIN_TEST_SERVICEABILITY_ERROR", error);
        return NextResponse.json({ success: false, message: "Test failed" }, { status: 500 });
    }
}
