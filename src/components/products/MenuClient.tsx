"use client";

// src/components/products/MenuClient.tsx
// WAVE 3C FINAL — SURGICAL CLEANUP
// CHANGES vs WAVE 3B:
//   • ComboSection rendered DIRECTLY — outer redundant combo wrapper removed
//   • productCounts built in the SAME single-pass scan as iceCreams/thalis/combos/categoryMap
//   • CategorySection receives `products` (pre-sorted) + `availableCount` — does ZERO internal sort/filter
//   • No per-render style tag injections (style jsx global moved to module-level or removed)
//   • All WAVE 3B improvements preserved

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ProductGrid from "./ProductGrid";
import ComboSection from "./ComboSection";
import TopPicksSection from "./TopPicksSection";
import CategorySlider from "./CategorySlider";
import CategorySection from "./CategorySection";
import IceCreamSection from "./IceCreamSection";
import ThaliSection from "./ThaliSection";
import { Search, X } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────
type Product = {
    _id: string; name: string; description: string; shortDescription?: string;
    price: number; compareAtPrice?: number | null; category: string; image: string;
    stock: number; isAvailable: boolean; isFeatured?: boolean; tags?: string[]; slug: string;
};

// ─── Category display order ─────────────────────────────────────────────────
const CATEGORY_ORDER = [
    "Combos", "Pizza", "Burger", "Sandwich", "Momos", "Pasta",
    "Noodles", "Maggi", "Chinese", "Pavbhaji", "Patties", "Fries",
    "Snacks", "Shake", "Juice", "Coffee", "Tea", "Ice Cream", "Thali",
];

