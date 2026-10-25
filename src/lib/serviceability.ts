// src/lib/serviceability.ts
//
// Phase 10 — Location & Serviceability 2.0.
//
// THE single authoritative place distance/serviceability/delivery-fee is
// calculated. Every caller — the public preview API, checkout, and every
// order-creation route (COD, Razorpay create-order/verify, legacy /api/orders)
// — calls calculateDeliveryPricing() here. Never reimplement this logic
// per-caller (that was exactly the bug class Phase 2A fixed for item pricing;
// same discipline applies here).
//
// ── Rollout safety (read this before changing the fallback behavior) ───────
// This ships onto a LIVE site. No trusted kitchen coordinate exists in the
// database yet (confirmed by audit, not assumed) — the admin must enter one
// via /admin/delivery. Until they do, `kitchen.latitude`/`longitude` are
// null, and this function falls back to the pre-Phase-10 flat-rate behavior
// (src/lib/delivery.ts's FLAT_DELIVERY_FEE) rather than blocking checkout
// for every single customer. Once the admin sets real coordinates,
// distance-based serviceability activates automatically — no deploy needed.
//
// A customer whose chosen location has no coordinates at all (fully manual
// address, no GPS, no saved address with lat/lng) is treated as
// "location selection required" (reason: "coordinates_required"), NOT
// silently assumed serviceable and NOT geocoded from a typed city name.

import { getDeliverySettings, type DistanceRule } from "@/lib/deliverySettings";
import { checkFirstFreeDelivery } from "@/lib/firstFreeDelivery";
import { FLAT_DELIVERY_FEE } from "@/lib/delivery";

export type FreeDeliveryReason = "first_order" | "threshold" | null;

export type ServiceabilityReason =
    | "kitchen_not_configured"
    | "kitchen_inactive"
    | "coordinates_required"
    | "outside_radius"
    | null;

export type DeliveryPricingResult = {
    serviceable: boolean;
    distanceKm: number | null;
    radiusKm: number;
    deliveryFee: number;
    minimumOrderValue: number;
    /** COD maximum-cap: COD allowed only for orders strictly below this (resolved server-side). */
    codMaxOrderAmount: number;
    freeDelivery: boolean;
    freeDeliveryReason: FreeDeliveryReason;
    remainingForFreeDelivery: number;
    reason: ServiceabilityReason;
    /** True when the kitchen-not-configured flat-rate safety net was used. */
    usedFallback: boolean;
};

export type DeliveryPricingInput = {
    latitude: number | null | undefined;
    longitude: number | null | undefined;
    cartSubtotal: number;
    linkedUserId: string | null;
    orderType: "delivery" | "pickup" | string;
};

/** Straight-line (great-circle) distance in km. Not road distance. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius, km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
    return (
        typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
        typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180
    );
}

/** Deterministic match: active rules only, inclusive bounds, lowest toKm wins ties. */
function matchDistanceRule(distanceKm: number, rules: DistanceRule[]): DistanceRule | null {
    const candidates = rules.filter((r) => r.active && distanceKm >= r.fromKm && distanceKm <= r.toKm);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, r) => (r.toKm < best.toKm ? r : best), candidates[0]);
}

