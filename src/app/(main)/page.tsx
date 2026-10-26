// src/app/(main)/page.tsx
//
// FoodKnock UI 2.0 — Phase 2: Home 2.0. Server-first — all data fetching
// stays here (extended getHomeData() + a few sibling read-only lib calls,
// all batched into one Promise.all for true parallelism). Client
// components are limited to the genuinely interactive pieces (HeroCarousel,
// ProductRail's cart wiring, HomeSearchEntry, LoyaltyPromoStrip) — see each
// file's own header for why. No business logic (pricing/cart/coupons/
// loyalty/serviceability authority) lives here or was changed — only real,
// already-existing data sources are read.

export const dynamic = "force-dynamic";

import Footer from "@/components/shared/Footer";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import Review from "@/models/Review";
import { getShopStatus } from "@/models/Shop";
import { describeCloseReason } from "@/lib/shopCloseReasons";
import { getCategoriesWithCounts, type CategoryWithCount } from "@/lib/catalogCategories";
import { getActiveCampaigns, type PublicCampaign, type PublicOffer } from "@/lib/campaignPublic";
import { getActivePublicOffers } from "@/lib/offersPublic";
import { FREE_DELIVERY_AT } from "@/lib/delivery";
import { computeSiteStats } from "@/lib/siteStats";

import HomeSearchEntry from "@/components/home/HomeSearchEntry";
import HomeUpgradeNotice from "@/components/home/HomeUpgradeNotice";
import ShopClosedBanner from "@/components/home/ShopClosedBanner";
import FreeDeliveryStrip from "@/components/home/FreeDeliveryStrip";
import CategoryRail from "@/components/home/CategoryRail";
import HeroCarousel, { type HeroSlide } from "@/components/home/HeroCarousel";
import ProductRail, { type RailProduct } from "@/components/home/ProductRail";
import LoyaltyPromoStrip from "@/components/home/LoyaltyPromoStrip";
import FeaturesSection from "@/components/home/FeaturesSection";
import OfferBanner from "@/components/home/OfferBanner";
import TestimonialsStrip from "@/components/home/TestimonialsStrip";
import FinalCta from "@/components/home/FinalCta";
import ReferralPill from "@/components/home/ReferralPill";
import SpinWinCTA from "@/components/home/SpinWinCTA";

export type HomeProduct = {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    shortDescription?: string;
    price: number;
    compareAtPrice?: number | null;
    category: string;
    image: string;
    stock: number;
    isAvailable: boolean;
    isFeatured: boolean;
    rating: number | null;
};

export type HomeReview = {
    _id: string;
    userName: string;
    rating: number;
    comment: string;
    createdAt: string;
};

// FoodKnock Phase 6 — `avgRating` is only ever a real figure now. It used
// to fall back to a hardcoded "4.9" whenever there were zero approved
// reviews (same fake-rating-fallback pattern already fixed elsewhere in
// Phase 4/5) — `null` means "no real rating yet," and OfferBanner now
// hides the rating stat entirely in that case instead of showing a
// made-up number. `happyCustomers` removed outright: it was a fabricated
// figure (`totalReviews * 6`, floored at 500, or a flat 2400 fallback)
// that was never actually rendered anywhere — dead fake-data computation.
//
// CRITICAL FINAL FIX — the "real figure" above was still WRONG, just not
// fabricated: `totalReviews`/`avgRating` were computed from the SAME
// `Review.find({isApproved:true}).limit(10)` query used to source the
// homepage's 3-card testimonial strip. With more than 10 approved reviews
// in the database, that query silently returns only the 10 most recent —
// so the displayed "rating" and "count" were real numbers, just real
// numbers for the wrong 10-review subset, never the actual site-wide
// total (e.g. an owner-reported ~88 approved reviews would still render
// as "10 reviews" and whatever those 10 happened to average, forever).
// Fixed by mirroring the already-correct, already-reviewed pattern this
// exact problem was solved with on src/app/(main)/reviews/page.tsx: a
// cheap, parallel `Review.countDocuments({isApproved:true})` for the
// authoritative total, and a `.limit(200)` (not 10) bounded fetch — large
// enough that avgRating is the TRUE average unless/until approved reviews
// ever exceed 200, matching that page's own documented rationale for not
// running a separate aggregation purely for cosmetic stats. This page
// still only renders 3 of them (`recentReviews`), same as before.
export type SiteStats = {
    avgRating: string | null;
    totalReviews: number;
};

