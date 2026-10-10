// src/lib/addresses.ts
//
// Server-only helper shared by the /api/users/me/addresses route and the
// account/addresses server-component page, so the lazy legacy-address
// migration logic (see Phase 9 plan — no bulk migration script, upgrade
// on first read instead) lives in exactly one place.

import { connectDB } from "@/lib/db";
import User from "@/models/User";

export type AddressDoc = {
    _id: unknown;
    label?: string;
    flatNo?: string;
    addressLine?: string;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
    deliveryInstructions?: string;
    lat?: number | null;
    lng?: number | null;
    isDefault?: boolean;
};

export type ShapedAddress = {
    _id: string;
    label: string;
    flatNo: string;
    addressLine: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    landmark: string;
    deliveryInstructions: string;
    lat: number | null;
    lng: number | null;
    isDefault: boolean;
};

export function shapeAddress(a: AddressDoc): ShapedAddress {
    return {
        _id: String(a._id),
        label: a.label ?? "",
        flatNo: a.flatNo ?? "",
        addressLine: a.addressLine ?? "",
        locality: a.locality ?? "",
        city: a.city ?? "",
        state: a.state ?? "",
        pincode: a.pincode ?? "",
        landmark: a.landmark ?? "",
        deliveryInstructions: a.deliveryInstructions ?? "",
        lat: a.lat ?? null,
        lng: a.lng ?? null,
        isDefault: a.isDefault ?? false,
    };
}

/**
 * Lists a user's saved addresses, lazily/idempotently migrating the legacy
 * single `User.address` object into `addresses[]` on first call if the
 * user has never saved a structured address before. Safe to call
 * repeatedly — a no-op once `addresses.length > 0`.
 */
export async function listAddresses(userId: string): Promise<ShapedAddress[]> {
    await connectDB();
    const user = await User.findById(userId).select("address addresses");
    if (!user) return [];

    if ((user.addresses?.length ?? 0) === 0 && user.address?.line1) {
        const legacy = user.address;
        user.addresses.push({
            label: "Home",
            flatNo: "",
            addressLine: legacy.line1 ?? "",
            locality: legacy.line2 ?? "",
            city: legacy.city ?? "",
            state: legacy.state ?? "",
            pincode: legacy.pincode ?? "",
            landmark: legacy.landmark ?? "",
            deliveryInstructions: "",
            lat: null,
            lng: null,
            isDefault: true,
        } as AddressDoc);
        await user.save();
    }

    return (user.addresses as unknown as AddressDoc[]).map(shapeAddress);
}
