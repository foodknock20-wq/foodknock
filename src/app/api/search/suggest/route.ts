export const dynamic = "force-dynamic";

// src/app/api/search/suggest/route.ts
//
// Pre-Phase 17 — Phase 3: Advanced Search. Public, bounded, cheap —
// ONE Product query (narrow projection, hard-capped limit), ranked
// in-memory via src/lib/search.ts. No external search service, no AI
// calls, no N+1. CDN-cacheable (catalog-level, not personalized).

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";
import { searchProducts, type SearchableProduct } from "@/lib/search";

const SUGGESTION_LIMIT = 8;
// Pre-Phase 17 — Home/Search polish: bounded discovery set shown in the
// SearchOverlay's empty-query state (spec: "never a blank canvas when
// opened") — small on purpose, this is a glance, not a browse page.
const DISCOVERY_PRODUCT_LIMIT = 6;
const DISCOVERY_CATEGORY_LIMIT = 8;
// Safety ceiling for the candidate pool — comfortably above any realistic
// single-kitchen catalog size; prevents an unbounded scan if the catalog
// ever grows far beyond what this in-memory ranking strategy is sized for.
const CANDIDATE_POOL_LIMIT = 500;

const SEARCH_PROJECTION =
    "name slug image price compareAtPrice category tags description rating reviewCount isAvailable stock";

export async function GET(req: NextRequest) {
    try {
        const ip = getClientIp(req);
        if (await isRateLimited(`search-suggest:${ip}`, 120, 60 * 1000)) {
            return NextResponse.json({ success: false, message: "Too many requests" }, { status: 429 });
        }

        await connectDB();

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get("q") ?? "").toString();

        if (!q.trim()) {
            // Empty-query discovery mode — reuses this SAME bounded endpoint
            // (no second search API) to give SearchOverlay something real
            // and useful to show before the user types anything: a small
            // set of real, currently-orderable products plus the distinct
            // real categories they belong to. Both bounded and cheap — one
            // query, narrow projection, hard limits.
            const discoveryProducts = await Product.find({ isAvailable: true, stock: { $gt: 0 } })
                .select(SEARCH_PROJECTION)
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(DISCOVERY_PRODUCT_LIMIT)
                .lean<SearchableProduct[]>();

            const discoveryCategories = Array.from(new Set(discoveryProducts.map((p) => p.category))).slice(
                0,
                DISCOVERY_CATEGORY_LIMIT
            );

            const res = NextResponse.json({
                success: true,
                products: discoveryProducts.map((p) => ({
                    _id: String(p._id),
                    name: p.name,
                    slug: p.slug,
                    image: p.image,
                    price: p.price,
                    compareAtPrice: p.compareAtPrice ?? null,
                    category: p.category,
                    rating: p.rating ?? null,
                    reviewCount: p.reviewCount ?? 0,
                    isAvailable: p.isAvailable,
                    stock: p.stock,
                })),
                categories: discoveryCategories,
                didYouMean: null,
            });
            res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
            return res;
        }

        const candidates = await Product.find({ isAvailable: true })
            .select(SEARCH_PROJECTION)
            .limit(CANDIDATE_POOL_LIMIT)
            .lean<SearchableProduct[]>();

        const { products, matchedCategories, didYouMean } = searchProducts(candidates, q, SUGGESTION_LIMIT);

        const res = NextResponse.json({
            success: true,
            products: products.map((p) => ({
                _id: String(p._id),
                name: p.name,
                slug: p.slug,
                image: p.image,
                price: p.price,
                compareAtPrice: p.compareAtPrice ?? null,
                category: p.category,
                rating: p.rating ?? null,
                reviewCount: p.reviewCount ?? 0,
                isAvailable: p.isAvailable,
                stock: p.stock,
            })),
            categories: matchedCategories,
            didYouMean,
        });
        res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
        return res;
    } catch (error) {
        console.error("SEARCH_SUGGEST_ERROR", error);
        return NextResponse.json({ success: false, message: "Search failed" }, { status: 500 });
    }
}
