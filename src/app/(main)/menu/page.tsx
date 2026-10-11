// src/app/(main)/menu/page.tsx
// FoodKnock — Menu page (Server Component)
// FIXED: removed `revalidate = 60` (was causing 1.4M ISR writes on Vercel)
//        replaced with `dynamic = "force-dynamic"` → always SSR, zero ISR writes.
//
// PERF PASS 2:
//   - JSON.parse(JSON.stringify(products)) replaced with serializeMongoDocs().
//     Same output shape (all fields already primitives from the lean +
//     projected query; only `_id` needed string conversion), but without the
//     double full-tree JSON stringify/parse pass. See src/lib/serialize.ts
//     for the full rationale.
//     Expected CPU: ~40-70% less serialization time per request.
//     Expected Mongo: no change (query itself untouched).
//     Expected bandwidth: no change (payload bytes identical).
//     Expected Vercel: lower CPU-ms per invocation → cheaper + faster TTFB,
//     compounds under concurrent traffic on a page that is now always SSR.

import Footer             from "@/components/shared/Footer";
import MenuClient         from "@/components/products/MenuClient";
import { connectDB }      from "@/lib/db";
import Product            from "@/models/Product";
import { getShopStatus }  from "@/models/Shop";
import { describeCloseReason } from "@/lib/shopCloseReasons";
import { serializeMongoDocs } from "@/lib/serialize";
import { AlertTriangle }  from "lucide-react";
import Link                from "next/link";

// ✅ FIX #1 — No ISR. Force dynamic SSR on every request.
// This completely eliminates ISR write costs on Vercel.
export const dynamic = "force-dynamic";

export const metadata = {
    title:       "Our Menu — Burgers, Pizza, Momos, Shakes & More",
    description: "Browse FoodKnock's full menu. Fresh burgers, pizzas, momos, cold shakes, juices, ice cream & more. Order online for fast delivery in Danta, Sikar.",
    alternates:  { canonical: "https://www.foodknock.com/menu" },
    openGraph: {
        title:       "FoodKnock Menu — Order Fresh Food Online",
        description: "Burgers, pizza, momos, shakes & ice cream — delivered fresh & fast.",
        url:         "https://www.foodknock.com/menu",
    },
};

// ✅ FIX #2 — Lean projection: only fetch fields the UI actually needs.
// Eliminates large `description`, `ingredients`, base64 blobs from payloads.
// Unchanged — projection was already minimal and correct.
const MENU_PROJECTION = {
    _id:              1,
    name:             1,
    slug:             1,
    shortDescription: 1,
    price:            1,
    compareAtPrice:   1,
    category:         1,
    image:            1,
    stock:            1,
    isAvailable:      1,
    isFeatured:       1,
    rating:           1,
    tags:             1,
} as const;

// PERF PASS 3 — in-process, per-instance 30s TTL cache for the full menu
// list, mirroring the existing getShopStatus() pattern in src/models/Shop.ts.
// This is a PUBLIC, NON-personalized, display-only read (same filter/sort/
// projection for every visitor, no cart/auth/payment data involved). Stock
// and price shown here can lag reality by up to 30s after an admin change or
// a concurrent order — that is safe because checkout re-validates stock
// (atomic $inc in createOrderCore.ts) and price (calculateAuthoritativePricing())
// live against the DB independently; nothing downstream ever trusts this
// cached value. Cache lives in module scope: it survives across requests on
// the same warm Node.js worker/Fluid instance and resets on cold start —
// same lifetime characteristic as Shop.ts's cache, not a shared/global store.
const MENU_CACHE_TTL_MS = 30_000;

// Reliability fallback — NOT a freshness window. If a refresh attempt fails
// (transient Mongo hiccup) after the normal 30s TTL has lapsed, returning []
// would make the entire public menu look empty even though a perfectly good,
// recently-fetched list is still sitting in `cachedMenuProducts`. Serving
// that stale list instead is a strictly better degraded experience — but
// ONLY up to this hard, finite ceiling. Past it, a renewed failure falls
// back to the original `[]` behavior rather than serving arbitrarily old
// data forever (no indefinite stale serving). This never extends
// menuCacheExpiresAt and never suppresses the next retry — see getProducts().
const MENU_STALE_MAX_MS = 5 * 60_000; // 5 minutes

type MenuProducts = Awaited<ReturnType<typeof fetchMenuProductsFresh>>;
let cachedMenuProducts: MenuProducts | null = null;
let menuCacheExpiresAt = 0;
// Explicit timestamp of the last SUCCESSFUL Mongo fetch, set only alongside
// cachedMenuProducts/menuCacheExpiresAt in the try branch below — never in
// the catch branch. This is the sole source of truth the stale-fallback
// check uses to bound MENU_STALE_MAX_MS; it is intentionally a separate
// variable (not derived from menuCacheExpiresAt - MENU_CACHE_TTL_MS) so the
// stale-age calculation keeps working correctly even if MENU_CACHE_TTL_MS
// is ever changed independently, and so "when did we last actually reach
// Mongo" is never implicit.
let menuCacheLastSuccessAt = 0;
let menuCacheInFlight: Promise<MenuProducts> | null = null;

