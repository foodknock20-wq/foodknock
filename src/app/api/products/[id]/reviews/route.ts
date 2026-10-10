export const dynamic = "force-dynamic";

// src/app/api/products/[id]/reviews/route.ts
//
// Pre-Phase 17 — Phase 1: Reviews 2.0.
// GET  — public, bounded, paginated review list + rating summary for one product.
// POST — authenticated submission. verifiedPurchase is computed server-side
//        only (see src/lib/productReviews.ts); the client cannot set it.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import ProductReview from "@/models/ProductReview";
import User from "@/models/User";
import { requireUser } from "@/lib/apiAuth";
import { isRateLimited } from "@/lib/rateLimit";
import { findQualifyingOrder, recalculateProductRating } from "@/lib/productReviews";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 12;
const MAX_COMMENT_LENGTH = 1000;
const MIN_COMMENT_LENGTH = 3;

type SortKey = "newest" | "highest" | "lowest";
const SORT_MAP: Record<SortKey, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    highest: { rating: -1, createdAt: -1 },
    lowest: { rating: 1, createdAt: -1 },
};

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid product ID" }, { status: 400 });
        }

        await connectDB();

        const { searchParams } = new URL(req.url);
        const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
        const rawLimit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
        const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
        const limit = Math.min(MAX_LIMIT, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_LIMIT);
        const skip = (page - 1) * limit;

        const sortParam = searchParams.get("sort");
        const sort: SortKey = sortParam === "highest" || sortParam === "lowest" ? sortParam : "newest";

        const objectId = new mongoose.Types.ObjectId(id);
        const filter = { productId: objectId, isHidden: false };

        const [rows, total, product, distributionAgg] = await Promise.all([
            ProductReview.find(filter)
                .select("userName rating comment verifiedPurchase createdAt")
                .sort(SORT_MAP[sort])
                .skip(skip)
                .limit(limit)
                .lean(),
            ProductReview.countDocuments(filter),
            Product.findById(objectId).select("rating reviewCount").lean<{ rating?: number | null; reviewCount?: number } | null>(),
            // Bounded — at most 5 groups (star values 1-5) regardless of review volume.
            ProductReview.aggregate<{ _id: number; count: number }>([
                { $match: filter },
                { $group: { _id: "$rating", count: { $sum: 1 } } },
            ]),
        ]);

        if (!product) {
            return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
        }

        const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const d of distributionAgg) {
            if (d._id >= 1 && d._id <= 5) distribution[d._id as 1 | 2 | 3 | 4 | 5] = d.count;
        }

        const reviews = rows.map((r) => ({
            _id: String(r._id),
            userName: r.userName,
            rating: r.rating,
            comment: r.comment,
            verifiedPurchase: r.verifiedPurchase ?? false,
            createdAt: r.createdAt,
        }));

        return NextResponse.json({
            success: true,
            reviews,
            meta: {
                page,
                limit,
                total,
                hasNextPage: skip + rows.length < total,
            },
            summary: {
                average: product.rating ?? null,
                count: product.reviewCount ?? 0,
                distribution,
            },
        });
    } catch (error) {
        console.error("GET_PRODUCT_REVIEWS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load reviews" }, { status: 500 });
    }
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const auth = await requireUser(req);
        if (!auth) {
            return NextResponse.json({ success: false, message: "Please sign in to write a review" }, { status: 401 });
        }

        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid product ID" }, { status: 400 });
        }

        if (await isRateLimited(`product-review-submit:${auth.userId}`, 15, 60 * 60 * 1000)) {
            return NextResponse.json(
                { success: false, message: "Too many submissions. Please try again later." },
                { status: 429 }
            );
        }

        await connectDB();

        const body = await req.json().catch(() => ({} as Record<string, unknown>));
        const rating = body?.rating;
        const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

        if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
            return NextResponse.json({ success: false, message: "Rating must be a whole number from 1 to 5" }, { status: 400 });
        }
        if (!comment || comment.length < MIN_COMMENT_LENGTH) {
            return NextResponse.json({ success: false, message: "Please write a short review before submitting" }, { status: 400 });
        }
        if (comment.length > MAX_COMMENT_LENGTH) {
            return NextResponse.json({ success: false, message: `Review must be ${MAX_COMMENT_LENGTH} characters or fewer` }, { status: 400 });
        }

        const [product, user] = await Promise.all([
            Product.findById(id).select("_id").lean(),
            User.findById(auth.userId).select("name").lean<{ name?: string } | null>(),
        ]);

        if (!product) {
            return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
        }
        if (!user) {
            return NextResponse.json({ success: false, message: "Account not found" }, { status: 404 });
        }

        // SERVER-SIDE ONLY — never trust a client-supplied verifiedPurchase flag.
        const qualifyingOrder = await findQualifyingOrder(auth.userId, id);
        const verifiedPurchase = Boolean(qualifyingOrder);

        let review;
        try {
            review = await ProductReview.create({
                productId: id,
                userId: auth.userId,
                userName: user.name,
                rating,
                comment,
                verifiedPurchase,
                orderId: qualifyingOrder?._id ?? null,
            });
        } catch (err) {
            if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
                return NextResponse.json(
                    { success: false, message: "You've already reviewed this product" },
                    { status: 409 }
                );
            }
            throw err;
        }

        await recalculateProductRating(id);

        return NextResponse.json(
            {
                success: true,
                message: verifiedPurchase ? "You've added a Verified Purchase review." : "Thanks for your review!",
                review: {
                    _id: String(review._id),
                    userName: review.userName,
                    rating: review.rating,
                    comment: review.comment,
                    verifiedPurchase: review.verifiedPurchase,
                    createdAt: review.createdAt,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST_PRODUCT_REVIEW_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to submit review" }, { status: 500 });
    }
}
