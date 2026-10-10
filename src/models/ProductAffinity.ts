// src/models/ProductAffinity.ts
//
// Pre-Phase 17 — Phase 3: Smart Recommendations. Cached, lazily-computed
// real co-purchase relationships ("customers who bought X also bought Y"),
// derived from actual delivered Order history — never fabricated.
//
// WHY cached instead of computed live on every product-page request: the
// co-purchase relationship for a product changes slowly (it reflects
// accumulated order history, not real-time state), but computing it
// requires scanning Order documents for every order containing that
// product — not something that should run on every single page view.
// src/lib/recommendations.ts reads this cache first and only re-runs the
// bounded aggregation when the cached entry is missing or older than
// AFFINITY_TTL_MS, amortizing the aggregation cost across many page views
// instead of paying it per view.
//
// This is NOT a general analytics collection — it stores only the minimal
// ranked list needed to answer "what else do people who buy this also buy",
// nothing else.

import { Schema, model, models } from "mongoose";

const AffinityEntrySchema = new Schema(
    {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        // Count of distinct delivered orders containing BOTH products.
        coPurchaseCount: { type: Number, required: true, min: 1 },
    },
    { _id: false }
);

const ProductAffinitySchema = new Schema(
    {
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true,
            unique: true,
            index: true,
        },
        related: { type: [AffinityEntrySchema], default: [] },
        computedAt: { type: Date, required: true },
    },
    { timestamps: true }
);

const ProductAffinity = models.ProductAffinity || model("ProductAffinity", ProductAffinitySchema);

export default ProductAffinity;