export async function calculateDeliveryPricing(input: DeliveryPricingInput): Promise<DeliveryPricingResult> {
    const settings = await getDeliverySettings();
    const minimumOrderValue = settings.orderRules.minimumOrderValue;
    const codMaxOrderAmount = settings.orderRules.codMaxOrderAmount;

    // Pickup never has a delivery fee or a serviceability concern.
    if (input.orderType === "pickup") {
        return {
            serviceable: true,
            distanceKm: null,
            radiusKm: settings.serviceability.maxRadiusKm,
            deliveryFee: 0,
            minimumOrderValue,
            codMaxOrderAmount,
            freeDelivery: true,
            freeDeliveryReason: null,
            remainingForFreeDelivery: 0,
            reason: null,
            usedFallback: false,
        };
    }

    const kitchenConfigured = isValidCoordinate(settings.kitchen.latitude, settings.kitchen.longitude);
    const customerCoordsAvailable = isValidCoordinate(input.latitude, input.longitude);

    // ── Free-delivery overrides, computed once, applied at the end ────────
    const applyFreeDeliveryOverrides = async (): Promise<{ free: boolean; reason: FreeDeliveryReason }> => {
        if (settings.freeDelivery.firstOrderFreeEnabled) {
            const { eligible } = await checkFirstFreeDelivery(input.linkedUserId, input.orderType);
            if (eligible) return { free: true, reason: "first_order" };
        }
        if (settings.freeDelivery.thresholdEnabled && input.cartSubtotal >= settings.freeDelivery.thresholdAmount) {
            return { free: true, reason: "threshold" };
        }
        return { free: false, reason: null };
    };

    const remaining = (free: boolean) =>
        free || !settings.freeDelivery.thresholdEnabled
            ? 0
            : Math.max(0, settings.freeDelivery.thresholdAmount - input.cartSubtotal);

    // ── Fallback: kitchen not configured yet — preserve pre-Phase-10 behavior ─
    //
    // Phase 17.2 (F10): this fallback is a DELIBERATE rollout-safety
    // decision (see file header) — changing it to fail-closed here would
    // risk blocking checkout for every customer if this condition is ever
    // true in production, which cannot be verified from source alone.
    // What was missing is visibility: `usedFallback`/`kitchen_not_configured`
    // was already computed and returned but never surfaced anywhere,
    // so an admin who forgot to configure kitchen coordinates had no
    // signal that distance-based serviceability was silently a no-op.
    // This log is the minimal, non-breaking fix — it changes no
    // customer-facing behavior, only operational visibility.
    if (!kitchenConfigured) {
        console.warn("SERVICEABILITY_KITCHEN_NOT_CONFIGURED — distance-based serviceability is currently a no-op; configure kitchen coordinates in /admin/delivery");
        const { free, reason } = await applyFreeDeliveryOverrides();
        return {
            serviceable: true,
            distanceKm: null,
            radiusKm: settings.serviceability.maxRadiusKm,
            deliveryFee: free ? 0 : FLAT_DELIVERY_FEE,
            minimumOrderValue,
            codMaxOrderAmount,
            freeDelivery: free,
            freeDeliveryReason: reason,
            remainingForFreeDelivery: remaining(free),
            reason: "kitchen_not_configured",
            usedFallback: true,
        };
    }

    if (!settings.kitchen.active) {
        return {
            serviceable: false,
            distanceKm: null,
            radiusKm: settings.serviceability.maxRadiusKm,
            deliveryFee: 0,
            minimumOrderValue,
            codMaxOrderAmount,
            freeDelivery: false,
            freeDeliveryReason: null,
            remainingForFreeDelivery: 0,
            reason: "kitchen_inactive",
            usedFallback: false,
        };
    }

    if (!customerCoordsAvailable) {
        return {
            serviceable: false,
            distanceKm: null,
            radiusKm: settings.serviceability.maxRadiusKm,
            deliveryFee: 0,
            minimumOrderValue,
            codMaxOrderAmount,
            freeDelivery: false,
            freeDeliveryReason: null,
            remainingForFreeDelivery: 0,
            reason: "coordinates_required",
            usedFallback: false,
        };
    }

    const distanceKm = Math.round(
        haversineKm(
            settings.kitchen.latitude as number,
            settings.kitchen.longitude as number,
            input.latitude as number,
            input.longitude as number
        ) * 100
    ) / 100;

    if (distanceKm > settings.serviceability.maxRadiusKm) {
        return {
            serviceable: false,
            distanceKm,
            radiusKm: settings.serviceability.maxRadiusKm,
            deliveryFee: 0,
            minimumOrderValue,
            codMaxOrderAmount,
            freeDelivery: false,
            freeDeliveryReason: null,
            remainingForFreeDelivery: 0,
            reason: "outside_radius",
            usedFallback: false,
        };
    }

    const matchedRule = matchDistanceRule(distanceKm, settings.distanceRules);
    const distanceFee = matchedRule ? matchedRule.fee : FLAT_DELIVERY_FEE;

    const { free, reason } = await applyFreeDeliveryOverrides();

    return {
        serviceable: true,
        distanceKm,
        radiusKm: settings.serviceability.maxRadiusKm,
        deliveryFee: free ? 0 : distanceFee,
        minimumOrderValue,
        codMaxOrderAmount,
        freeDelivery: free,
        freeDeliveryReason: reason,
        remainingForFreeDelivery: remaining(free),
        reason: null,
        usedFallback: false,
    };
}
