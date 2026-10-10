export const dynamic = "force-dynamic";

// src/app/api/recommendations/cart/route.ts
//
// Pre-Phase 17 — Phase 3: Smart Recommendations for Cart/Checkout. The
// cart only exists client-side (zustand + localStorage — see
// src/store/cartStore.ts), so unlike Product Detail (server-rendered),
// this has to be a client-fetched API. Accepts the current cart's product
// ids, re-resolves their categories server-side (never trusts a
// client-supplied category), and returns real, ranked recommendations.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import { getCartRecommendations, recommendationTitle } from "@/lib/recommendations";

const MAX_CART_IDS = 50; // matches cartStore's own MAX_CART_ITEMS ceiling

export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const rawIds = (searchParams.get("ids") ?? "")
            .split(",")
            .map((id) => id.trim())
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
            .slice(0, MAX_CART_IDS);

        if (rawIds.length === 0) {
            return NextResponse.json({ success: true, title: "", source: "none", products: [] });
        }

        // Never trust client-supplied category — look it up fresh.
        const cartProducts = await Product.find({ _id: { $in: rawIds } })
            .select("_id category")
            .lean<{ _id: mongoose.Types.ObjectId; category: string }[]>();

        const cartItems = cartProducts.map((p) => ({ productId: String(p._id), category: p.category }));

        const { source, products } = await getCartRecommendations(cartItems);

        return NextResponse.json({
            success: true,
            title: recommendationTitle(source, "cart"),
            source,
            products,
        });
    } catch (error) {
        console.error("GET_CART_RECOMMENDATIONS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load recommendations" }, { status: 500 });
    }
}