const PRODUCT_SELECT = "_id name slug shortDescription price compareAtPrice category image stock isAvailable isFeatured rating";

// ─── Data fetcher ──────────────────────────────────────────────────────────
//
// INCIDENT (Vercel Fluid Active CPU) — Phase 6 (independent, non-caching):
// the home page stays force-dynamic (caching its HTML is deferred — see the
// incident report), so WITHOUT this the ~8 catalog/review/category/campaign/
// offer DB reads below PLUS the popular-products sort/dedup and
// computeSiteStats ran on EVERY home request, including every crawler hit.
// This adds the SAME in-process, per-instance 30s TTL cache already proven on
// /menu's getProducts() and Shop.ts's getShopStatus(): a PUBLIC, non-
// personalized, display-only read (identical for every visitor — no cart/
// auth/payment data). Price/stock/offers/shop-status display may lag reality
// by ≤30s, which is safe because checkout re-validates stock (atomic $inc in
// createOrderCore) and price (calculateAuthoritativePricing) live against the
// DB; nothing downstream ever trusts this cached value. Module scope: survives
// across requests on a warm instance, resets on cold start; never shared/
// global, never mixes users. Collapses the repeated DB + aggregation work to
// once per 30s per warm instance.
const HOME_CACHE_TTL_MS = 30_000;
// Bounded transient-failure fallback (NOT a freshness window): if a refresh
// throws after the TTL has lapsed, serve the last good data up to this hard
// ceiling instead of a blank homepage; past it, fall back to empty. Mirrors
// /menu's MENU_STALE_MAX_MS. Never extends the TTL, never suppresses retries.
const HOME_STALE_MAX_MS = 5 * 60_000;

type HomeData = Awaited<ReturnType<typeof fetchHomeDataFresh>>;

const EMPTY_HOME_DATA: HomeData = {
    featuredProducts: [], popularProducts: [], valueProducts: [], comboProducts: [],
    recentReviews: [], stats: { avgRating: null, totalReviews: 0 },
    categories: [], isShopOpen: true, closedReasonLabel: null, campaigns: [], offers: [],
};

let cachedHomeData: HomeData | null = null;
let homeCacheExpiresAt = 0;
let homeCacheLastSuccessAt = 0;
let homeCacheInFlight: Promise<HomeData> | null = null;

// Cached entry point used by the page (same name as before → caller unchanged).
// In-flight de-duplication: concurrent cache-miss requests share one fetch. A
// failed fetch is NEVER cached — the TTL stays expired so the next request
// retries cleanly, and a bounded stale fallback avoids a blank page.
async function getHomeData(): Promise<HomeData> {
    if (cachedHomeData !== null && Date.now() < homeCacheExpiresAt) {
        return cachedHomeData;
    }
    if (homeCacheInFlight) {
        return homeCacheInFlight;
    }
    homeCacheInFlight = (async () => {
        try {
            const data = await fetchHomeDataFresh();
            cachedHomeData = data;
            homeCacheExpiresAt = Date.now() + HOME_CACHE_TTL_MS;
            homeCacheLastSuccessAt = Date.now();
            return data;
        } catch {
            // fetchHomeDataFresh already logged the underlying error. Serve the
            // last good data within the bounded stale window; otherwise empty.
            const staleAgeMs = Date.now() - homeCacheLastSuccessAt;
            if (cachedHomeData !== null && staleAgeMs <= HOME_STALE_MAX_MS) {
                console.warn("HOME_DATA_SERVING_STALE_FALLBACK", { ageMs: staleAgeMs });
                return cachedHomeData;
            }
            return EMPTY_HOME_DATA;
        } finally {
            homeCacheInFlight = null;
        }
    })();
    return homeCacheInFlight;
}

