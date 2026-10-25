export const dynamic = "force-dynamic";

// src/app/api/delivery/serviceability/route.ts
//
// Phase 10 — public, read-only serviceability/delivery-fee PREVIEW. Used by
// the Navbar location picker, cart, and checkout to show the customer
// whether FoodKnock delivers to a coordinate and what it would cost —
// before they commit to anything. This is informational only: the actual
// authoritative check happens again, server-side, inside createOrderCore()
// at order-creation time (see src/lib/serviceability.ts's header). No auth
// required — same public-preview posture as /api/cart/validate — and the
// response never includes the kitchen's own coordinates or any other
// internal configuration detail.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { calculateDeliveryPricing } from "@/lib/serviceability";
import { getSessionUser } from "@/lib/apiAuth";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

export async function POST(req: Request) {
    try {
        const ip = getClientIp(req);
        if (await isRateLimited(`delivery-serviceability:${ip}`, 60, 60 * 1000)) {
            return NextResponse.json(
                { success: false, message: "Too many requests. Please try again shortly." },
                { status: 429 }
            );
        }

        const body = await req.json().catch(() => null);
        const latitude = typeof body?.latitude === "number" && Number.isFinite(body.latitude) ? body.latitude : null;
        const longitude = typeof body?.longitude === "number" && Number.isFinite(body.longitude) ? body.longitude : null;
        const cartSubtotal = typeof body?.cartSubtotal === "number" && Number.isFinite(body.cartSubtotal) && body.cartSubtotal >= 0
            ? body.cartSubtotal
            : 0;
        const orderType = body?.orderType === "pickup" ? "pickup" : "delivery";

        if (latitude === null || longitude === null) {
            return NextResponse.json(
                { success: false, message: "Latitude and longitude are required" },
                { status: 400 }
            );
        }
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return NextResponse.json(
                { success: false, message: "Invalid coordinates" },
                { status: 400 }
            );
        }

        await connectDB();

        // Logged-in session is read cheaply (no DB round trip — JWT claims
        // only) purely to let first-order-free eligibility be reflected in
        // this preview too. Never required; a guest still gets a full,
        // correct serviceability/fee preview.
        const session = getSessionUser(req);

        const result = await calculateDeliveryPricing({
            latitude,
            longitude,
            cartSubtotal,
            linkedUserId: session?.userId ?? null,
            orderType,
        });

        return NextResponse.json({
            success: true,
            serviceable: result.serviceable,
            distanceKm: result.distanceKm,
            radiusKm: result.radiusKm,
            deliveryFee: result.deliveryFee,
            minimumOrderValue: result.minimumOrderValue,
            codMaxOrderAmount: result.codMaxOrderAmount,
            freeDelivery: result.freeDelivery,
            freeDeliveryReason: result.freeDeliveryReason,
            remainingForFreeDelivery: result.remainingForFreeDelivery,
            reason: result.reason,
        });
    } catch (error) {
        console.error("DELIVERY_SERVICEABILITY_ERROR", error);
        return NextResponse.json(
            { success: false, message: "We couldn't check delivery availability right now. Please try again." },
            { status: 500 }
        );
    }
}