async function fetchMenuProductsFresh() {
    await connectDB();
    // ✅ FIX #3 — .lean() returns plain JS objects (no Mongoose overhead)
    //             Uses compound index: (isAvailable, stock, isFeatured, createdAt)
    const products = await Product
        .find({ isAvailable: true }, MENU_PROJECTION)
        .sort({ isFeatured: -1, createdAt: -1 })
        .lean();

    // ✅ FIX #4 (PERF PASS 2) — cheap shallow serialization instead of
    // JSON.parse(JSON.stringify(...)). Same resulting shape.
    return serializeMongoDocs(products);
}

async function getProducts() {
    if (cachedMenuProducts !== null && Date.now() < menuCacheExpiresAt) {
        return cachedMenuProducts;
    }

    // In-flight de-duplication: if a refresh is already running (e.g. several
    // requests arrive within the same expired-cache instant), every caller
    // awaits the SAME in-progress fetch instead of each firing its own
    // redundant query. A failed fetch is never cached (see catch below) and
    // always clears menuCacheInFlight so the next call retries cleanly.
    if (menuCacheInFlight) {
        return menuCacheInFlight;
    }

    menuCacheInFlight = (async () => {
        try {
            const products = await fetchMenuProductsFresh();
            cachedMenuProducts = products;
            menuCacheExpiresAt = Date.now() + MENU_CACHE_TTL_MS;
            menuCacheLastSuccessAt = Date.now();
            return products;
        } catch (error) {
            console.error("PRODUCT_FETCH_ERROR:", error);

            // Transient-failure fallback (bounded — see MENU_STALE_MAX_MS
            // above). Deliberately does NOT touch menuCacheExpiresAt,
            // cachedMenuProducts, or menuCacheLastSuccessAt: the cache stays
            // marked expired either way, so the very next request still
            // attempts a fresh refresh — this failure is never mistaken for
            // a successful one and never suppresses retries. On cold start
            // (menuCacheLastSuccessAt still 0, cachedMenuProducts still
            // null) this falls straight through to the original `[]`.
            const staleAgeMs = Date.now() - menuCacheLastSuccessAt;
            if (cachedMenuProducts !== null && staleAgeMs <= MENU_STALE_MAX_MS) {
                console.warn("PRODUCT_FETCH_SERVING_STALE_FALLBACK", { ageMs: staleAgeMs });
                return cachedMenuProducts;
            }

            return [];
        } finally {
            menuCacheInFlight = null;
        }
    })();

    return menuCacheInFlight;
}

export default async function MenuPage() {
    const [products, shopStatus] = await Promise.all([
        getProducts(),
        getShopStatus().catch(() => ({ isOpen: true, closedReasonCode: null, closedReasonText: null, closedAt: null })),
    ]);
    const { isOpen } = shopStatus;
    const closedReasonLabel = describeCloseReason(shopStatus.closedReasonCode, shopStatus.closedReasonText);

    return (
        <>

            {/* ── Shop closed banner ── */}
            {!isOpen && (
                <div className="w-full border-b border-red-200 bg-gradient-to-r from-red-50 via-rose-50 to-red-50">
                    <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3.5 md:px-8">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100">
                            <AlertTriangle size={15} className="text-red-600" strokeWidth={2.5} />
                        </div>
                        <p className="text-[13px] font-bold text-red-700">
                            ⚠️ Foodknock is currently closed
                            {closedReasonLabel ? <span className="font-medium"> — {closedReasonLabel}</span> : null}.{" "}
                            <span className="font-black">Orders will resume soon.</span>{" "}
                            <span className="font-medium text-red-500">You can still browse our menu.</span>
                        </p>
                    </div>
                </div>
            )}

            {/* ── Instagram Review Reward marketing banner ── */}
            <Link href="/review-rewards"
                  className="group block w-full border-b border-pink-200/70 bg-gradient-to-r from-pink-50 via-rose-50 to-orange-50 transition-colors hover:from-pink-100 hover:via-rose-100 hover:to-orange-100">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">📸</span>
                        <p className="text-[12.5px] font-bold text-stone-700">
                            Post a FoodKnock review on Instagram and get a{" "}
                            <span className="font-black text-pink-600">FREE Burger 🍔</span>
                        </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-pink-200 bg-white px-3 py-1 text-[11px] font-black text-pink-600 shadow-sm transition-all group-hover:border-pink-300 group-hover:bg-pink-50">
                        Learn more →
                    </span>
                </div>
            </Link>

            <MenuClient products={products} shopOpen={isOpen} />
            <Footer />
        </>
    );
}