"use client";

// src/components/products/MenuClient.tsx
// FoodKnock — Premium mobile-first menu experience
// Warm ember palette · Playfair Display headlines · buttery smooth interactions

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import ProductGrid  from "./ProductGrid";
import ComboSection from "./ComboSection";
import {
    Search, X, ChevronDown, Flame, Zap, Leaf, Star,
    IceCream, Coffee, Pizza, Sandwich, UtensilsCrossed,
    Gift, SlidersHorizontal, ChevronRight,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────
type Product = {
    _id:              string;
    name:             string;
    description:      string;
    shortDescription?: string;
    price:            number;
    compareAtPrice?:  number | null;
    category:         string;
    image:            string;
    stock:            number;
    isAvailable:      boolean;
    isFeatured?:      boolean;
    tags?:            string[];
    slug:             string;
};

// ─── Category icon map ─────────────────────────────────────────────────────
const ICONS: Record<string, React.ReactNode> = {
    all:         <UtensilsCrossed size={14} strokeWidth={2.5} />,
    combos:      <Gift            size={14} strokeWidth={2.5} />,
    pizza:       <Pizza           size={14} strokeWidth={2.5} />,
    burger:      "🍔",
    sandwich:    <Sandwich        size={14} strokeWidth={2.5} />,
    coffee:      <Coffee          size={14} strokeWidth={2.5} />,
    juice:       "🧃",
    shake:       "🥤",
    "ice cream": <IceCream        size={14} strokeWidth={2.5} />,
    momos:       "🥟",
    fries:       "🍟",
    pasta:       "🍝",
    noodles:     "🍜",
    maggi:       "🍜",
    tea:         "☕",
    snacks:      <Flame           size={14} strokeWidth={2.5} />,
    chinese:     "🥡",
    pavbhaji:    "🍛",
    patties:     "🥙",
};
const getIcon = (cat: string) => ICONS[cat.toLowerCase()] ?? "🍽️";

const SORT_OPTIONS = [
    { value: "featured",   label: "⭐ Featured"       },
    { value: "price_asc",  label: "Price: Low → High" },
    { value: "price_desc", label: "Price: High → Low" },
    { value: "name_asc",   label: "Name: A → Z"       },
    { value: "name_desc",  label: "Name: Z → A"       },
    { value: "available",  label: "Available First"    },
];

const normalize = (cat: string) => cat.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function sortCats(cats: string[]): string[] {
    const noAll  = cats.filter(c => c !== "All");
    const combos = noAll.filter(c => c.toLowerCase() === "combos");
    const rest   = noAll.filter(c => c.toLowerCase() !== "combos").sort();
    return ["All", ...combos, ...rest];
}

// ─── Hero stats ─────────────────────────────────────────────────────────────
const HERO_STATS = [
    { value: "900+",  label: "Happy Orders",     color: "text-orange-600" },
    { value: "4.9★",  label: "Average Rating",   color: "text-amber-600"  },
    { value: "15 min", label: "Avg Delivery",    color: "text-emerald-600" },
];

// ═══════════════════════════════════════════════════════════════════════════
export default function MenuClient({
    products,
    shopOpen = true,
}: {
    products: Product[];
    shopOpen?: boolean;
}) {
    const [search,   setSearch]   = useState("");
    const [category, setCategory] = useState("All");
    const [sort,     setSort]     = useState("featured");
    const [sortOpen, setSortOpen] = useState(false);
    const gridRef    = useRef<HTMLDivElement>(null);
    const catBarRef  = useRef<HTMLDivElement>(null);
    const activePillRef = useRef<HTMLButtonElement>(null);

    // scroll active pill into centre on category change
    useEffect(() => {
        const pill = activePillRef.current;
        const bar  = catBarRef.current;
        if (!pill || !bar) return;
        const pillLeft   = pill.offsetLeft;
        const pillWidth  = pill.offsetWidth;
        const barWidth   = bar.offsetWidth;
        bar.scrollTo({ left: pillLeft - barWidth / 2 + pillWidth / 2, behavior: "smooth" });
    }, [category]);

    // ── Derived data ──────────────────────────────────────────────────────
    const combos = useMemo(
        () => products.filter(p => normalize(p.category) === "Combos"),
        [products]
    );

    const categories = useMemo(() => {
        const unique = Array.from(new Set(products.map(p => normalize(p.category))));
        return sortCats(unique);
    }, [products]);

    const filtered = useMemo(() => {
        let list = [...products];
        if (category !== "All") list = list.filter(p => normalize(p.category) === category);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                (p.description || "").toLowerCase().includes(q)
            );
        }
        switch (sort) {
            case "price_asc":  list.sort((a,b) => a.price - b.price); break;
            case "price_desc": list.sort((a,b) => b.price - a.price); break;
            case "name_asc":   list.sort((a,b) => a.name.localeCompare(b.name)); break;
            case "name_desc":  list.sort((a,b) => b.name.localeCompare(a.name)); break;
            case "available":
                list.sort((a,b) => {
                    return (a.isAvailable && a.stock > 0 ? 0 : 1) - (b.isAvailable && b.stock > 0 ? 0 : 1);
                });
                break;
            default:
                list.sort((a,b) => {
                    const aOk = a.isAvailable && a.stock > 0 ? 0 : 1;
                    const bOk = b.isAvailable && b.stock > 0 ? 0 : 1;
                    return aOk - bOk || a.name.localeCompare(b.name);
                });
        }
        return list;
    }, [products, category, search, sort]);

    const gridProducts = useMemo(() =>
        category === "All" && !search.trim()
            ? filtered.filter(p => normalize(p.category) !== "Combos")
            : filtered,
        [filtered, category, search]
    );

    const showCombos = category === "All" && !search.trim() && combos.length > 0;
    const hasFilter  = search.trim() !== "" || category !== "All";
    const sortLabel  = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "Sort";

    const gotoCategory = useCallback((cat: string) => {
        setCategory(cat);
        setSearch("");
        setTimeout(() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }, []);

    const resetAll = useCallback(() => {
        setSearch(""); setCategory("All"); setSort("featured");
    }, []);

    return (
        <main className="min-h-screen" style={{ background: "#FFFBF5" }}>

            {/* ══════════════════════════════════════════
                HERO — mobile-first, editorial
            ══════════════════════════════════════════ */}
            <section className="relative overflow-hidden">
                {/* Background layers */}
                <div className="absolute inset-0" style={{
                    background: "linear-gradient(160deg,#fff8f0 0%,#fff3e0 50%,#fff9f4 100%)"
                }} />
                {/* Dot texture */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.035]"
                     style={{ backgroundImage:"radial-gradient(circle,#92400e 1px,transparent 1px)", backgroundSize:"22px 22px" }} />
                {/* Glow blobs */}
                <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-20 blur-3xl"
                     style={{ background:"radial-gradient(circle,#f97316,transparent 70%)" }} />
                <div className="pointer-events-none absolute -bottom-10 left-0 h-48 w-48 rounded-full opacity-10 blur-3xl"
                     style={{ background:"radial-gradient(circle,#ef4444,transparent 70%)" }} />

                <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-8 md:px-8 md:pb-10 md:pt-14">

                    {/* Eyebrow pill */}
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-white/80 px-3.5 py-1.5 shadow-sm backdrop-blur-sm">
                        <span className="flex h-2 w-2 animate-pulse rounded-full bg-orange-500"
                              style={{ boxShadow:"0 0 8px rgba(249,115,22,0.8)" }} />
                        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
                            FoodKnock • Live Menu
                        </span>
                    </div>

                    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                        <div className="max-w-lg">
                            {/* Main headline */}
                            <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif" }}
                                className="text-[2.15rem] font-black leading-[1.06] tracking-tight text-stone-900 md:text-5xl lg:text-6xl">
                                <span style={{
                                    background:"linear-gradient(135deg,#ea580c 0%,#f97316 45%,#dc2626 100%)",
                                    WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                                }}>
                                    Hot &amp; Fresh,
                                </span>
                                <br />
                                <span className="text-stone-900">Every Craving.</span>
                            </h1>

                            <p className="mt-2.5 text-[13px] leading-relaxed text-stone-500 md:text-[15px]">
                                Burgers, pizza, momos, shakes &amp; more — cooked fresh the second you order. 🔥
                            </p>

                            {/* Trust badges */}
                            <div className="mt-3.5 flex flex-wrap gap-1.5">
                                {[
                                    { icon:"🔥", label:"Made Fresh",        bg:"bg-orange-50  border-orange-200  text-orange-700" },
                                    { icon:"⚡", label:"Fast Delivery",     bg:"bg-amber-50   border-amber-200   text-amber-700"  },
                                    { icon:"🌿", label:"Fresh Ingredients", bg:"bg-green-50   border-green-200   text-green-700"  },
                                    { icon:"⭐", label:"4.9★ Rated",        bg:"bg-yellow-50  border-yellow-200  text-yellow-700" },
                                ].map(b => (
                                    <span key={b.label}
                                          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${b.bg}`}>
                                        <span>{b.icon}</span>{b.label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Stats card — desktop only */}
                        <div className="hidden shrink-0 overflow-hidden rounded-3xl border border-orange-100 bg-white/70 p-5 shadow-lg shadow-orange-100/50 backdrop-blur-sm md:block">
                            <div className="flex gap-6">
                                {HERO_STATS.map(s => (
                                    <div key={s.label} className="text-center">
                                        <p className={`text-2xl font-black ${s.color}`}
                                           style={{ fontFamily:"'Playfair Display',Georgia,serif" }}>
                                            {s.value}
                                        </p>
                                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                                            {s.label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Mobile stats strip */}
                    <div className="mt-4 flex justify-between rounded-2xl border border-orange-100 bg-white/60 px-4 py-3 backdrop-blur-sm md:hidden">
                        {HERO_STATS.map((s, i) => (
                            <div key={s.label} className={`flex-1 text-center ${i !== 2 ? "border-r border-stone-100" : ""}`}>
                                <p className={`text-base font-black ${s.color}`}>{s.value}</p>
                                <p className="text-[9.5px] font-bold text-stone-400">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════
                STICKY CONTROLS — redesigned for mobile
            ══════════════════════════════════════════ */}
            <div className="sticky top-0 z-30 border-b border-orange-100/60"
                 style={{ background:"rgba(255,251,245,0.97)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
                          boxShadow:"0 2px 20px rgba(249,115,22,0.08)" }}>
                <div className="mx-auto max-w-7xl px-3 py-2.5 md:px-8">

                    {/* ── Search + Sort row ── */}
                    <div className="flex items-center gap-2">
                        {/* Search bar */}
                        <div className="relative flex-1">
                            <Search size={14} strokeWidth={2.5}
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search burgers, pizza, juice…"
                                className="w-full rounded-2xl border border-stone-200 bg-white py-2.5 pl-9 pr-8 text-[13px] text-stone-700 placeholder:text-stone-400 transition-all focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                            />
                            {search && (
                                <button onClick={() => setSearch("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-stone-100 p-0.5 text-stone-400 transition-colors hover:bg-orange-100 hover:text-orange-500">
                                    <X size={12} strokeWidth={3} />
                                </button>
                            )}
                        </div>

                        {/* Sort dropdown */}
                        <div className="relative shrink-0">
                            <button onClick={() => setSortOpen(o => !o)}
                                    className="flex h-[38px] items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-3 text-[12px] font-semibold text-stone-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50">
                                <SlidersHorizontal size={13} strokeWidth={2.5} />
                                <span className="hidden sm:inline max-w-[70px] truncate">{sortLabel}</span>
                                <ChevronDown size={11} strokeWidth={3}
                                             className={`transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`} />
                            </button>
                            {sortOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                                    <div className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-2xl shadow-stone-200/60">
                                        {SORT_OPTIONS.map(opt => (
                                            <button key={opt.value}
                                                    onClick={() => { setSort(opt.value); setSortOpen(false); }}
                                                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] font-medium transition-colors ${
                                                        sort === opt.value
                                                            ? "bg-orange-50 font-bold text-orange-600"
                                                            : "text-stone-600 hover:bg-stone-50"
                                                    }`}>
                                                {opt.label}
                                                {sort === opt.value && (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Count pill — desktop */}
                        <div className="hidden shrink-0 items-center gap-1 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 md:flex">
                            <span className="text-sm font-black text-orange-600">{filtered.length}</span>
                            <span className="text-[10px] font-bold text-stone-400">items</span>
                        </div>
                    </div>

                    {/* ── Category pill slider ── */}
                    <div ref={catBarRef}
                         className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1 pt-0.5"
                         style={{ scrollSnapType:"x mandatory" }}>
                        {categories.map(cat => {
                            const active  = cat === category;
                            const isCombo = cat.toLowerCase() === "combos";
                            const icon    = getIcon(cat);
                            return (
                                <button
                                    key={cat}
                                    ref={active ? activePillRef : undefined}
                                    onClick={() => gotoCategory(cat)}
                                    style={{
                                        scrollSnapAlign: "center",
                                        ...(active ? {
                                            background: isCombo
                                                ? "linear-gradient(135deg,#dc2626,#ea580c)"
                                                : "linear-gradient(135deg,#ea580c,#f97316,#fb923c)",
                                            boxShadow: isCombo
                                                ? "0 3px 14px rgba(220,38,38,0.35)"
                                                : "0 3px 14px rgba(234,88,12,0.35)",
                                            color: "#fff",
                                            border: "1px solid transparent",
                                        } : {})
                                    }}
                                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-all duration-200 focus:outline-none
                                        ${active
                                            ? ""
                                            : isCombo
                                                ? "border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100"
                                                : "border-stone-200 bg-white text-stone-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                                        }`}
                                >
                                    <span className={`text-[14px] leading-none ${active ? "" : ""}`}>
                                        {icon}
                                    </span>
                                    <span>{cat}</span>
                                    {isCombo && !active && (
                                        <span className="rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-black leading-none text-white">
                                            HOT
                                        </span>
                                    )}
                                    {cat === "All" && !active && (
                                        <span className="rounded-full bg-orange-100 px-1.5 py-px text-[9px] font-black leading-none text-orange-600">
                                            {products.length}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                COMBOS SECTION — premium showcase
            ══════════════════════════════════════════ */}
            {showCombos && (
                <section className="relative overflow-hidden">
                    {/* Section background */}
                    <div className="absolute inset-0"
                         style={{ background:"linear-gradient(160deg,#fff1f2 0%,#fff7ed 40%,#fef3c7 100%)" }} />
                    <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
                         style={{ backgroundImage:"radial-gradient(circle,#b45309 1px,transparent 1px)", backgroundSize:"18px 18px" }} />
                    <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full opacity-10 blur-3xl"
                         style={{ background:"radial-gradient(circle,#f97316,transparent 70%)" }} />

                    <div className="relative mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10">

                        {/* Section header */}
                        <div className="mb-5 flex items-end justify-between gap-3">
                            <div>
                                {/* Eyebrow */}
                                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1 shadow-sm">
                                    <span className="text-[13px]">🔥</span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-600">
                                        Best Value
                                    </span>
                                </div>

                                {/* Headline */}
                                <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif" }}
                                    className="text-2xl font-black leading-tight text-stone-900 md:text-3xl lg:text-4xl">
                                    <span style={{
                                        background:"linear-gradient(135deg,#dc2626 0%,#ea580c 50%,#d97706 100%)",
                                        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                                    }}>
                                        FoodKnock
                                    </span>
                                    {" "}
                                    <span className="text-stone-900">Combos</span>
                                    <span className="ml-2 text-2xl">🤩</span>
                                </h2>
                                <p className="mt-1 text-[12.5px] text-stone-500">
                                    Handpicked bundles — more food, better value, serious savings.
                                </p>
                            </div>

                            {/* View all CTA */}
                            <button
                                onClick={() => gotoCategory("Combos")}
                                className="group flex shrink-0 items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3.5 py-2 text-[12px] font-black text-rose-600 shadow-sm transition-all hover:border-rose-300 hover:bg-rose-50">
                                View All
                                <ChevronRight size={13} strokeWidth={3}
                                              className="transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </div>

                        {/* Combo cards */}
                        <ComboSection combos={combos} onViewAll={() => gotoCategory("Combos")} />

                        {/* Savings callout — mobile */}
                        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 md:hidden">
                            <span className="text-2xl">💰</span>
                            <div>
                                <p className="text-[12px] font-black text-amber-800">Save more with combos!</p>
                                <p className="text-[11px] text-amber-600">Bundles are priced lower than ordering individually.</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ══════════════════════════════════════════
                PRODUCT GRID — full menu
            ══════════════════════════════════════════ */}
            <section ref={gridRef} className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10">

                {/* Section header */}
                {category === "All" && !search.trim() && gridProducts.length > 0 && (
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">
                                Complete Menu
                            </p>
                            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif" }}
                                className="text-xl font-black text-stone-900 md:text-2xl">
                                All Items
                            </h2>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2">
                            <span className="text-sm font-black text-orange-600">{gridProducts.length}</span>
                            <span className="text-[10px] font-bold text-stone-400">items</span>
                        </div>
                    </div>
                )}

                {/* Category heading when filtered */}
                {category !== "All" && (
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-xl">
                            {getIcon(category)}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">Category</p>
                            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif" }}
                                className="text-xl font-black text-stone-900">
                                {category}
                            </h2>
                        </div>
                        <div className="ml-auto flex items-center gap-1.5 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2">
                            <span className="text-sm font-black text-orange-600">{gridProducts.length}</span>
                            <span className="text-[10px] font-bold text-stone-400">items</span>
                        </div>
                    </div>
                )}

                {/* Search heading when searching */}
                {search.trim() && (
                    <div className="mb-5 flex items-center gap-3">
                        <Search size={18} className="shrink-0 text-orange-500" strokeWidth={2.5} />
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">Search Results</p>
                            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif" }}
                                className="truncate text-xl font-black text-stone-900">
                                "{search}"
                            </h2>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2">
                            <span className="text-sm font-black text-orange-600">{gridProducts.length}</span>
                            <span className="text-[10px] font-bold text-stone-400">found</span>
                        </div>
                    </div>
                )}

                <ProductGrid products={gridProducts} onReset={resetAll} hasFilters={hasFilter} />
            </section>

            {/* ── Global styles ── */}
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none }
            `}</style>
        </main>
    );
}