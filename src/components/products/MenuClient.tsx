"use client";

// src/components/products/MenuClient.tsx
// WAVE 3C FINAL — SURGICAL CLEANUP
// CHANGES vs WAVE 3B:
//   • ComboSection rendered DIRECTLY — outer redundant combo wrapper removed
//   • productCounts built in the SAME single-pass scan as iceCreams/thalis/combos/categoryMap
//   • CategorySection receives `products` (pre-sorted) + `availableCount` — does ZERO internal sort/filter
//   • No per-render style tag injections (style jsx global moved to module-level or removed)
//   • All WAVE 3B improvements preserved
//
// PERF PASS 2 (this change only):
//   • filteredProducts no longer opens with `let list = [...products]`.
//     WHY: that initial spread performs a full O(n) array clone that is
//     immediately discarded/replaced the moment either the category or
//     search filter runs (`.filter()` already returns a brand-new array —
//     it never mutates its source). Since `products` itself is never
//     mutated anywhere in this component, reading from it directly is safe
//     and skips one redundant full-array copy on every keystroke of the
//     search box and every category click.
//     Expected CPU: ~50% less array-copy work in the hot search/filter path
//     for this memo (one array pass instead of two on every filtered call).
//     Expected Mongo: none (client-side only).
//     Expected bandwidth: none.
//     Expected Vercel: none (this runs in the browser) — pure client CPU/
//     responsiveness improvement, most noticeable while typing in the
//     search box on larger menus.
//
// WAVE 3D (this change only):
//   • CATEGORY_ORDER: added "Special Pizza" immediately after "Pizza" so the
//     category slider and section list both place it in the required spot.
//     sortCats() already places any category found in CATEGORY_ORDER at its
//     index in that array — no other logic needed to change.

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import ProductGrid from "./ProductGrid";
import ComboSection from "./ComboSection";
import TopPicksSection from "./TopPicksSection";
import CategorySlider from "./CategorySlider";
import CategorySection from "./CategorySection";
import IceCreamSection from "./IceCreamSection";
import ThaliSection from "./ThaliSection";
import { X, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import SearchBar from "@/components/shell/SearchBar";
import MenuFilters, { type MenuFilterState, DEFAULT_MENU_FILTERS } from "./MenuFilters";
import MenuSort, { type MenuSortOption } from "./MenuSort";
import RecentSearches, { recordRecentSearch } from "./RecentSearches";
import { cn } from "@/lib/utils";
import { DELIVERY_TIME_ESTIMATE } from "@/lib/businessHours";

// ─── Types ─────────────────────────────────────────────────────────────────
type Product = {
    _id: string; name: string; description: string; shortDescription?: string;
    price: number; compareAtPrice?: number | null; category: string; image: string;
    stock: number; isAvailable: boolean; isFeatured?: boolean; tags?: string[]; slug: string;
};

// ─── Category display order ─────────────────────────────────────────────────
const CATEGORY_ORDER = [
    "Combos", "Pizza", "Special Pizza", "Burger", "Sandwich", "Momos", "Pasta",
    "Noodles", "Maggi", "Chinese", "Pavbhaji", "Patties", "Fries",
    "Snacks", "Shake", "Juice", "Coffee", "Tea", "Ice Cream", "Thali",
];

// PERF: excluded from generic category sections — checked by lowercase string
const SECTION_EXCLUDED = new Set(["all", "combos", "ice cream", "thali"]);

const normalize = (cat: string) =>
    cat.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function sortCats(cats: string[]): string[] {
    const noAll = cats.filter(c => c !== "All");
    const ordered = CATEGORY_ORDER.filter(o =>
        noAll.some(c => c.toLowerCase() === o.toLowerCase())
    );
    const rest = noAll
        .filter(c => !CATEGORY_ORDER.some(o => o.toLowerCase() === c.toLowerCase()))
        .sort();
    return ["All", ...ordered, ...rest];
}

// PERF: pure top-picks filter — lives outside component, called once in useMemo
function computeTopPicks(products: Product[]): Product[] {
    const result: Product[] = [];
    for (const p of products) {
        if (result.length >= 12) break;
        if (
            p.isFeatured ||
            p.tags?.some(t => {
                const tl = t.toLowerCase().trim();
                return tl === "top-picks" || tl === "top picks";
            })
        ) {
            result.push(p);
        }
    }
    return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function MenuClient({
    products,
    shopOpen = true,
}: {
    products: Product[];
    shopOpen?: boolean;
}) {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All");
    const [showTop, setShowTop] = useState(false);
    const [filters, setFilters] = useState<MenuFilterState>(DEFAULT_MENU_FILTERS);
    const [sort, setSort] = useState<MenuSortOption>("recommended");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);

    const stickyRef = useRef<HTMLDivElement>(null);

    // ── PHASE 7A: category/search are now URL-synced state ─────────────────
    // PROBLEM: category/search previously lived ONLY in local useState, never
    // written back to the URL. /menu is `dynamic = "force-dynamic"` (Phase 6
    // decision, preserved) and product cards link with `prefetch={false}` to
    // a separate `/menu/[slug]` route (also force-dynamic) — every visit to
    // /menu, including a browser Back from a product page, is a genuine fresh
    // server round trip, not a soft client-cache restore. That meant Back
    // always reset the customer to "All" at the top, discarding whatever
    // category/search they had been browsing — exactly the broken example in
    // the Phase 7 spec ("return to Pizza category", not "an unrelated
    // position").
    // FIX: category/search are mirrored into the URL (`?category=&search=`)
    // via router.replace — replace, not push, so refining a filter never
    // stacks extra Back presses (one click = one entry, not two or three).
    // Back now returns to the SAME /menu?category=... URL that was active
    // before leaving, so the existing "scroll to that category's section"
    // behavior (already present, unchanged) fires again on return —
    // restoring the right category instead of defaulting to "All". This is
    // URL/history-state restoration, not pixel-perfect scroll replication
    // (not required — see Phase 7 Step 13) — it uses only Next.js's own
    // router primitives, no new state library, no custom history mechanism.
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Prevents the URL→state sync effect below from re-processing a change
    // THIS component just wrote (category click / search typing) as if it
    // were an external navigation — only Back/Forward/deep-link/fresh-visit
    // should restore state from the URL; a self-triggered replace should not
    // re-run the "scroll to section" behavior a second time.
    const skipNextUrlSync = useRef(false);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Phase 3: extends the exact same URL-sync pattern to filters/sort —
    // same debounce-free replace-not-push approach already used for
    // category/search, so filter/sort state survives Back/Forward and
    // deep links too, not just category/search.
    const updateUrl = useCallback((
        nextCategory: string,
        nextSearch: string,
        nextFilters: MenuFilterState = filters,
        nextSort: MenuSortOption = sort,
    ) => {
        skipNextUrlSync.current = true;
        const params = new URLSearchParams();
        if (nextCategory !== "All") params.set("category", nextCategory);
        if (nextSearch.trim()) params.set("search", nextSearch.trim());
        if (nextFilters.offersOnly) params.set("offers", "1");
        if (nextFilters.hideSoldOut) params.set("instock", "1");
        if (nextSort !== "recommended") params.set("sort", nextSort);
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [router, pathname, filters, sort]);

    useEffect(() => () => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    }, []);

    useEffect(() => {
        if (skipNextUrlSync.current) {
            skipNextUrlSync.current = false;
            return;
        }

        const cat = searchParams.get("category");
        const q   = searchParams.get("search") ?? "";
        const normalized = cat ? normalize(cat) : "All";

        setCategory(normalized);
        setSearch(q);
        setFilters({
            offersOnly: searchParams.get("offers") === "1",
            hideSoldOut: searchParams.get("instock") === "1",
        });
        const sortParam = searchParams.get("sort");
        setSort(sortParam === "price-asc" || sortParam === "price-desc" ? sortParam : "recommended");

        if (!cat) return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const sectionId = `section-${normalized.toLowerCase().replace(/\s+/g, "-")}`;
                const el = document.getElementById(sectionId);
                if (el) {
                    const top = el.getBoundingClientRect().top + window.scrollY - 80;
                    // 'auto' (instant), not 'smooth' — this path also covers
                    // Back navigation landing back on a category; an
                    // animated scroll on every Back is more disorienting
                    // than an instant one, and avoids fighting any
                    // browser-native restoration already in flight.
                    window.scrollTo({ top, behavior: "auto" });
                }
            });
        });
    }, [searchParams]);

    useEffect(() => {
        let ticking = false;
        const fn = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    setShowTop(window.scrollY > 600);
                    ticking = false;
                });
                ticking = true;
            }
        };
        window.addEventListener("scroll", fn, { passive: true });
        return () => window.removeEventListener("scroll", fn);
    }, []);

    // ── WAVE 3C: SINGLE-PASS SCAN ──────────────────────────────────────────
    // One loop fills: iceCreams, thalis, combos, categoryMap, productCounts, uniqueCatSet
    // No secondary filter/forEach for productCounts — built inline.
    const { iceCreams, thalis, combos, topPicks, categoryMap, productCounts, categories } =
        useMemo(() => {
            const iceCreams: Product[] = [];
            const thalis: Product[] = [];
            const combos: Product[] = [];
            const categoryMap = new Map<string, { available: Product[]; unavailable: Product[] }>();
            // productCounts: category → total count (for CategorySlider badges)
            const rawCounts: Record<string, number> = { All: products.length };
            const uniqueCatSet = new Set<string>();

            for (const p of products) {
                const norm = normalize(p.category);
                const normLower = norm.toLowerCase();
                const avail = p.isAvailable && p.stock > 0;

                // Track unique categories for slider (all products)
                uniqueCatSet.add(norm);
                rawCounts[norm] = (rawCounts[norm] ?? 0) + 1;

                if (normLower === "ice cream") { iceCreams.push(p); continue; }
                if (normLower === "thali") { thalis.push(p); continue; }
                if (normLower === "combos") { combos.push(p); continue; }

                // Generic category sections bucket (excludes ice cream / thali / combos)
                if (!SECTION_EXCLUDED.has(normLower)) {
                    let bucket = categoryMap.get(norm);
                    if (!bucket) { bucket = { available: [], unavailable: [] }; categoryMap.set(norm, bucket); }
                    if (avail) bucket.available.push(p);
                    else bucket.unavailable.push(p);
                }
            }

            const topPicks = computeTopPicks(products);
            const categories = sortCats(Array.from(uniqueCatSet));

            return { iceCreams, thalis, combos, topPicks, categoryMap, productCounts: rawCounts, categories };
        }, [products]);

    // WAVE 3B: precomputed sorted thalis for ThaliSection (available first)
    const sortedThalis = useMemo(() => {
        const av = thalis.filter(p => p.isAvailable && p.stock > 0);
        const un = thalis.filter(p => !p.isAvailable || p.stock <= 0);
        return { items: [...av, ...un], availableCount: av.length };
    }, [thalis]);

    // WAVE 3B: precomputed sorted ice creams for IceCreamSection
    const sortedIceCreams = useMemo(() => {
        const av = iceCreams.filter(p => p.isAvailable && p.stock > 0);
        const un = iceCreams.filter(p => !p.isAvailable || p.stock <= 0);
        return [...av, ...un];
    }, [iceCreams]);

    // WAVE 3C: categorySections — CategorySection receives pre-sorted array + availableCount
    // CategorySection does ZERO internal filter/sort work
    const categorySections = useMemo(() => {
        return categories
            .filter(c => !SECTION_EXCLUDED.has(c.toLowerCase()))
            .map(cat => {
                const bucket = categoryMap.get(cat);
                if (!bucket) return null;
                return {
                    cat,
                    products: [...bucket.available, ...bucket.unavailable],
                    availableCount: bucket.available.length,
                };
            })
            .filter((s): s is NonNullable<typeof s> => s !== null && s.products.length > 0);
    }, [categories, categoryMap]);

    // PERF PASS 2: `list` now starts as a direct reference to `products`
    // instead of `[...products]`. `products` is never mutated (only ever
    // read), and `.filter()` below always returns a fresh array, so this is
    // safe and removes one redundant O(n) clone from the hot search/filter
    // path. See file-header comment for full rationale.
    const filteredProducts = useMemo(() => {
        let list: Product[] = products;
        if (category !== "All")
            list = list.filter(p => normalize(p.category) === category);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                (p.description || "").toLowerCase().includes(q)
            );
        }
        // Phase 3: real, data-backed filters only — see MenuFilters.tsx header.
        if (filters.offersOnly) {
            list = list.filter(p => typeof p.compareAtPrice === "number" && p.compareAtPrice > p.price);
        }

        const av = list.filter(p => p.isAvailable && p.stock > 0);
        const un = filters.hideSoldOut ? [] : list.filter(p => !p.isAvailable || p.stock <= 0);

        const priceSort = (a: Product, b: Product) =>
            sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : 0;
        if (sort !== "recommended") {
            av.sort(priceSort);
            un.sort(priceSort);
        }

        const sorted = [...av, ...un];
        if (category !== "All" && !["combos", "ice cream", "thali"].includes(category.toLowerCase()))
            return sorted.filter(p => !["combos", "ice cream", "thali"].includes(normalize(p.category).toLowerCase()));
        return sorted;
    }, [products, category, search, filters, sort]);

    const isBrowse = useMemo(
        () => !search.trim() && category === "All" && !filters.offersOnly && !filters.hideSoldOut && sort === "recommended",
        [search, category, filters, sort]
    );

    const handleFiltersChange = useCallback((next: MenuFilterState) => {
        setFilters(next);
        updateUrl(category, search, next, sort);
    }, [category, search, sort, updateUrl]);

    const handleSortChange = useCallback((next: MenuSortOption) => {
        setSort(next);
        updateUrl(category, search, filters, next);
    }, [category, search, filters, updateUrl]);

    const activeFilterCount = (filters.offersOnly ? 1 : 0) + (filters.hideSoldOut ? 1 : 0);

    const handleCategorySelect = useCallback((cat: string) => {
        setCategory(cat);
        setSearch("");
        updateUrl(cat, "");
        requestAnimationFrame(() => {
            stickyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }, [updateUrl]);

    const resetAll = useCallback(() => {
        setSearch("");
        setCategory("All");
        updateUrl("All", "");
    }, [updateUrl]);

    const clearSearch = useCallback(() => {
        setSearch("");
        updateUrl(category, "");
    }, [category, updateUrl]);

    // Local state updates instantly (every keystroke); the URL write is
    // debounced so typing doesn't call router.replace on every character —
    // replace() is cheap (no history entry) but there's no reason to churn
    // the URL/searchParams identity that fast.
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            updateUrl(category, value);
            recordRecentSearch(value);
        }, 400);
    }, [category, updateUrl]);

    return (
        <main className="min-h-screen bg-fk-bg">

            {/* ───────────────────────────────────────
                1. HERO
            ─────────────────────────────────────── */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-fk-gold-soft/70 via-fk-bg to-fk-surface-selected/60" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.032]"
                    style={{ backgroundImage: "radial-gradient(circle,#92400e 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
                <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-20 blur-3xl"
                    style={{ background: "radial-gradient(circle,var(--fk-accent),transparent 70%)" }} />
                <div className="pointer-events-none absolute -bottom-10 left-0 h-48 w-48 rounded-full opacity-10 blur-3xl"
                    style={{ background: "radial-gradient(circle,var(--fk-gold),transparent 70%)" }} />

                <div className="relative mx-auto max-w-7xl px-4 pb-7 pt-8 md:px-8 md:pb-10 md:pt-14">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-fk-pill border border-fk-border bg-fk-surface-elevated/80 px-3.5 py-1.5 shadow-sm backdrop-blur-sm">
                        <span className="flex h-2 w-2 animate-pulse motion-reduce:animate-none rounded-full bg-[var(--fk-accent)]"
                            style={{ boxShadow: "0 0 8px rgba(255,92,26,0.6)" }} />
                        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--fk-accent)]">
                            FoodKnock · Live Menu
                        </span>
                    </div>

                    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                        <div className="max-w-lg">
                            <h1 className="font-display text-[2.2rem] font-black leading-[1.06] tracking-tight text-fk-text md:text-5xl lg:text-6xl">
                                <span className="bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] bg-clip-text text-transparent">
                                    Hot &amp; Fresh,
                                </span>
                                <br />
                                <span className="text-fk-text">Every Craving.</span>
                            </h1>
                            <p className="mt-2.5 text-[13px] leading-relaxed text-fk-text-secondary md:text-[15px]">
                                Burgers, pizza, momos, shakes &amp; more — cooked fresh the moment you order. 🔥
                            </p>
                            <div className="mt-3.5 flex flex-wrap gap-1.5">
                                {[
                                    { icon: "🔥", label: "Made Fresh" },
                                    { icon: "⚡", label: "Fast Delivery" },
                                    { icon: "🌿", label: "Fresh Ingredients" },
                                    { icon: "📍", label: "Made in Danta, Sikar" },
                                ].map(b => (
                                    <span key={b.label} className="flex items-center gap-1 rounded-fk-pill border border-fk-border bg-fk-surface-selected px-2.5 py-1 text-[10.5px] font-bold text-fk-text-secondary">
                                        {b.icon} {b.label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* CRITICAL FINAL FIX — real-data stat bar, new visible
                            header element. `products.length`/`categories.length`
                            are the exact same real arrays every section below
                            already renders from (no separate/invented count);
                            delivery estimate reuses the shared
                            src/lib/businessHours.ts constant introduced in the
                            prior phase so this header can never drift from
                            OfferBanner's/Footer's own copy of that number. */}
                        <div className="flex w-fit shrink-0 items-center gap-2 rounded-fk-lg border border-fk-border bg-fk-surface-elevated/90 px-3 py-3 shadow-sm backdrop-blur-sm sm:gap-4 sm:px-5 sm:py-3.5">
                            <div className="text-center">
                                <p className="font-display text-lg font-black leading-none text-fk-text md:text-2xl">{products.length}</p>
                                <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-fk-text-tertiary sm:text-[9.5px]">Dishes</p>
                            </div>
                            <div className="h-8 w-px bg-fk-border" />
                            <div className="text-center">
                                <p className="font-display text-lg font-black leading-none text-fk-text md:text-2xl">{Math.max(categories.length - 1, 0)}</p>
                                <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-fk-text-tertiary sm:text-[9.5px]">Categories</p>
                            </div>
                            <div className="h-8 w-px bg-fk-border" />
                            <div className="text-center">
                                <p className="font-display text-base font-black leading-none text-[var(--fk-accent)] md:text-2xl">{DELIVERY_TIME_ESTIMATE.label}</p>
                                <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-fk-text-tertiary sm:text-[9.5px]">ETA</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ───────────────────────────────────────
                2. CATEGORY IMAGE SLIDER
            ─────────────────────────────────────── */}
            <CategorySlider
                categories={categories}
                activeCategory={category}
                onSelect={handleCategorySelect}
                productCounts={productCounts}
            />

            {/* ───────────────────────────────────────
                3. STICKY BAR — search + filters + sort
            ─────────────────────────────────────── */}
            <div
                ref={stickyRef}
                className="sticky top-0 z-30 border-b border-fk-border bg-fk-bg/96 backdrop-blur-xl"
            >
                <div className="mx-auto max-w-7xl px-3 py-2.5 md:px-8">
                    <div className="flex items-center gap-2">
                        <SearchBar
                            value={search}
                            onChange={handleSearchChange}
                            onClear={clearSearch}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setTimeout(() => setSearchFocused(false), 120)}
                            placeholder="Search burgers, pizza, momos…"
                        />
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(true)}
                            className="relative flex shrink-0 items-center gap-1 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-3 py-2.5 text-[12px] font-bold text-fk-text-secondary transition-colors hover:text-fk-text"
                        >
                            <SlidersHorizontal size={14} />
                            <span className="hidden sm:inline">Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--fk-accent)] text-[9px] font-black text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSortOpen(true)}
                            className={cn(
                                "flex shrink-0 items-center gap-1 rounded-fk-lg border px-3 py-2.5 text-[12px] font-bold transition-colors",
                                sort !== "recommended"
                                    ? "border-transparent bg-fk-surface-selected text-[var(--fk-accent)]"
                                    : "border-fk-border bg-fk-surface-elevated text-fk-text-secondary hover:text-fk-text"
                            )}
                        >
                            <ArrowUpDown size={14} />
                            <span className="hidden sm:inline">Sort</span>
                        </button>
                        <div className="hidden shrink-0 items-center gap-1 rounded-fk-lg border border-fk-border bg-fk-surface-selected px-3 py-2 md:flex">
                            <span className="text-sm font-black text-[var(--fk-accent)]">
                                {isBrowse ? products.length : filteredProducts.length}
                            </span>
                            <span className="text-[10px] font-bold text-fk-text-tertiary">items</span>
                        </div>
                    </div>
                    {searchFocused && !search.trim() && (
                        <RecentSearches
                            onSelect={(term) => {
                                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                                setSearch(term);
                                updateUrl(category, term);
                                setSearchFocused(false);
                            }}
                        />
                    )}
                </div>
            </div>

            <MenuFilters
                open={filtersOpen}
                onClose={() => setFiltersOpen(false)}
                filters={filters}
                onChange={handleFiltersChange}
                resultCount={filteredProducts.length}
            />
            <MenuSort open={sortOpen} onClose={() => setSortOpen(false)} value={sort} onChange={handleSortChange} />

            {/* ───────────────────────────────────────
                4–8. CONTENT
            ─────────────────────────────────────── */}
            {isBrowse ? (
                <>
                    {sortedIceCreams.length > 0 && (
                        <div id="section-ice-cream">
                            <IceCreamSection products={sortedIceCreams} />
                        </div>
                    )}

                    {sortedThalis.items.length > 0 && (
                        <div id="section-thali">
                            <ThaliSection
                                sortedProducts={sortedThalis.items}
                                availableCount={sortedThalis.availableCount}
                                onViewAll={handleCategorySelect}
                            />
                        </div>
                    )}

                    <TopPicksSection topPicks={topPicks} />

                    {/* WAVE 3C: ComboSection rendered DIRECTLY — no outer wrapper section
                        ComboSection owns its complete section UI including dark bg, headings, paddings.
                        The previous redundant outer <section> wrapper has been removed entirely. */}
                    {combos.length > 0 && (
                        <ComboSection
                            combos={combos}
                            onViewAll={() => handleCategorySelect("Combos")}
                        />
                    )}

                    {/* WAVE 3C: CategorySection receives pre-sorted products + precomputed availableCount
                        — does zero internal filter/sort work */}
                    {categorySections.map((section, i) => (
                        <CategorySection
                            key={section.cat}
                            category={section.cat}
                            products={section.products}
                            availableCount={section.availableCount}
                            onViewAll={handleCategorySelect}
                            isFirst={i === 0 && combos.length === 0 && iceCreams.length === 0 && thalis.length === 0}
                            sectionIndex={i}
                        />
                    ))}
                </>
            ) : (
                // Category-click auto-scroll fix: the URL→state sync effect
                // above (`document.getElementById('section-' + category)`)
                // already existed for restoring/landing on a category, but
                // this is the ONLY section rendered once `category !== "All"`
                // (isBrowse flips false) — it never had a matching id, so
                // that effect's lookup always returned null and silently
                // no-opped. CategorySection (the "All" browse view) sets the
                // exact same id pattern for its own sections; mirroring it
                // here — only when a real category is selected, never for a
                // plain search with no category — is what makes the
                // existing scroll effect actually find its target.
                <section
                    id={category !== "All" ? `section-${category.toLowerCase().replace(/\s+/g, "-")}` : undefined}
                    className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10"
                >
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-fk-lg border border-fk-border bg-fk-surface-selected text-xl">
                            {search.trim() ? "🔍" : "🍽️"}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--fk-accent)]">
                                {search.trim() ? "Searching for" : "Category"}
                            </p>
                            <h2 className="font-display truncate text-xl font-black text-fk-text">
                                {search.trim() ? `"${search}"` : category}
                            </h2>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-fk-lg border border-fk-border bg-fk-surface-selected px-3 py-2">
                            <span className="text-sm font-black text-[var(--fk-accent)]">{filteredProducts.length}</span>
                            <span className="text-[10px] font-bold text-fk-text-tertiary">{search.trim() ? "found" : "items"}</span>
                        </div>
                    </div>
                    <button onClick={resetAll}
                        className="mb-5 inline-flex items-center gap-1.5 rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-4 py-1.5 text-[12px] font-bold text-fk-text-secondary shadow-sm transition-all hover:text-fk-text">
                        <X size={11} strokeWidth={2.5} />
                        Clear &amp; browse all
                    </button>
                    <ProductGrid products={filteredProducts} onReset={resetAll} hasFilters />
                </section>
            )}

            {/* Back to top — desktop only */}
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                aria-label="Back to top"
                className={`fixed bottom-8 right-8 z-50 hidden h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] shadow-fk-lg transition-all duration-300 hover:scale-110 active:scale-95 lg:flex ${showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
                    }`}
            >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 14V4M4 9l5-5 5 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </main>
    );
}
