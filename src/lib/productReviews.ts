// src/lib/productReviews.ts
//
// Pre-Phase 17 — Phase 1: Reviews 2.0 shared server-side helpers.
//
// Two responsibilities, both deliberately server-only (never callable from
// a client request body):
//   1. findQualifyingOrder() — the SOLE source of truth for "did this user
//      actually buy this product through FoodKnock". A review is only ever
//      marked verifiedPurchase based on this query's result — the client
//      can send whatever it wants, it is never read for this flag.
//   2. recalculateProductRating() — keeps Product.rating/reviewCount in
//      sync with real, non-hidden ProductReview documents. No fake/seeded
//      values ever flow into these fields.

import mongoose from "mongoose";
import Order from "@/models/Order";
import Product from "@/models/Product";
import ProductReview from "@/models/ProductReview";

/**
 * Returns the most recent DELIVERED order (not archived) placed by `userId`
 * that contains `productId` among its line items, or null if none exists.
 * Bounded query: `user` is an existing indexed field (OrderSchema.index
 * ({ user: 1, createdAt: -1 })), so this only ever scans one customer's own
 * orders — never a collection-wide scan — before filtering by status/item.
 */
export async function findQualifyingOrder(userId: string, productId: string) {
    return Order.findOne({
        user: userId,
        status: "delivered",
        archivedAt: null,
        "items.productId": productId,
    })
        .select("_id")
        .sort({ createdAt: -1 })
        .lean<{ _id: mongoose.Types.ObjectId } | null>();
}

/**
 * Recomputes Product.rating (average, rounded to 1dp) and Product.reviewCount
 * from real, non-hidden ProductReview documents only. Call after any create/
 * delete/hide/unhide mutation so the product-facing rating is always exactly
 * what the live review set supports — never stale, never fabricated.
 */
export async function recalculateProductRating(productId: string | mongoose.Types.ObjectId) {
    const objectId = typeof productId === "string" ? new mongoose.Types.ObjectId(productId) : productId;

    const [agg] = await ProductReview.aggregate<{ avg: number; count: number }>([
        { $match: { productId: objectId, isHidden: false } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    await Product.findByIdAndUpdate(objectId, {
        $set: {
            rating: agg ? Math.round(agg.avg * 10) / 10 : null,
            reviewCount: agg ? agg.count : 0,
        },
    });
}
