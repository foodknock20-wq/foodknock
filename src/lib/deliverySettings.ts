// src/lib/deliverySettings.ts
//
// Phase 10 — single authoritative accessor for delivery/serviceability
// business configuration. Mirrors src/models/Shop.ts's singleton +
// in-process-cache pattern exactly (same 30s TTL philosophy — settings
// don't change every second, but an admin save must become authoritative
// for the next request within one cache cycle at most, never longer).
//
// Never query the DeliverySettings model directly from anywhere else —
// always go through getDeliverySettings()/updateDeliverySettings() so the
// cache stays coherent and validation is never bypassed.

import { connectDB } from "@/lib/db";
import DeliverySettings from "@/models/DeliverySettings";

export type DistanceRule = {
    _id?: string;
    fromKm: number;
    toKm: number;
    fee: number;
    active: boolean;
};

export type DeliverySettingsData = {
    kitchen: {
        name: string;
        address: string;
        latitude: number | null;
        longitude: number | null;
        active: boolean;
    };
    serviceability: { maxRadiusKm: number };
    orderRules: { minimumOrderValue: number };
    freeDelivery: {
        firstOrderFreeEnabled: boolean;
        thresholdEnabled: boolean;
        thresholdAmount: number;
    };
    distanceRules: DistanceRule[];
    updatedAt?: string;
};

const CACHE_TTL_MS = 30_000;

let cached: DeliverySettingsData | null = null;
let cacheExpiresAt = 0;

function isCacheValid(): boolean {
    return cached !== null && Date.now() < cacheExpiresAt;
}