async function fetchHomeDataFresh(): Promise<{
    featuredProducts: HomeProduct[];
    popularProducts: HomeProduct[];
    valueProducts: HomeProduct[];
    comboProducts: HomeProduct[];
    recentReviews: HomeReview[];
    stats: SiteStats;
    categories: CategoryWithCount[];
    isShopOpen: boolean;
    closedReasonLabel: string | null;
    campaigns: PublicCampaign[];
    offers: PublicOffer[];
}> {
    try {
        await connectDB();

        const [
            rawProducts, rawPopular, rawValue, rawCombos, approvedReviews, totalApprovedReviews,
            categories, shopStatus, campaigns, offers,
        ] = await Promise.all([
            Product.find({ isAvailable: true, stock: { $gt: 0 } })
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(6)
                .select(PRODUCT_SELECT)
                .lean(),

            // "Popular Right Now" (formerly "Best Sellers") — same
            // isFeatured + hardcoded category-priority + recency pool as
            // before, just honestly relabeled: there is no real sales-count
            // metric on Product to call this "best sellers".
            Product.find({
                isAvailable: true,
                stock: { $gt: 0 },
                category: { $in: ["Pizza", "Ice Cream", "Thali", "Momos", "Sandwich", "Shake", "Burger", "Coffee"] },
            })
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(20)
                .select(PRODUCT_SELECT)
                .lean(),

            // FoodKnock UI 2.0 — Phase 2: new "Under ₹99" value section.
            Product.find({ isAvailable: true, stock: { $gt: 0 }, price: { $lte: 99 } })
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(10)
                .select(PRODUCT_SELECT)
                .lean(),

            // FoodKnock UI 2.0 — Phase 2: new "Combo Deals" section — same
            // real "Combos" category value src/components/products/ComboSection.tsx
            // already filters client-side on Menu, queried server-side here.
            Product.find({ isAvailable: true, stock: { $gt: 0 }, category: /^combos$/i })
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(10)
                .select(PRODUCT_SELECT)
                .lean(),

            Review.find({ isApproved: true })
                .sort({ createdAt: -1 })
                .limit(200)
                .select("userName rating comment createdAt")
                .lean(),
            Review.countDocuments({ isApproved: true }),

            getCategoriesWithCounts(),
            getShopStatus().catch(() => ({ isOpen: true, closedReasonCode: null, closedReasonText: null, closedAt: null })),
            getActiveCampaigns(5),
            getActivePublicOffers(5),
        ]);

        const mapProduct = (p: any): HomeProduct => ({
            _id: String(p._id),
            name: p.name,
            slug: p.slug,
            shortDescription: p.shortDescription,
            price: p.price,
            compareAtPrice: p.compareAtPrice ?? null,
            category: p.category,
            image: p.image,
            stock: p.stock,
            isAvailable: p.isAvailable,
            isFeatured: p.isFeatured,
            rating: typeof p.rating === "number" ? p.rating : null,
        });

        const featuredProducts = (rawProducts as any[]).map(mapProduct);
        const valueProducts = (rawValue as any[]).map(mapProduct);
        const comboProducts = (rawCombos as any[]).map(mapProduct);

        // Same dedupe-by-category logic as before (max 2 per category, 10 total).
        const popularProducts = (() => {
            const catCount: Record<string, number> = {};
            const result: HomeProduct[] = [];
            const PRIORITY_ORDER = ["Ice Cream", "Thali", "Pizza", "Burger", "Momos", "Sandwich", "Shake", "Coffee"];
            const sorted = (rawPopular as any[]).sort((a, b) => {
                const ai = PRIORITY_ORDER.indexOf(a.category);
                const bi = PRIORITY_ORDER.indexOf(b.category);
                if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
            });
            for (const p of sorted) {
                const cat = p.category;
                catCount[cat] = (catCount[cat] || 0) + 1;
                if (catCount[cat] <= 2 && result.length < 10) result.push(mapProduct(p));
                if (result.length >= 10) break;
            }
            return result;
        })();

        // `totalReviews` is the authoritative `countDocuments` result, NOT
        // `approvedReviews.length` — the latter is capped at 200 and would
        // silently under-report again once approved reviews pass that
        // bound. `avgNum`/`totalReviews` computation itself is the pure,
        // directly-tested `computeSiteStats()` (src/lib/siteStats.ts) — see
        // that file's header for why this was pulled out as its own
        // function rather than left inline.
        const { avgRating, totalReviews } = computeSiteStats(
            (approvedReviews as any[]).map((r: any) => r.rating || 0),
            totalApprovedReviews as number
        );

        const recentReviews = (approvedReviews as any[])
            .filter((r: any) => r.comment && r.comment.trim().length >= 10)
            .slice(0, 3)
            .map((r: any) => ({
                _id: String(r._id),
                userName: r.userName ?? "Customer",
                rating: r.rating ?? 5,
                comment: r.comment ?? "",
                createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
            }));

        return {
            featuredProducts,
            popularProducts,
            valueProducts,
            comboProducts,
            recentReviews,
            stats: { avgRating, totalReviews },
            categories,
            isShopOpen: shopStatus.isOpen,
            closedReasonLabel: describeCloseReason(shopStatus.closedReasonCode, shopStatus.closedReasonText),
            campaigns,
            offers,
        };
    } catch (error) {
        // Re-throw (after logging) so the cached getHomeData() wrapper decides
        // whether to serve bounded stale data or empty — a transient failure
        // must never be cached as a "successful" empty homepage.
        console.error("HOME_DATA_FETCH_ERROR:", error);
        throw error;
    }
}

