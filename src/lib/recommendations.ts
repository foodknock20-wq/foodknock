// src/lib/recommendations.ts
//
// Pre-Phase 17 — Phase 3: Smart Product Recommendations.
//
// Fallback hierarchy (degrades gracefully, never fabricates):
//   1. Real co-purchase relationship (src/models/ProductAffinity.ts,
//      lazily computed from delivered Order history, TTL-cached)
//   2. Same-category products
//   3. Shared-tag products
//   4. Nothing — an empty array is a valid, honest result; the caller
//      hides the section rather than filling it with arbitrary products.
//
// Every result is filtered to isAvailable:true + stock>0 and excludes the
// ids the caller asks to exclude (current product / full cart) — before
// ranking, not just in the UI.
//
// Performance: exactly ONE Product query per recommendation request (plus,
// at most, one ProductAffinity read/write when the co-purchase cache needs
// a refresh) — never N+1 (no per-recommended-item query), narrow
// projection only (see RECOMMENDATION_PROJECTION).

import mongoose from "mongoose";
import Product from "@/models/Product";
import Order from "@/models/Order";
import ProductAffinity from "@/models/ProductAffinity";

const AFFINITY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — co-purchase patterns shift slowly
const RECOMMENDATION_LIMIT = 8;

const RECOMMENDATION_PROJECTION =
    "name slug image price compareAtPrice category tags rating reviewCount isAvailable stock";

export type RecommendedProduct = {
    _id: string;
    name: string;
    slug: string;
    // Empty string, never fetched/selected from the DB — ProductCard/
    // ProductDetail's shared `Product` type requires this field (as a
    // fallback behind shortDescription) even though recommendation cards
    // never actually display it; kept here only to satisfy that shape
    // safely (e.g. ComboCard's `product.description.slice(...)` fallback),
    // not because it carries any real data for this narrow projection.
    description: string;
    image: string;
    price: number;
    compareAtPrice?: number | null;
    category: string;
    rating?: number | null;
    reviewCount?: number;
    stock: number;
    isAvailable: boolean;
};

export type RecommendationResult = {
    source: "co-purchase" | "category" | "none";
    products: RecommendedProduct[];
};

type AffinityDoc = {
    productId: mongoose.Types.ObjectId;
    related: { productId: mongoose.Types.ObjectId; coPurchaseCount: number }[];
    computedAt: Date;
};

/**
 * Returns up to 5 real co-purchased product ids (with scores) for a single
 * product, reading the cached ProductAffinity entry when fresh, otherwise
 * computing it via one bounded aggregation scoped to orders that actually
 * contain this product (never a full-collection scan of all orders).
 */
async function getCoPurchases(productId: string): Promise<{ productId: string; score: number }[]> {
    const objectId = new mongoose.Types.ObjectId(productId);

    const cached = await ProductAffinity.findOne({ productId: objectId }).lean<AffinityDoc | null>();
    if (cached && Date.now() - new Date(cached.computedAt).getTime() < AFFINITY_TTL_MS) {
        return cached.related.map((r) => ({ productId: String(r.productId), score: r.coPurchaseCount }));
    }

    const agg = await Order.aggregate<{ _id: mongoose.Types.ObjectId; coPurchaseCount: number }>([
        { $match: { status: "delivered", archivedAt: null, "items.productId": objectId } },
        { $unwind: "$items" },
        { $match: { "items.productId": { $ne: null, $nin: [objectId] } } },
        { $group: { _id: "$items.productId", coPurchaseCount: { $sum: 1 } } },
        { $sort: { coPurchaseCount: -1 } },
        { $limit: 5 },
    ]).catch((err) => {
        console.error("CO_PURCHASE_AGGREGATION_ERROR", { productId, error: err });
        return [];
    });

    const related = agg.map((a) => ({ productId: a._id, coPurchaseCount: a.coPurchaseCount }));

    await ProductAffinity.findOneAndUpdate(
        { productId: objectId },
        { $set: { related, computedAt: new Date() } },
        { upsert: true }
    ).catch((err) => console.error("PRODUCT_AFFINITY_CACHE_WRITE_ERROR", { productId, error: err }));

    return related.map((r) => ({ productId: String(r.productId), score: r.coPurchaseCount }));
}

function toRecommendedProduct(doc: {
    _id: unknown; name: string; slug: string; image: string; price: number;
    compareAtPrice?: number | null; category: string; rating?: number | null;
    reviewCount?: number; stock: number; isAvailable: boolean;
}): RecommendedProduct {
    return {
        _id: String(doc._id),
        name: doc.name,
        slug: doc.slug,
        description: "",
        image: doc.image,
        price: doc.price,
        compareAtPrice: doc.compareAtPrice ?? null,
        category: doc.category,
        rating: doc.rating ?? null,
        reviewCount: doc.reviewCount ?? 0,
        stock: doc.stock,
        isAvailable: doc.isAvailable,
    };
}

