// src/app/(main)/menu/[slug]/page.tsx
// FIXED: removed `revalidate = 60` + `generateStaticParams` → was generating
//        ISR writes for every product on every mutation.  Now fully dynamic SSR.
//
// PERF PASS 2:
//   1) getProduct() wrapped in React's cache() — see rationale below.
//      Expected Mongo: -1 query per page load (product query deduped between
//      generateMetadata() and the page component — previously both called
//      getProduct(slug) independently, issuing the SAME query twice).
//      Expected CPU/TTFB: ~50% less DB round-trip time for the product fetch
//      stage on every single product-page view.
//      Expected Vercel: fewer Mongo round trips per invocation = less wall
//      time billed, especially relevant now that this route is force-dynamic
//      and hit on every request with no caching layer at all.
//
//   2) Upsell + Related products merged into a single Mongo query.
//      Previously: two separate `Product.find()` calls with the IDENTICAL
//      filter (`category`, `_id: $ne`, `isAvailable: true`) and no `.sort()`,
//      differing only by `.limit(3)` vs `.limit(4)`. Because Mongo has no
//      guaranteed order without an explicit sort, both queries were very
//      likely returning items in the SAME underlying scan order — meaning
//      the "related" query's first 3 items were frequently identical to the
//      "upsell" query's 3 items (duplicate content risk), while ALSO paying
//      for two full round trips to Mongo for what is functionally one
//      dataset. Fetching once with limit 7 and slicing [0,3) for upsell and
//      [3,7) for related preserves the exact same counts (3 upsell / 4
//      related) shown in the UI, while guaranteeing the two lists never
//      overlap and cutting the related-products DB round trips from 2 to 1.
//      Expected Mongo: -1 query per product page view.
//      Expected CPU: one query planning/execution cycle instead of two.
//      Expected Vercel: lower function wall-time (fewer awaited round trips).
//
//   3) JSON.parse(JSON.stringify(...)) replaced with serializeMongoDoc(s)()
//      — see src/lib/serialize.ts. Same output shape, no double tree-walk.

import { connectDB }       from "@/lib/db";
import Product              from "@/models/Product";
import ProductDetail        from "@/components/products/ProductDetail";
import Navbar               from "@/components/shared/Navbar";
import Footer               from "@/components/shared/Footer";
import { notFound }         from "next/navigation";
import { cache }            from "react";
import { serializeMongoDoc, serializeMongoDocs } from "@/lib/serialize";
import type { Metadata }    from "next";

// ✅ FIX — No ISR. Every request hits the DB directly (still fast via connection pool).
export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ slug: string }>;
};

// ─── Fetch helpers ────────────────────────────────────────────────────────

// PERF PASS 2 — wrapped in React's `cache()`. This is the standard Next.js
// App Router pattern for de-duplicating data fetches that happen more than
// once per request (here: once in generateMetadata(), once in the page
// component). `cache()` memoizes the function's result for the lifetime of
// a single server request/render pass, keyed by its arguments — so calling
// getProduct(slug) twice in the same request only ever hits Mongo once.
// This does NOT introduce cross-request caching or staleness of any kind
// (the page is still `force-dynamic` / fully SSR on every request); it only
// removes the redundant intra-request duplicate query.
const getProduct = cache(async (slug: string) => {
    try {
        await connectDB();
        // ✅ Only select fields needed by ProductDetail — excludes large unused fields
        const product = await Product
            .findOne({ slug })
            .select("name slug description shortDescription price compareAtPrice category image stock isAvailable isFeatured rating tags ingredients")
            .lean();
        if (!product) return null;
        return serializeMongoDoc(product);
    } catch (error) {
        console.error("PRODUCT_FETCH_ERROR:", error);
        return null;
    }
});

// PERF PASS 2 — single query replacing the previous two identical-filter
// queries (one for upsell, one for related). See file-header comment for
// full rationale. Same UI-facing shapes/counts as before: 3 upsell items,
// 4 related items.
async function getUpsellAndRelatedProducts(category: string, excludeId: string) {
    try {
        await connectDB();
        const products = await Product.find({
            category: { $regex: new RegExp(`^${category}$`, "i") },
            _id: { $ne: excludeId },
            isAvailable: true,
        })
            .select("name slug shortDescription price compareAtPrice category image rating stock isAvailable")
            .limit(7) // 3 for upsell + 4 for related, fetched in one round trip
            .lean();

        const serialized = serializeMongoDocs(products);

        return {
            upsellProducts: serialized.slice(0, 3),
            relatedProducts: serialized.slice(3, 7),
        };
    } catch {
        return { upsellProducts: [], relatedProducts: [] };
    }
}

// ─── SEO Metadata ─────────────────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const product = await getProduct(slug); // deduped via cache() — see above

    if (!product) {
        return {
            title: "Item Not Found | FoodKnock",
            description: "The menu item you're looking for could not be found. Browse our full menu on FoodKnock.",
        };
    }

    const title       = `${product.name} | FoodKnock — Order Fresh Food Online`;
    const description = product.shortDescription
        ?? product.description?.slice(0, 160)
        ?? `Order ${product.name} online from FoodKnock. Fresh ingredients, fast delivery.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: product.image ? [{ url: product.image, alt: product.name }] : [],
            type: "website",
            siteName: "FoodKnock",
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: product.image ? [product.image] : [],
        },
    };
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default async function ProductPage({ params }: PageProps) {
    const { slug } = await params;
    const product = await getProduct(slug); // deduped via cache() — 2nd call in this request is free

    if (!product) notFound();

    // PERF PASS 2 — one Mongo round trip instead of two (Promise.all of two
    // identical-filter queries collapsed into a single query + in-memory slice).
    const { upsellProducts, relatedProducts } = await getUpsellAndRelatedProducts(
        product.category,
        product._id
    );

    return (
        <>
            <Navbar />
            <ProductDetail
                product={product}
                upsellProducts={upsellProducts}
                relatedProducts={relatedProducts}
            />
            <Footer />
        </>
    );
}