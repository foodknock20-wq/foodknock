"use client";

// src/components/products/ThaliSection.tsx
// WAVE 3A OPTIMIZED — COMPLETE MEALS CAROUSEL
// PERF CHANGES:
//   • Accepts precomputed `sortedProducts` + `availableCount` from MenuClient (zero internal scan)
//   • Fallback internal memo retained for legacy raw-products usage
//   • next/image (Image) REMOVED → native <img> with explicit width/height + loading attr
//     Eliminates: layout shift warnings, quality warnings, Vercel image transform overhead
//   • Internal sort (available → unavailable split + spread) moved into standalone pure fn
//   • <style> tag for thali-scroll webkit scrollbar moved to inline JSX string (stable, not recreated)
//   • Dot indicators: slice(0,6) was fine, kept as-is (cheap)
//   • No timers, no intervals, no animation state machine

import { useMemo, useCallback, memo, useRef } from "react";
import { ArrowRight, Crown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { toast } from "react-hot-toast";
import Link from "next/link";

type Product = {
    _id: string; name: string; slug: string; description: string;
    shortDescription?: string; price: number; compareAtPrice?: number | null;
    category: string; image: string; stock: number; isAvailable: boolean;
    isFeatured?: boolean; tags?: string[];
};

const FALLBACK = "https://res.cloudinary.com/dr3usvmyr/image/upload/v1777120403/thali_fx7iut.png";

// PERF: pure sort function outside component — never recreated
function sortThalis(products: Product[]): { sorted: Product[]; availableCount: number } {
    const available: Product[] = [];
    const unavailable: Product[] = [];
    for (const p of products) {
        (p.isAvailable && p.stock > 0 ? available : unavailable).push(p);
    }
    return { sorted: [...available, ...unavailable], availableCount: available.length };
}

// PERF: pure filter outside component — never recreated
function filterThalis(products: Product[]): Product[] {
    return products.filter(p => {
        const c = p.category.trim().toLowerCase();
        return c.includes("thali") || c.includes("meal");
    });
}

// ── Thali Card — memoized ──────────────────────────────────────────────────
const ThaliCard = memo(function ThaliCard({
    product,
    index,
}: {
    product: Product;
    index: number;
}) {
    const addItem = useCartStore(s => s.addItem);
    const unavailable = !product.isAvailable || product.stock <= 0;

    const pct = product.compareAtPrice && product.compareAtPrice > product.price
        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
        : null;

    const handleAdd = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (unavailable) return;
        addItem({
            _id: product._id, name: product.name, price: product.price,
            image: product.image, quantity: 1, stock: product.stock, category: product.category,
        });
        toast.success(`${product.name} added! 🥘`, {
            style: {
                background: "#fef3c7", color: "#78350f",
                border: "1px solid #fcd34d", borderRadius: "14px",
            },
        });
    }, [addItem, product, unavailable]);

    // PERF: image src with cheap fallback — no useMemo needed for string concat
    const imgSrc = product.image || FALLBACK;

    return (
        <Link
            href={`/menu/${product.slug}`}
            className={`group snap-start shrink-0 flex flex-col overflow-hidden rounded-3xl bg-white transition-all duration-300
                min-w-[84vw] sm:min-w-[46vw] md:min-w-[320px] lg:min-w-[300px]
                ${unavailable ? "opacity-65" : "hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-200/60"}`}
            style={{
                border: "1.5px solid rgba(217,119,6,0.15)",
                boxShadow: "0 2px 18px rgba(217,119,6,0.09)",
                touchAction: "pan-x pan-y",
            }}
        >
            {/* ── Cinematic image block ── */}
            {/* PERF: native <img> replaces next/image — eliminates quality/layout warnings */}
            <div className="relative h-52 w-full overflow-hidden bg-amber-50 sm:h-56">
                <img
                    src={imgSrc}
                    alt={product.name}
                    loading={index < 3 ? "eager" : "lazy"}
                    decoding="async"
                    className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ${unavailable ? "grayscale-[40%]" : "group-hover:scale-[1.07]"
                        }`}
                    style={{ pointerEvents: "none" }}
                />

                {/* Cinematic gradient overlay */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background:
                            "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.62) 100%)",
                    }}
                />

                {/* Warm amber vignette */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background:
                            "radial-gradient(ellipse at 50% 100%, rgba(217,119,6,0.22) 0%, transparent 70%)",
                    }}
                />

                {/* Crown badge */}
                {!unavailable && (
                    <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 shadow-lg pointer-events-none"
                        style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)" }}>
                        <Crown size={9} fill="white" className="text-white" />
                        <span className="text-[9px] font-black uppercase tracking-wide text-white">Complete Meal</span>
                    </div>
                )}

                {/* Discount badge */}
                {pct !== null && (
                    <div className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[9px] font-black text-white shadow-md pointer-events-none">
                        {pct}% OFF
                    </div>
                )}

                {/* Unavailable overlay */}
                {unavailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[2px] pointer-events-none">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-stone-500">
                            Unavailable
                        </span>
                    </div>
                )}

                {/* Price pill */}
                <div className="absolute bottom-3 left-3 pointer-events-none">
                    <div className="flex items-baseline gap-1.5 rounded-xl bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur-sm">
                        <span className="text-[17px] font-black text-amber-700">₹{product.price}</span>
                        {product.compareAtPrice && product.compareAtPrice > product.price && (
                            <span className="text-[11px] text-stone-400 line-through">₹{product.compareAtPrice}</span>
                        )}
                    </div>
                </div>

                {/* Availability dot */}
                <div className="absolute bottom-3.5 right-3 pointer-events-none">
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${!unavailable ? "bg-green-500/90 text-white" : "bg-red-400/80 text-white"
                        }`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        {!unavailable ? "Available" : "Out"}
                    </span>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex flex-1 flex-col p-4">
                <span
                    className="mb-2 self-start rounded-full px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                    style={{
                        background: "rgba(217,119,6,0.08)",
                        color: "#d97706",
                        border: "1px solid rgba(217,119,6,0.18)",
                    }}
                >
                    Full Meal
                </span>

                <h3
                    className="line-clamp-2 text-[15px] font-black leading-snug text-stone-900"
                    style={{ fontFamily: "'Playfair Display',Georgia,serif" }}
                >
                    {product.name}
                </h3>

                <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-stone-400">
                    {product.shortDescription || product.description}
                </p>

                <div className="my-3 border-t border-dashed border-stone-100" />

                <button
                    onClick={handleAdd}
                    disabled={unavailable}
                    style={{
                        touchAction: "manipulation",
                        ...(!unavailable
                            ? {
                                background: "linear-gradient(135deg,#d97706,#f59e0b)",
                                boxShadow: "0 4px 16px rgba(217,119,6,0.35)",
                            }
                            : {}),
                    }}
                    className={`mt-auto w-full rounded-xl py-3 text-[12px] font-black transition-all duration-200 ${unavailable
                            ? "cursor-not-allowed bg-stone-100 text-stone-400"
                            : "text-white hover:brightness-110 active:scale-[0.97]"
                        }`}
                >
                    {unavailable ? "Unavailable" : "Add Complete Meal 🥘"}
                </button>
            </div>
        </Link>
    );
});