function setCache(data: DeliverySettingsData): void {
    cached = data;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

function invalidateCache(): void {
    cached = null;
    cacheExpiresAt = 0;
}

type RawDistanceRule = { _id?: unknown; fromKm?: number; toKm?: number; fee?: number; active?: boolean };
type RawSettingsDoc = {
    kitchen?: { name?: string; address?: string; latitude?: number | null; longitude?: number | null; active?: boolean };
    serviceability?: { maxRadiusKm?: number };
    orderRules?: { minimumOrderValue?: number };
    freeDelivery?: { firstOrderFreeEnabled?: boolean; thresholdEnabled?: boolean; thresholdAmount?: number };
    distanceRules?: RawDistanceRule[];
    updatedAt?: Date | string;
};

function shape(doc: RawSettingsDoc): DeliverySettingsData {
    return {
        kitchen: {
            name: doc.kitchen?.name ?? "FoodKnock Kitchen",
            address: doc.kitchen?.address ?? "",
            latitude: typeof doc.kitchen?.latitude === "number" ? doc.kitchen.latitude : null,
            longitude: typeof doc.kitchen?.longitude === "number" ? doc.kitchen.longitude : null,
            active: doc.kitchen?.active ?? true,
        },
        serviceability: {
            maxRadiusKm: doc.serviceability?.maxRadiusKm ?? 15,
        },
        orderRules: {
            minimumOrderValue: doc.orderRules?.minimumOrderValue ?? 189,
        },
        freeDelivery: {
            firstOrderFreeEnabled: doc.freeDelivery?.firstOrderFreeEnabled ?? true,
            thresholdEnabled: doc.freeDelivery?.thresholdEnabled ?? true,
            thresholdAmount: doc.freeDelivery?.thresholdAmount ?? 339,
        },
        distanceRules: Array.isArray(doc.distanceRules)
            ? doc.distanceRules.map((r) => ({
                _id: r._id ? String(r._id) : undefined,
                fromKm: r.fromKm ?? 0,
                toKm: r.toKm ?? 0,
                fee: r.fee ?? 0,
                active: r.active ?? true,
            }))
            : [],
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
    };
}

/**
 * Returns the current delivery settings, served from the in-process cache
 * within the TTL window. Creates the singleton (with current-business-value
 * defaults — see the model's schema defaults) on the very first call ever.
 */
export async function getDeliverySettings(): Promise<DeliverySettingsData> {
    if (isCacheValid()) return cached as DeliverySettingsData;

    await connectDB();

    let doc = await DeliverySettings.findOne({}).lean();
    if (!doc) {
        const created = await DeliverySettings.create({});
        doc = created.toObject();
    }

    const data = shape(doc);
    setCache(data);
    return data;
}

// ── Validation ───────────────────────────────────────────────────────────
// Every field is independently sanity-checked before being written. Thrown
// messages are user-facing (shown directly in the admin UI) — keep them
// short and specific, never leak internal details.

function assertFiniteNonNegative(value: unknown, label: string): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number`);
    return n;
}

function validateDistanceRules(rules: DistanceRule[]): DistanceRule[] {
    const cleaned = rules.map((r, i) => {
        const fromKm = assertFiniteNonNegative(r.fromKm, `Rule ${i + 1} "from" distance`);
        const toKm = assertFiniteNonNegative(r.toKm, `Rule ${i + 1} "to" distance`);
        const fee = assertFiniteNonNegative(r.fee, `Rule ${i + 1} fee`);
        if (toKm <= fromKm) throw new Error(`Rule ${i + 1}: "to" distance must be greater than "from" distance`);
        return { fromKm, toKm, fee, active: r.active !== false };
    });

    // No overlapping ACTIVE ranges — sort by fromKm, then check adjacency.
    const activeSorted = cleaned.filter((r) => r.active).sort((a, b) => a.fromKm - b.fromKm);
    for (let i = 1; i < activeSorted.length; i++) {
        if (activeSorted[i].fromKm < activeSorted[i - 1].toKm) {
            throw new Error("Distance rules cannot overlap — check the ranges and try again");
        }
    }

    return cleaned;
}

export type DeliverySettingsPatch = Partial<{
    kitchen: Partial<DeliverySettingsData["kitchen"]>;
    serviceability: Partial<DeliverySettingsData["serviceability"]>;
    orderRules: Partial<DeliverySettingsData["orderRules"]>;
    freeDelivery: Partial<DeliverySettingsData["freeDelivery"]>;
    distanceRules: DistanceRule[];
}>;

/**
 * Validates and applies a partial update, then invalidates the cache so the
 * very next read reflects it. Caller (the admin API route) is responsible
 * for authorization — this function trusts whoever calls it.
 */
export async function updateDeliverySettings(patch: DeliverySettingsPatch): Promise<DeliverySettingsData> {
    await connectDB();

    const update: Record<string, unknown> = {};

    if (patch.kitchen) {
        if (patch.kitchen.name !== undefined) update["kitchen.name"] = String(patch.kitchen.name).trim().slice(0, 120);
        if (patch.kitchen.address !== undefined) update["kitchen.address"] = String(patch.kitchen.address).trim().slice(0, 300);
        if (patch.kitchen.active !== undefined) update["kitchen.active"] = !!patch.kitchen.active;
        if (patch.kitchen.latitude !== undefined) {
            const lat = patch.kitchen.latitude;
            if (lat !== null) {
                const n = Number(lat);
                if (!Number.isFinite(n) || n < -90 || n > 90) throw new Error("Kitchen latitude must be between -90 and 90");
                update["kitchen.latitude"] = n;
            } else {
                update["kitchen.latitude"] = null;
            }
        }
        if (patch.kitchen.longitude !== undefined) {
            const lng = patch.kitchen.longitude;
            if (lng !== null) {
                const n = Number(lng);
                if (!Number.isFinite(n) || n < -180 || n > 180) throw new Error("Kitchen longitude must be between -180 and 180");
                update["kitchen.longitude"] = n;
            } else {
                update["kitchen.longitude"] = null;
            }
        }
    }

    if (patch.serviceability?.maxRadiusKm !== undefined) {
        const n = assertFiniteNonNegative(patch.serviceability.maxRadiusKm, "Maximum delivery radius");
        if (n <= 0) throw new Error("Maximum delivery radius must be greater than 0");
        update["serviceability.maxRadiusKm"] = n;
    }

    if (patch.orderRules?.minimumOrderValue !== undefined) {
        update["orderRules.minimumOrderValue"] = assertFiniteNonNegative(patch.orderRules.minimumOrderValue, "Minimum order value");
    }

    if (patch.freeDelivery) {
        if (patch.freeDelivery.firstOrderFreeEnabled !== undefined) {
            update["freeDelivery.firstOrderFreeEnabled"] = !!patch.freeDelivery.firstOrderFreeEnabled;
        }
        if (patch.freeDelivery.thresholdEnabled !== undefined) {
            update["freeDelivery.thresholdEnabled"] = !!patch.freeDelivery.thresholdEnabled;
        }
        if (patch.freeDelivery.thresholdAmount !== undefined) {
            update["freeDelivery.thresholdAmount"] = assertFiniteNonNegative(patch.freeDelivery.thresholdAmount, "Free delivery threshold");
        }
    }

    if (patch.distanceRules !== undefined) {
        update["distanceRules"] = validateDistanceRules(patch.distanceRules);
    }

    let doc = await DeliverySettings.findOne({});
    if (!doc) doc = await DeliverySettings.create({});

    doc.set(update);
    await doc.save();

    invalidateCache();
    return shape(doc.toObject());
}
