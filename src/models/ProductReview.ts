// src/models/ProductReview.ts
//
// Pre-Phase 17 — Phase 1: Reviews 2.0.
//
// Distinct from src/models/Review.ts, which is the pre-existing homepage
// TESTIMONIALS model (userName/rating/comment, no product/user reference,
// moderated via /admin/reviews) — left untouched. This is a new, separate
// model for real per-product reviews tied to an authenticated user and
// (optionally) a qualifying delivered order.
//
// verifiedPurchase is computed SERVER-SIDE ONLY at submission time (see
// src/lib/productReviews.ts::findQualifyingOrder) — never trusted from the
// client request body.

import mongoose, { Schema, model, models } from "mongoose";

const ProductReviewSchema = new Schema(
    {
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true,
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        // Denormalized at submission time (same pattern as Order.customerName)
        // — avoids a populate() on every product-page review list read.
        userName: { type: String, required: true, trim: true },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
            validate: {
                validator: Number.isInteger,
                message: "Rating must be a whole number from 1 to 5",
            },
        },
        comment: { type: String, required: true, trim: true, maxlength: 1000 },

        // Server-computed only — see src/lib/productReviews.ts.
        verifiedPurchase: { type: Boolean, default: false },
        // The qualifying delivered order, if any — audit trail only, not
        // re-validated on read.
        orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },

        // Soft-hide for admin moderation (abuse/spam) — distinct from a hard
        // delete, which removes the document entirely.
        isHidden: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// Duplicate protection — one review per user per product.
ProductReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
// Product page read pattern: newest-first (or highest/lowest), excluding hidden.
ProductReviewSchema.index({ productId: 1, isHidden: 1, createdAt: -1 });
ProductReviewSchema.index({ productId: 1, isHidden: 1, rating: -1 });

// Stale-model-cache guard — same rationale as User.ts/Order.ts (dev
// hot-reload only; no-op on a fresh process).
if (models.ProductReview && !models.ProductReview.schema.path("isHidden")) {
    mongoose.deleteModel("ProductReview");
}

const ProductReview = models.ProductReview || model("ProductReview", ProductReviewSchema);

export default ProductReview;