// Converts a HomeProduct into the shape ProductRail/ProductCardShell expect.
function toRailProduct(p: HomeProduct): RailProduct {
    return {
        _id: p._id,
        name: p.name,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        image: p.image,
        stock: p.stock,
        isAvailable: p.isAvailable,
        slug: p.slug,
        category: p.category,
        rating: p.rating,
    };
}

// Pre-Phase 17 — Home/Search polish: the one promo scroller's slide mix —
// active campaigns and storewide offers are PRIORITIZED (real data from
// the existing campaign/offer engine, src/lib/campaignPublic.ts /
// offersPublic.ts — no second campaign model, no invented dates/links),
// then topped up with real, currently-orderable products so the strip
// reaches ~5-6 slides without ever duplicating a product or fabricating
// content. Offers have no real banner/product image of their own, so
// their slide uses `image: null` (HeroCarousel renders a restrained
// gradient instead of a mismatched photo or the FoodKnock logo).
const TARGET_SLIDE_COUNT = 6;

function buildPromoSlides(campaigns: PublicCampaign[], offers: PublicOffer[], featuredProducts: HomeProduct[]): HeroSlide[] {
    const slides: HeroSlide[] = [];

    for (const c of campaigns) {
        slides.push({
            id: `campaign-${c._id}`,
            // A genuine campaign banner is real campaign artwork — safe to
            // use directly. No banner on file → text-first slide, never a
            // substituted/mismatched photo.
            image: c.heroImage || null,
            eyebrow: "FoodKnock Specials",
            title: c.title,
            subtitle: c.shortDescription || undefined,
            badge: null,
            countdownEndAt: c.endAt,
            ctaLabel: "Explore",
            ctaHref: `/campaigns/${c.slug}`,
        });
    }

    for (const o of offers) {
        const badge =
            o.discountType === "PERCENTAGE" ? `${o.discountValue}% OFF`
                : o.discountType === "FIXED" ? `₹${o.discountValue} OFF`
                    : "FREE DELIVERY";
        slides.push({
            id: `offer-${o._id}`,
            image: null,
            eyebrow: "Limited Offer",
            title: o.name,
            subtitle: o.description || undefined,
            badge,
            countdownEndAt: null,
            ctaLabel: "Shop Now",
            ctaHref: "/menu",
        });
    }

    // Top up with real, available, currently-featured products — never a
    // duplicate of one already used above, never padded past what the
    // catalog actually supports.
    const usedProductIds = new Set<string>();
    for (const p of featuredProducts) {
        if (slides.length >= TARGET_SLIDE_COUNT) break;
        if (usedProductIds.has(p._id)) continue;
        usedProductIds.add(p._id);
        slides.push({
            id: `product-${p._id}`,
            image: p.image,
            eyebrow: "On the Menu",
            title: p.name,
            subtitle: p.shortDescription,
            badge: null,
            price: p.price,
            countdownEndAt: null,
            ctaLabel: "Order Now",
            ctaHref: `/menu/${p.slug}`,
        });
    }

    if (slides.length === 0) {
        slides.push({
            id: "free-delivery",
            image: null,
            eyebrow: "Always a Good Deal",
            title: `Free delivery above ₹${FREE_DELIVERY_AT}`,
            subtitle: "On every order, every day — no code needed.",
            badge: null,
            countdownEndAt: null,
            ctaLabel: "Start Ordering",
            ctaHref: "/menu",
        });
    }

    return slides;
}