/** One bounded query — fetches candidate ids, filtered to orderable products only, preserving the caller's ranked order. */
async function fetchOrderableByIds(ids: string[], excludeIds: Set<string>): Promise<RecommendedProduct[]> {
    const wanted = ids.filter((id) => !excludeIds.has(id));
    if (wanted.length === 0) return [];

    const rows = await Product.find({
        _id: { $in: wanted },
        isAvailable: true,
        stock: { $gt: 0 },
    })
        .select(RECOMMENDATION_PROJECTION)
        .lean();

    const byId = new Map(rows.map((r) => [String(r._id), r]));
    return wanted.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r)).map(toRecommendedProduct);
}

/** One bounded query — same-category/tag fallback, ranked by featured status (weak tie-breaker only) then rating. */
async function fetchCategoryFallback(
    categories: string[],
    excludeIds: Set<string>,
    limit: number
): Promise<RecommendedProduct[]> {
    if (categories.length === 0 || limit <= 0) return [];

    const rows = await Product.find({
        category: { $in: categories.map((c) => new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) },
        _id: { $nin: Array.from(excludeIds) },
        isAvailable: true,
        stock: { $gt: 0 },
    })
        .select(RECOMMENDATION_PROJECTION)
        .sort({ isFeatured: -1, rating: -1, createdAt: -1 })
        .limit(limit)
        .lean();

    return rows.map(toRecommendedProduct);
}

async function buildRecommendations(opts: {
    coPurchaseCandidates: { productId: string; score: number }[];
    categories: string[];
    excludeIds: Set<string>;
    limit?: number;
}): Promise<RecommendationResult> {
    const limit = opts.limit ?? RECOMMENDATION_LIMIT;

    const rankedCoPurchaseIds = [...opts.coPurchaseCandidates]
        .sort((a, b) => b.score - a.score)
        .map((c) => c.productId);

    const coPurchaseProducts = await fetchOrderableByIds(rankedCoPurchaseIds, opts.excludeIds);

    const usedIds = new Set([...opts.excludeIds, ...coPurchaseProducts.map((p) => p._id)]);
    const remaining = limit - coPurchaseProducts.length;

    const fallbackProducts = remaining > 0
        ? await fetchCategoryFallback(opts.categories, usedIds, remaining)
        : [];

    const products = [...coPurchaseProducts, ...fallbackProducts];

    const source: RecommendationResult["source"] =
        coPurchaseProducts.length > 0 ? "co-purchase" : fallbackProducts.length > 0 ? "category" : "none";

    return { source, products };
}

/** Product Detail — recommendations for a single product being viewed. */
export async function getProductDetailRecommendations(
    productId: string,
    category: string,
    extraExcludeIds: string[] = []
): Promise<RecommendationResult> {
    const excludeIds = new Set([productId, ...extraExcludeIds]);
    const coPurchaseCandidates = await getCoPurchases(productId);
    return buildRecommendations({ coPurchaseCandidates, categories: [category], excludeIds });
}

/** Cart — recommendations aware of every product currently in the cart. */
export async function getCartRecommendations(
    cartItems: { productId: string; category: string }[]
): Promise<RecommendationResult> {
    if (cartItems.length === 0) return { source: "none", products: [] };

    const excludeIds = new Set(cartItems.map((i) => i.productId));
    const categories = Array.from(new Set(cartItems.map((i) => i.category)));

    // Merge co-purchase signals across every cart item — a candidate that's
    // frequently bought alongside MULTIPLE cart items should rank higher.
    // Each item's lookup is independent (its own cache read, and — only on
    // a cold/stale entry — its own bounded aggregation + cache write), so
    // they run concurrently rather than one-after-another: with N cart
    // items and a cold affinity cache, a sequential loop here multiplied
    // latency by N instead of taking the time of the single slowest item.
    const perItemCandidates = await Promise.all(cartItems.map((item) => getCoPurchases(item.productId)));
    const merged = new Map<string, number>();
    for (const candidates of perItemCandidates) {
        for (const c of candidates) {
            if (excludeIds.has(c.productId)) continue;
            merged.set(c.productId, (merged.get(c.productId) ?? 0) + c.score);
        }
    }
    const coPurchaseCandidates = Array.from(merged.entries()).map(([productId, score]) => ({ productId, score }));

    return buildRecommendations({ coPurchaseCandidates, categories, excludeIds });
}

export function recommendationTitle(source: RecommendationResult["source"], context: "detail" | "cart"): string {
    if (source === "co-purchase") return "Frequently Bought Together";
    if (context === "cart") return "You Might Also Like";
    return "You May Also Like";
}
