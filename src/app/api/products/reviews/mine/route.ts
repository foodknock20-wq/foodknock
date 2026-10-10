export const dynamic = "force-dynamic";

// src/app/api/products/reviews/mine/route.ts
//
// Rate Your Order — a bounded read helper, NOT a second review system.
// Given a set of productIds, returns which of them the AUTHENTICATED
// caller has already reviewed (ProductReview's own
// {productId,userId} unique index is the single source of truth for "has
// this user reviewed this product" — this route just exposes a bounded
// slice of it for the order-detail "✓ Reviewed" state). Reuses the exact
// same ProductReview model src/app/api/products/[id]/reviews/route.ts
// writes to; no new review data, no new write path.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import ProductReview from "@/models/ProductReview";
import { requireUser } from "@/lib/apiAuth";

const MAX_IDS = 50;

export async function GET(req: NextRequest) {
    try {
        const auth = await requireUser(req);
        if (!auth) {
            return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
        }

        await connectDB();

        const { searchParams } = new URL(req.url);
        const idsParam = searchParams.get("ids") ?? "";
        const ids = idsParam
            .split(",")
            .map((s) => s.trim())
            .filter((s) => mongoose.Types.ObjectId.isValid(s))
            .slice(0, MAX_IDS);

        if (ids.length === 0) {
            return NextResponse.json({ success: true, reviews: [] });
        }

        const reviews = await ProductReview.find({
            userId: auth.userId,
            productId: { $in: ids },
        })
            .select("productId rating")
            .lean<{ productId: mongoose.Types.ObjectId; rating: number }[]>();

        return NextResponse.json({
            success: true,
            reviews: reviews.map((r) => ({ productId: String(r.productId), rating: r.rating })),
        });
    } catch (error) {
        console.error("GET_MY_PRODUCT_REVIEWS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load review status" }, { status: 500 });
    }
}