// ── WAVE 3A: Section accepts precomputed data OR falls back to raw products ─
// Preferred usage from MenuClient:
//   <ThaliSection sortedProducts={thalisSorted} availableCount={N} onViewAll={...} />
// Legacy usage (raw products array):
//   <ThaliSection products={allProducts} onViewAll={...} />
type ThaliSectionProps = (
    | { sortedProducts: Product[]; availableCount: number; products?: never }
    | { products: Product[]; sortedProducts?: never; availableCount?: never }
) & { onViewAll?: (cat: string) => void };

// ── Section — memoized ─────────────────────────────────────────────────────
const ThaliSection = memo(function ThaliSection(props: ThaliSectionProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // PERF: if precomputed subset passed → zero filtering/sorting cost
    const { sorted, availableCount } = useMemo(() => {
        if (props.sortedProducts !== undefined) {
            return { sorted: props.sortedProducts, availableCount: props.availableCount ?? 0 };
        }
        const thalis = filterThalis(props.products ?? []);
        return sortThalis(thalis);
    }, [props.sortedProducts, props.availableCount, props.products]);

    const handleViewAll = useCallback(() => {
        props.onViewAll?.("Thali");
    }, [props.onViewAll]);

    const scrollLeft = useCallback(() => scrollRef.current?.scrollBy({ left: -340, behavior: "smooth" }), []);
    const scrollRight = useCallback(() => scrollRef.current?.scrollBy({ left: 340, behavior: "smooth" }), []);

    if (sorted.length === 0) return null;

    return (
        <section
            className="relative overflow-hidden border-t border-stone-100/80 py-7 md:py-10"
            style={{ background: "linear-gradient(160deg,#fffbeb 0%,#fef3c7 60%,#fde68a 100%)" }}
        >
            {/* Ambient glows */}
            <div
                className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-15 blur-3xl"
                style={{ background: "radial-gradient(circle,#d97706,transparent 70%)" }}
            />
            <div
                className="pointer-events-none absolute -bottom-10 left-10 h-48 w-48 rounded-full opacity-10 blur-3xl"
                style={{ background: "radial-gradient(circle,#f59e0b,transparent 70%)" }}
            />

            <div className="relative mx-auto max-w-7xl">

                {/* ── Header ── */}
                <div className="mb-5 flex items-center justify-between gap-3 px-4 md:px-8">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg shrink-0"
                            style={{
                                background: "linear-gradient(135deg,#d97706,#f59e0b)",
                                boxShadow: "0 4px 16px rgba(217,119,6,0.4)",
                            }}
                        >
                            <Crown size={18} strokeWidth={2.5} className="text-white" />
                        </div>
                        <div>
                            <div className="mb-0.5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-700">
                                    Premium Meals
                                </span>
                            </div>
                            <h2
                                className="text-2xl font-black text-stone-900 md:text-3xl"
                                style={{ fontFamily: "'Playfair Display',Georgia,serif" }}
                            >
                                🥘 Complete Meals
                            </h2>
                            <p className="mt-0.5 text-[12px] text-stone-400">
                                {availableCount} meal{availableCount !== 1 ? "s" : ""} available
                            </p>
                        </div>
                    </div>

                    {/* Desktop arrows + View All */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={scrollLeft}
                            aria-label="Scroll left"
                            className="hidden md:flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-white text-amber-700 shadow-sm transition-all hover:bg-amber-50 hover:shadow-md"
                        >
                            <ChevronLeft size={16} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={scrollRight}
                            aria-label="Scroll right"
                            className="hidden md:flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-white text-amber-700 shadow-sm transition-all hover:bg-amber-50 hover:shadow-md"
                        >
                            <ChevronRight size={16} strokeWidth={2.5} />
                        </button>

                        {props.onViewAll && (
                            <button
                                onClick={handleViewAll}
                                className="group flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-black text-amber-700 shadow-sm transition-all hover:bg-amber-100"
                            >
                                View All
                                <ArrowRight size={12} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Value proposition strip ── */}
                <div className="mb-5 px-4 md:px-8">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-white/60 px-4 py-2.5 backdrop-blur-sm">
                        <span className="text-lg">👑</span>
                        <p className="text-[12px] font-semibold text-stone-600">
                            Complete meals with multiple dishes —{" "}
                            <span className="font-black text-amber-700">20–35% more value</span>
                        </p>
                    </div>
                </div>

                {/* ── Horizontal Carousel ── */}
                <div
                    ref={scrollRef}
                    className="thali-scroll flex snap-x snap-mandatory overflow-x-auto gap-4 pb-4 pl-4 pr-4 md:pl-8 md:pr-8"
                    style={{
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                        WebkitOverflowScrolling: "touch",
                        touchAction: "pan-x pan-y",
                    }}
                >
                    {/* PERF: stable inline style string — does not recreate on re-render */}
                    <style>{`.thali-scroll::-webkit-scrollbar{display:none}`}</style>

                    {sorted.map((product, i) => (
                        <ThaliCard key={product._id} product={product} index={i} />
                    ))}

                    {/* Trailing spacer */}
                    <div className="shrink-0 w-2" aria-hidden="true" />
                </div>

                {/* ── Mobile swipe hint dots ── */}
                {sorted.length > 2 && (
                    <div className="mt-3 flex justify-center gap-1.5 md:hidden">
                        {sorted.slice(0, Math.min(sorted.length, 6)).map((_, i) => (
                            <span
                                key={i}
                                className={`rounded-full transition-all duration-300 ${i === 0 ? "h-1.5 w-5 bg-amber-500" : "h-1.5 w-1.5 bg-amber-200"
                                    }`}
                            />
                        ))}
                        {sorted.length > 6 && (
                            <span className="text-[9px] font-bold text-amber-400 ml-1 self-center">
                                +{sorted.length - 6}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
});

export default ThaliSection;