export default async function HomePage() {
    const {
        featuredProducts, popularProducts, valueProducts, comboProducts,
        recentReviews, stats, categories, isShopOpen, closedReasonLabel,
        campaigns, offers,
    } = await getHomeData();

    const heroSlides = buildPromoSlides(campaigns, offers, featuredProducts);

    return (
        <>
            <main className="bg-fk-bg">
                {/* SEO fix: the homepage previously had no <h1> anywhere —
                    HeroCarousel's own heading is an <h2> (correct, since
                    it's a rotating promotional slide, not a stable page
                    title) and nothing else on this page used an <h1> at
                    all. Every page should have exactly one. Visually
                    hidden (sr-only) rather than a visible duplicate
                    heading, since the hero/search area already covers
                    this content visually and a second visible heading
                    directly above it would be redundant, not an
                    improvement. Text matches the verified business facts
                    only (vegetarian cloud kitchen, Danta/Sikar/Rajasthan,
                    online ordering) — no invented claims. */}
                <h1 className="sr-only">
                    FoodKnock — Vegetarian Online Food Delivery in Danta, Sikar, Rajasthan
                </h1>
                {/* TEMPORARY — FoodKnock 2.0 migration notice, remove after
                    ~1 month alongside src/components/home/HomeUpgradeNotice.tsx. */}
                <HomeUpgradeNotice />
                <HomeSearchEntry />
                {!isShopOpen && <ShopClosedBanner closedReasonLabel={closedReasonLabel} />}

                {/* Pre-Phase 17 — Home/Search polish: compact promo scroller
                    sits directly below search, the Refer/Spin action row
                    directly below that — the explicit requested order.
                    Category/product discovery follows. */}
                <HeroCarousel slides={heroSlides} />

                {/* Spin & Win CTA integration — one compact, centered action
                    row holding both the existing Refer-a-Friend CTA and the
                    new Spin & Win CTA, sharing the SAME px-4/mx-auto/max-w-7xl
                    container language every other Home section already uses
                    (HeroCarousel, FreeDeliveryStrip, etc.) — no new layout
                    system. SpinWinCTA only navigates to /loyalty?tab=spin;
                    it doesn't load the Spin wheel/reward config itself. */}
                <div className="px-4 pt-3 md:px-8">
                    <div className="mx-auto flex max-w-7xl items-stretch justify-center gap-2 md:gap-2.5">
                        <ReferralPill />
                        <SpinWinCTA />
                    </div>
                </div>

                <FreeDeliveryStrip />
                <CategoryRail categories={categories} />

                <ProductRail title="Featured Products" viewAllHref="/menu" products={featuredProducts.map(toRailProduct)} />
                <ProductRail title="Popular Right Now" viewAllHref="/menu" products={popularProducts.map(toRailProduct)} />
                <ProductRail title="Under ₹99" viewAllHref="/menu" products={valueProducts.map(toRailProduct)} />
                <ProductRail title="Combo Deals" viewAllHref="/menu?category=Combos" products={comboProducts.map(toRailProduct)} />

                <LoyaltyPromoStrip />
                <FeaturesSection />
                <OfferBanner stats={stats} />
                <TestimonialsStrip reviews={recentReviews} />
                <FinalCta />
            </main>
            <Footer />
        </>
    );
}
