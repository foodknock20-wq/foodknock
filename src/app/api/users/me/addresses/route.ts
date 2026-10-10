// src/app/api/users/me/addresses/route.ts
//
// Phase 9 — Customer Account 2.0: saved addresses.
//
// GET  — list the caller's own saved addresses (lazy legacy migration
//        lives in src/lib/addresses.ts, shared with the account/addresses
//        server-component page so both read paths behave identically).
// POST — add a new address (max MAX_ADDRESSES_PER_USER). Always scoped to
//        the authenticated caller's own document — no userId is ever
//        accepted from the client.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/apiAuth";
import { isRateLimited } from "@/lib/rateLimit";
import { parseAddressInput, MAX_ADDRESSES_PER_USER } from "@/lib/addressValidation";
import { listAddresses, shapeAddress, type AddressDoc } from "@/lib/addresses";

export async function GET(req: NextRequest) {
    try {
        const auth = await requireUser(req);
        if (!auth) {
            return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
        }

        const addresses = await listAddresses(auth.userId);
        return NextResponse.json({ success: true, addresses });
    } catch (error) {
        console.error("GET_ADDRESSES_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load addresses" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireUser(req);
        if (!auth) {
            return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
        }

        if (await isRateLimited(`address-write:${auth.userId}`, 30, 60 * 60 * 1000)) {
            return NextResponse.json({ success: false, message: "Too many requests. Try again later." }, { status: 429 });
        }

        const body = await req.json().catch(() => ({}));
        const parsed = parseAddressInput(body ?? {});
        if (!parsed.ok) {
            return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
        }

        await connectDB();
        const user = await User.findById(auth.userId).select("addresses");
        if (!user) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
        }

        if (user.addresses.length >= MAX_ADDRESSES_PER_USER) {
            return NextResponse.json(
                { success: false, message: `You can save up to ${MAX_ADDRESSES_PER_USER} addresses` },
                { status: 400 }
            );
        }

        const makeDefault = body?.isDefault === true || user.addresses.length === 0;
        if (makeDefault) {
            for (const a of user.addresses as unknown as AddressDoc[]) {
                (a as { isDefault?: boolean }).isDefault = false;
            }
        }

        user.addresses.push({ ...parsed.data, isDefault: makeDefault } as AddressDoc);
        await user.save();

        const addresses = (user.addresses as unknown as AddressDoc[]).map(shapeAddress);
        return NextResponse.json({ success: true, addresses }, { status: 201 });
    } catch (error) {
        console.error("CREATE_ADDRESS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to save address" }, { status: 500 });
    }
}
