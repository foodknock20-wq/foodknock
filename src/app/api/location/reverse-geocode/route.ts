export const dynamic = "force-dynamic";

// src/app/api/location/reverse-geocode/route.ts
//
// Phase 10B — public, read-only, address-text-assistance ONLY. Coordinates
// remain authoritative for serviceability (src/lib/serviceability.ts) —
// this route never feeds into that calculation, it just helps populate
// human-readable form fields after GPS detection. Rate-limited the same
// way /api/delivery/serviceability is, since it's also a public, bounded,
// cheap-but-not-free (outbound HTTP) endpoint.

import { NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

export async function POST(req: Request) {
    try {
        const ip = getClientIp(req);
        if (await isRateLimited(`reverse-geocode:${ip}`, 30, 60 * 1000)) {
            return NextResponse.json(
                { success: false, message: "Too many requests. Please try again shortly." },
                { status: 429 }
            );
        }

        const body = await req.json().catch(() => null);
        const lat = Number(body?.latitude);
        const lng = Number(body?.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return NextResponse.json({ success: false, message: "Latitude and longitude are required" }, { status: 400 });
        }

        const result = await reverseGeocode(lat, lng);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("REVERSE_GEOCODE_ROUTE_ERROR", error);
        // Graceful — the customer can still enter their address manually.
        return NextResponse.json({ success: true, locality: "", city: "", state: "", pincode: "", road: "", displayLabel: "" });
    }
}
