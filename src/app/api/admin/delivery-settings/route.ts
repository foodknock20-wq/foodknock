export const dynamic = "force-dynamic";

// src/app/api/admin/delivery-settings/route.ts
//
// Phase 10 — admin-only read/write access to the single authoritative
// DeliverySettings document. Every validation rule (radius > 0, non-
// overlapping distance ranges, lat/lng bounds, etc.) lives in
// src/lib/deliverySettings.ts's updateDeliverySettings() — this route only
// adds the authorization boundary, never re-implements validation.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getDeliverySettings, updateDeliverySettings, type DeliverySettingsPatch } from "@/lib/deliverySettings";

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
    }

    try {
        const settings = await getDeliverySettings();
        return NextResponse.json({ success: true, settings });
    } catch (error) {
        console.error("GET_DELIVERY_SETTINGS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load delivery settings" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
    }

    try {
        const body = (await req.json().catch(() => ({}))) as DeliverySettingsPatch;
        const settings = await updateDeliverySettings(body);
        return NextResponse.json({ success: true, settings });
    } catch (error) {
        console.error("PATCH_DELIVERY_SETTINGS_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to update delivery settings";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