const HERO_STATS = [
    { value: "900+", label: "Happy Orders", color: "#f97316" },
    { value: "4.9★", label: "Avg Rating", color: "#d97706" },
    { value: "40 min", label: "Avg Delivery", color: "#16a34a" },
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

    const stickyRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();

    useEffect(() => {
        const cat = searchParams.get("category");
        if (!cat) return;
        const normalized = cat.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        setCategory(normalized);
        setSearch("");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const sectionId = `section-${normalized.toLowerCase().replace(/\s+/g, "-")}`;
                const el = document.getElementById(sectionId);
                if (el) {
                    const top = el.getBoundingClientRect().top + window.scrollY - 80;
                    window.scrollTo({ top, behavior: "smooth" });
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

    const filteredProducts = useMemo(() => {
        let list = [...products];
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
        const av = list.filter(p => p.isAvailable && p.stock > 0);
        const un = list.filter(p => !p.isAvailable || p.stock <= 0);
        const sorted = [...av, ...un];
        if (category !== "All" && !["combos", "ice cream", "thali"].includes(category.toLowerCase()))
            return sorted.filter(p => !["combos", "ice cream", "thali"].includes(normalize(p.category).toLowerCase()));
        return sorted;
    }, [products, category, search]);

    const isBrowse = useMemo(
        () => !search.trim() && category === "All",
        [search, category]
    );

    const handleCategorySelect = useCallback((cat: string) => {
        setCategory(cat);
        setSearch("");
        requestAnimationFrame(() => {
            stickyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }, []);

    const resetAll = useCallback(() => { setSearch(""); setCategory("All"); }, []);
    const clearSearch = useCallback(() => setSearch(""), []);
    const handleSearchChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), []
    );

    return (
        <main className="min-h-screen" style={{ background: "#FFFBF5" }}>

            {/* ───────────────────────────────────────
                1. HERO
            ─────────────────────────────────────── */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0"
                    style={{ background: "linear-gradient(160deg,#fff8f0 0%,#fff3e0 55%,#fffbf5 100%)" }} />
                <div className="pointer-events-none absolute inset-0 opacity-[0.032]"
                    style={{ backgroundImage: "radial-gradient(circle,#92400e 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
                <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-20 blur-3xl"
                    style={{ background: "radial-gradient(circle,#f97316,transparent 70%)" }} />
                <div className="pointer-events-none absolute -bottom-10 left-0 h-48 w-48 rounded-full opacity-10 blur-3xl"
                    style={{ background: "radial-gradient(circle,#ef4444,transparent 70%)" }} />

                <div className="relative mx-auto max-w-7xl px-4 pb-7 pt-8 md:px-8 md:pb-10 md:pt-14">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-white/80 px-3.5 py-1.5 shadow-sm backdrop-blur-sm">
                        <span className="flex h-2 w-2 animate-pulse rounded-full bg-orange-500"
                            style={{ boxShadow: "0 0 8px rgba(249,115,22,0.8)" }} />
                        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
                            FoodKnock · Live Menu
                        </span>
                    </div>

                    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                        <div className="max-w-lg">
                            <h1
                                className="text-[2.2rem] font-black leading-[1.06] tracking-tight text-stone-900 md:text-5xl lg:text-6xl"
                                style={{ fontFamily: "'Playfair Display',Georgia,serif" }}>
                                <span style={{
                                    background: "linear-gradient(135deg,#ea580c 0%,#f97316 45%,#dc2626 100%)",
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                }}>
                                    Hot &amp; Fresh,
                                </span>
                                <br />
                                <span className="text-stone-900">Every Craving.</span>
                            </h1>
                            <p className="mt-2.5 text-[13px] leading-relaxed text-stone-500 md:text-[15px]">
                                Burgers, pizza, momos, shakes &amp; more — cooked fresh the moment you order. 🔥
                            </p>
                            <div className="mt-3.5 flex flex-wrap gap-1.5">
                                {[
                                    { icon: "🔥", label: "Made Fresh", cls: "bg-orange-50 border-orange-200 text-orange-700" },
                                    { icon: "⚡", label: "Fast Delivery", cls: "bg-amber-50  border-amber-200  text-amber-700" },
                                    { icon: "🌿", label: "Fresh Ingredients", cls: "bg-green-50  border-green-200  text-green-700" },
                                    { icon: "⭐", label: "4.9★ Rated", cls: "bg-yellow-50 border-yellow-200 text-yellow-700" },
                                ].map(b => (
                                    <span key={b.label} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${b.cls}`}>
                                        {b.icon} {b.label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Stats — desktop */}
                        <div className="hidden shrink-0 overflow-hidden rounded-3xl border border-orange-100 bg-white/70 p-5 shadow-lg shadow-orange-100/50 backdrop-blur-sm md:block">
                            <div className="flex gap-7">
                                {HERO_STATS.map(s => (
                                    <div key={s.label} className="text-center">
                                        <p className="text-2xl font-black"
                                            style={{ color: s.color, fontFamily: "'Playfair Display',Georgia,serif" }}>
                                            {s.value}
                                        </p>
                                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Stats strip — mobile */}
                    <div className="mt-4 flex justify-between rounded-2xl border border-orange-100 bg-white/60 px-4 py-3 backdrop-blur-sm md:hidden">
                        {HERO_STATS.map((s, i) => (
                            <div key={s.label} className={`flex-1 text-center ${i !== HERO_STATS.length - 1 ? "border-r border-stone-100" : ""}`}>
                                <p className="text-base font-black" style={{ color: s.color }}>{s.value}</p>
                                <p className="text-[9.5px] font-bold text-stone-400">{s.label}</p>
                            </div>
                        ))}
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
                3. STICKY BAR — search only
            ─────────────────────────────────────── */}
            <div
                ref={stickyRef}
                className="sticky top-0 z-30 border-b border-stone-100/80"
                style={{
                    background: "rgba(255,251,245,0.96)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    boxShadow: "0 1px 16px rgba(249,115,22,0.06)",
                }}>
                <div className="mx-auto max-w-7xl px-3 py-2.5 md:px-8">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search size={14} strokeWidth={2.5}
                                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={handleSearchChange}
                                placeholder="Search burgers, pizza, momos…"
                                className="w-full rounded-2xl border border-stone-200 bg-white py-2.5 pl-9 pr-8 text-[13px] text-stone-700 placeholder:text-stone-400 shadow-sm transition-all focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                            />
                            {search && (
                                <button onClick={clearSearch}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-stone-100 p-0.5 text-stone-400 transition-colors hover:bg-orange-100 hover:text-orange-500">
                                    <X size={12} strokeWidth={3} />
                                </button>
                            )}
                        </div>
                        <div className="hidden shrink-0 items-center gap-1 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 md:flex">
                            <span className="text-sm font-black text-orange-600">
                                {isBrowse ? products.length : filteredProducts.length}
                            </span>
                            <span className="text-[10px] font-bold text-stone-400">items</span>
                        </div>
                    </div>
                </div>
            </div>

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
                                products={sortedThalis.items}
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
                <section className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10">
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-xl">
                            {search.trim() ? "🔍" : "🍽️"}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">
                                {search.trim() ? "Search Results" : "Category"}
                            </p>
                            <h2 className="truncate text-xl font-black text-stone-900"
                                style={{ fontFamily: "'Playfair Display',Georgia,serif" }}>
                                {search.trim() ? `"${search}"` : category}
                            </h2>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2">
                            <span className="text-sm font-black text-orange-600">{filteredProducts.length}</span>
                            <span className="text-[10px] font-bold text-stone-400">{search.trim() ? "found" : "items"}</span>
                        </div>
                    </div>
                    <button onClick={resetAll}
                        className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-1.5 text-[12px] font-bold text-stone-500 shadow-sm transition-all hover:border-orange-300 hover:text-orange-600">
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
                className={`fixed bottom-8 right-8 z-50 hidden h-11 w-11 items-center justify-center rounded-full shadow-xl shadow-orange-300/40 transition-all duration-300 hover:scale-110 active:scale-95 lg:flex ${showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
                    }`}
                style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}
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