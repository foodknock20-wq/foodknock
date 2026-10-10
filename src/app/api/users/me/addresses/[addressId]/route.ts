// src/app/api/users/me/addresses/[addressId]/route.ts
//
// Phase 9 — Customer Account 2.0: edit/delete/set-default for one of the
// caller's own saved addresses. The address is always located via
// `user.addresses.id(addressId)` on the AUTHENTICATED caller's own document
// — an addressId belonging to another user simply won't be found on this
// user's array, so there is no cross-user access path here at all (no
// separate ownership check needed; the scoping IS the ownership check).

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/apiAuth";
import { isRateLimited } from "@/lib/rateLimit";
import { parsePartialAddressInput } from "@/lib/addressValidation";
import { shapeAddress, type AddressDoc as BaseAddressDoc } from "@/lib/addresses";

type AddressDoc = BaseAddressDoc & {
    set: (patch: Record<string, unknown>) => void;
    deleteOne: () => void;
};

type RouteContext = { params: Promise<{ addressId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
    try {
        const auth = await requireUser(req);
        if (!auth) {
            return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
        }

        if (await isRateLimited(`address-write:${auth.userId}`, 30, 60 * 60 * 1000)) {
            return NextResponse.json({ success: false, message: "Too many requests. Try again later." }, { status: 429 });
        }

        const { addressId } = await context.params;
        const body = await req.json().catch(() => ({}));

        const parsed = parsePartialAddressInput(body ?? {});
        if (!parsed.ok) {
            return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
        }

        await connectDB();
        const user = await User.findById(auth.userId).select("addresses");
        if (!user) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
        }

        const target = (user.addresses as unknown as { id(id: string): AddressDoc | null }).id(addressId);
        if (!target) {
            return NextResponse.json({ success: false, message: "Address not found" }, { status: 404 });
        }

        if (Object.keys(parsed.data).length > 0) {
            target.set(parsed.data);
        }

        // Single-default invariant — enforced here, never trusted from the
        // client beyond a plain boolean intent.
        if (body?.isDefault === true) {
            for (const a of user.addresses as unknown as AddressDoc[]) {
                a.set({ isDefault: String(a._id) === addressId });
            }
        } else if (body?.isDefault === false && target.isDefault) {
            // Explicitly un-defaulting the current default leaves nobody
            // default — allowed; the UI can prompt the user to pick another.
            target.set({ isDefault: false });
        }

        await user.save();

        const addresses = (user.addresses as unknown as AddressDoc[]).map(shapeAddress);
        return NextResponse.json({ success: true, addresses });
    } catch (error) {
        console.error("UPDATE_ADDRESS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to update address" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        const auth = await requireUser(req);
        if (!auth) {
            return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
        }

        if (await isRateLimited(`address-write:${auth.userId}`, 30, 60 * 60 * 1000)) {
            return NextResponse.json({ success: false, message: "Too many requests. Try again later." }, { status: 429 });
        }

        const { addressId } = await context.params;

        await connectDB();
        const user = await User.findById(auth.userId).select("addresses");
        if (!user) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
        }

        const target = (user.addresses as unknown as { id(id: string): AddressDoc | null }).id(addressId);
        if (!target) {
            return NextResponse.json({ success: false, message: "Address not found" }, { status: 404 });
        }

        const wasDefault = target.isDefault === true;
        target.deleteOne();

        // Promote the most-recently-added remaining address to default so
        // the invariant "at most one default, and a non-empty list always
        // has exactly one" holds without requiring the client to ask.
        if (wasDefault && user.addresses.length > 0) {
            const remaining = user.addresses as unknown as AddressDoc[];
            remaining[remaining.length - 1].set({ isDefault: true });
        }

        await user.save();

        const addresses = (user.addresses as unknown as AddressDoc[]).map(shapeAddress);
        return NextResponse.json({ success: true, addresses });
    } catch (error) {
        console.error("DELETE_ADDRESS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to delete address" }, { status: 500 });
    }
}
