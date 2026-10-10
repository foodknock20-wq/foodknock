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
import Footer               from "@/components/shared/Footer";
import { notFound }         from "next/navigation";
import { cache }            from "react";
import { serializeMongoDoc } from "@/lib/serialize";
import { getProductDetailRecommendations, recommendationTitle } from "@/lib/recommendations";
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
            .select("name slug description shortDescription price compareAtPrice category image stock isAvailable isFeatured rating reviewCount tags ingredients")
            .lean();
        if (!product) return null;
        return serializeMongoDoc(product);
    } catch (error) {
        console.error("PRODUCT_FETCH_ERROR:", error);
        return null;
    }
});

// Pre-Phase 17 Phase 3 — replaced the plain same-category query with the
// real recommendation engine (src/lib/recommendations.ts): real co-purchase
// data first (from delivered order history, cached), same-category/tag
// fallback otherwise. Still exactly ONE Product query (plus, at most, one
// cheap ProductAffinity cache read) — same performance envelope as before,
// just better-ranked and honestly titled. Same UI-facing split as before
// (up to 3 "upsell" + up to 4 "related"), but both slices now come from one
// ranked list instead of an arbitrary same-category scan, and the section
// title reflects the REAL source (no fake "Frequently Bought Together"
// label unless genuine co-purchase data backs it).
async function getRecommendations(productId: string, category: string) {
    try {
        await connectDB();
        const { source, products } = await getProductDetailRecommendations(productId, category);

        return {
            upsellProducts: products.slice(0, 3),
            relatedProducts: products.slice(3, 7),
            upsellTitle: recommendationTitle(source, "detail"),
        };
    } catch (error) {
        console.error("PRODUCT_RECOMMENDATIONS_ERROR", error);
        return { upsellProducts: [], relatedProducts: [], upsellTitle: "You May Also Like" };
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
        // Phase 17.2 (F18): previously missing here — menu/page.tsx and
        // loyalty/layout.tsx both already set this. Matches the same
        // hardcoded production-origin convention used throughout (see
        // sitemap.ts's BASE_URL and menu/page.tsx's own canonical).
        alternates: { canonical: `https://www.foodknock.com/menu/${slug}` },
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

    const { upsellProducts, relatedProducts, upsellTitle } = await getRecommendations(
        product._id,
        product.category
    );

    // SEO fix: product detail pages had generateMetadata() (title/OG/
    // Twitter/canonical) but no structured data at all. Built strictly
    // from this same `product` record — no fabricated rating/review
    // count/availability. `aggregateRating` is included ONLY when a real
    // rating and a real review count both exist; omitted entirely
    // otherwise (never a placeholder number).
    const productJsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.shortDescription ?? product.description ?? `${product.name} — available on FoodKnock.`,
        image: product.image ? [product.image] : undefined,
        url: `https://www.foodknock.com/menu/${slug}`,
        category: product.category,
        offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: product.price,
            availability: product.isAvailable && product.stock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            url: `https://www.foodknock.com/menu/${slug}`,
        },
    };
    if (typeof product.rating === "number" && product.rating > 0 && typeof product.reviewCount === "number" && product.reviewCount > 0) {
        productJsonLd.aggregateRating = {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
        };
    }

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Menu", item: "https://www.foodknock.com/menu" },
            { "@type": "ListItem", position: 2, name: product.category, item: `https://www.foodknock.com/menu?category=${encodeURIComponent(product.category)}` },
            { "@type": "ListItem", position: 3, name: product.name, item: `https://www.foodknock.com/menu/${slug}` },
        ],
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
            <ProductDetail
                product={product}
                upsellProducts={upsellProducts}
                relatedProducts={relatedProducts}
                upsellTitle={upsellTitle}
            />
            <Footer />
        </>
    );
}