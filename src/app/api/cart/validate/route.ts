export const dynamic = "force-dynamic";

// src/app/api/cart/validate/route.ts
//
// PHASE 4 — CART 2.0
//
// Public, read-only cart validation. Given the client's cart
// ({_id, quantity, price?}[]), resolves each item's CURRENT, authoritative
// state from Product (price/availability/stock) so the cart/checkout UI can
// show the customer exactly what changed before they try to pay — instead
// of finding out only after submitting an order.
//
// This does NOT create or price an order — that remains Phase 2A's
// calculateAuthoritativePricing(), called independently (and redundantly,
// by design) at actual order-creation time in create-order/COD routes. This
// route exists purely so the cart/checkout pages don't have to guess.
//
// No auth required — guest carts must validate exactly like logged-in carts,
// and the response contains nothing beyond what /api/products already
// exposes publicly (name/price/image/availability for a bounded, caller-
// supplied list of ids).

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { validateCartItems, type CartValidationInput } from "@/lib/pricing";

const MAX_ITEMS = 50; // mirrors the cart store's own MAX_CART_ITEMS cap

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json().catch(() => null);
        const rawItems = Array.isArray(body?.items) ? body.items : [];

        if (rawItems.length > MAX_ITEMS) {
            return NextResponse.json(
                { success: false, message: "Too many items" },
                { status: 400 }
            );
        }

        const items: CartValidationInput[] = rawItems.map(
            (i: { _id?: unknown; quantity?: unknown; price?: unknown }) => ({
                _id:      i?._id as string,
                quantity: i?.quantity as number,
                price:    typeof i?.price === "number" ? i.price : undefined,
            })
        );

        const result = await validateCartItems(items);

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("CART_VALIDATE_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Could not validate cart. Please try again." },
            { status: 500 }
        );
    }
}
