"use client";

// src/components/products/CategorySection.tsx
// WAVE 3C FINAL — TRUE PURE RENDERER
// CHANGES vs WAVE 3B:
//   • Accepts `availableCount` as prop — no internal products.filter for count
//   • `sorted` useMemo removed — `products` prop is already available-first sorted by MenuClient
//   • `scrollLeft/scrollRight` useCallback preserved
//   • Per-mount style jsx global block REMOVED — animation moved to module-level CSS constant
//   • All WAVE 3B improvements preserved (native img, cdnImage, React.memo, useCallback)
// NEW FEATURE: section wraps with id="section-{category-slug}" for smart URL navigation

import { useRef, useCallback, memo } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { cdnImage } from "@/lib/cdnImage";

type Product = {
    _id: string; name: string; slug: string; description: string;
    shortDescription?: string; price: number; compareAtPrice?: number | null;
    category: string; image: string; stock: number; isAvailable: boolean;
    isFeatured?: boolean; tags?: string[];
};

const CAT_META: Record<string, { emoji: string; accent: string; bg: string }> = {
    combos: { emoji: "🎁", accent: "#e11d48", bg: "from-rose-50 to-white" },
    pizza: { emoji: "🍕", accent: "#f97316", bg: "from-orange-50 to-white" },
    burger: { emoji: "🍔", accent: "#d97706", bg: "from-amber-50 to-white" },
    sandwich: { emoji: "🥪", accent: "#16a34a", bg: "from-green-50 to-white" },
    coffee: { emoji: "☕", accent: "#9333ea", bg: "from-purple-50 to-white" },
    juice: { emoji: "🧃", accent: "#16a34a", bg: "from-green-50 to-white" },
    shake: { emoji: "🥤", accent: "#2563eb", bg: "from-blue-50 to-white" },
    "ice cream": { emoji: "🍦", accent: "#a855f7", bg: "from-fuchsia-50 to-white" },
    momos: { emoji: "🥟", accent: "#ea580c", bg: "from-orange-50 to-white" },
    fries: { emoji: "🍟", accent: "#ca8a04", bg: "from-yellow-50 to-white" },
    pasta: { emoji: "🍝", accent: "#ea580c", bg: "from-orange-50 to-white" },
    noodles: { emoji: "🍜", accent: "#d97706", bg: "from-amber-50 to-white" },
    maggi: { emoji: "🍜", accent: "#d97706", bg: "from-amber-50 to-white" },
    tea: { emoji: "🍵", accent: "#16a34a", bg: "from-green-50 to-white" },
    snacks: { emoji: "🍿", accent: "#f97316", bg: "from-orange-50 to-white" },
    chinese: { emoji: "🥡", accent: "#e11d48", bg: "from-rose-50 to-white" },
    pavbhaji: { emoji: "🍛", accent: "#ea580c", bg: "from-orange-50 to-white" },
    patties: { emoji: "🥙", accent: "#16a34a", bg: "from-green-50 to-white" },
};

const getMeta = (cat: string) =>
    CAT_META[cat.toLowerCase()] ?? { emoji: "🍽️", accent: "#f97316", bg: "from-orange-50 to-white" };

const FALLBACK = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=75&auto=format&fit=crop";

// WAVE 3C: module-level constant — allocated once, never recreated on render
const CAT_SECTION_CSS = `
.fk-cat-section { animation: fkCatIn 0.5s ease both; }
@keyframes fkCatIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
}`;

// ── Mini product card — memoized ───────────────────────────────────────────────
const SectionCard = memo(function SectionCard({
    product, sectionIndex, cardIndex,
}: {
    product: Product; sectionIndex: number; cardIndex: number;
}) {
    const addItem = useCartStore(s => s.addItem);
    const unavailable = !product.isAvailable || product.stock <= 0;
    const meta = getMeta(product.category);

    const pct = product.compareAtPrice && product.compareAtPrice > product.price
        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
        : null;

    // PERF: cdnImage at 200px for category section cards
    const imgSrc = cdnImage(product.image || FALLBACK, 200);

    const handleAdd = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (unavailable) return;
        addItem({
            _id: product._id, name: product.name, price: product.price,
            image: product.image, quantity: 1, stock: product.stock, category: product.category,
        });
        toast.success(`${product.name} added! 🛒`, {
            style: { background: "#fff7ed", color: "#7c2d12", border: "1px solid #fed7aa", borderRadius: "14px" },
        });
    }, [addItem, product, unavailable]);

    return (
        <Link
            href={`/menu/${product.slug}`}
            className={`group flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 ${unavailable
                ? "opacity-65"
                : "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-100/60"
                }`}
            style={{
                border: "1px solid rgba(0,0,0,0.07)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                touchAction: "auto",
            }}>

            {/* Image — PERF: native img + cdnImage */}
            <div className="relative h-32 w-full overflow-hidden bg-stone-100 sm:h-36 md:h-40">
                <img
                    src={imgSrc}
                    alt={product.name}
                    loading={sectionIndex === 0 && cardIndex < 4 ? "eager" : "lazy"}
                    className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${unavailable ? "grayscale-[45%]" : "group-hover:scale-[1.07]"
                        }`}
                    style={{ pointerEvents: "none" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-transparent pointer-events-none" />

                {unavailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-[2px] pointer-events-none">
                        <span className="rounded-full border border-stone-300 bg-white/90 px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-widest text-stone-500 shadow-sm">
                            Unavailable
                        </span>
                    </div>
                )}

                {pct !== null && !unavailable && (
                    <div className="absolute right-2 top-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm pointer-events-none">
                        {pct}% OFF
                    </div>
                )}

                {/* Mobile price pill */}
                <div className="absolute bottom-2 right-2 sm:hidden pointer-events-none">
                    <span className="rounded-xl bg-white/95 px-2 py-0.5 text-[12px] font-black shadow backdrop-blur-sm"
                        style={{ color: meta.accent }}>
                        ₹{product.price}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col p-2.5 sm:p-3">
                <h3
                    className="line-clamp-2 text-[12.5px] font-black leading-snug text-stone-900 sm:text-[13px]"
                    style={{ fontFamily: "'Playfair Display',Georgia,serif" }}>
                    {product.name}
                </h3>

                {/* Desktop price */}
                <div className="mt-1 hidden items-baseline gap-1.5 sm:flex">
                    <span className="text-[14px] font-black" style={{ color: meta.accent }}>
                        ₹{product.price}
                    </span>
                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <span className="text-[10px] text-stone-400 line-through">
                            ₹{product.compareAtPrice}
                        </span>
                    )}
                </div>

                <button
                    onClick={handleAdd}
                    disabled={unavailable}
                    style={{
                        touchAction: "auto",
                        ...(!unavailable ? {
                            background: `linear-gradient(135deg,${meta.accent},${meta.accent}cc)`,
                            boxShadow: `0 3px 12px ${meta.accent}35`,
                        } : {}),
                    }}
                    className={`mt-auto flex w-full items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-black transition-all duration-200 sm:mt-2 sm:gap-1.5 sm:text-[12px] ${unavailable
                        ? "cursor-not-allowed bg-stone-100 text-stone-400"
                        : "text-white active:scale-95 hover:brightness-110"
                        }`}>
                    {unavailable ? "Sold Out" : "+ Add"}
                </button>
            </div>
        </Link>
    );
});

// ── Main section — memoized ────────────────────────────────────────────────────
// WAVE 3C: pure renderer
//   • `products` prop is ALREADY available-first sorted by MenuClient — render directly
//   • `availableCount` prop passed from MenuClient — no internal products.filter
//   • No useMemo for sorted arrays — unnecessary, products is already final
interface Props {
    category: string;
    products: Product[];          // pre-sorted: available first, then unavailable
    availableCount: number;       // precomputed by MenuClient
    onViewAll: (cat: string) => void;
    isFirst?: boolean;
    sectionIndex?: number;
}

const CategorySection = memo(function CategorySection({
    category, products, availableCount, onViewAll, isFirst = false, sectionIndex = 0,
}: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const meta = getMeta(category);

    const scrollLeft = useCallback(() =>
        scrollRef.current?.scrollBy({ left: -280, behavior: "smooth" }), []);
    const scrollRight = useCallback(() =>
        scrollRef.current?.scrollBy({ left: 280, behavior: "smooth" }), []);

    const handleViewAll = useCallback(() => onViewAll(category), [onViewAll, category]);

    if (products.length === 0) return null;

    const sectionId = `section-${category.toLowerCase().replace(/\s+/g, "-")}`;

    return (
        <section
            id={sectionId}
            className={`fk-cat-section relative py-6 md:py-8 ${isFirst ? "" : "border-t border-stone-100/80"}`}>
            {/* Subtle bg tint */}
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${meta.bg} opacity-40`} />

            <div className="relative mx-auto max-w-7xl px-4 md:px-8">

                {/* Header */}
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
                            style={{
                                background: `linear-gradient(135deg,${meta.accent}15,${meta.accent}08)`,
                                border: `1.5px solid ${meta.accent}25`,
                            }}>
                            {meta.emoji}
                        </div>
                        <div>
                            <h2
                                className="text-lg font-black text-stone-900 md:text-xl"
                                style={{ fontFamily: "'Playfair Display',Georgia,serif" }}>
                                {category}
                            </h2>
                            <p className="text-[11px] text-stone-400">
                                {availableCount} item{availableCount !== 1 ? "s" : ""} available
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="hidden items-center gap-1.5 md:flex">
                            <button onClick={scrollLeft}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm transition-all hover:border-orange-300 hover:text-orange-500">
                                <ChevronLeft size={13} strokeWidth={2.5} />
                            </button>
                            <button onClick={scrollRight}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm transition-all hover:border-orange-300 hover:text-orange-500">
                                <ChevronRight size={13} strokeWidth={2.5} />
                            </button>
                        </div>
                        {products.length > 4 && (
                            <button
                                onClick={handleViewAll}
                                className="group flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-black transition-all hover:shadow-sm"
                                style={{
                                    borderColor: `${meta.accent}30`,
                                    background: `${meta.accent}08`,
                                    color: meta.accent,
                                }}>
                                See all
                                <ArrowRight size={11} strokeWidth={2.5}
                                    className="transition-transform group-hover:translate-x-0.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile: horizontal snap scroll */}
                <div className="md:hidden">
                    <div
                        ref={scrollRef}
                        className="no-scrollbar flex gap-3 overflow-x-auto pb-2"
                        style={{
                            scrollSnapType: "x mandatory",
                            touchAction: "pan-x pan-y",
                            WebkitOverflowScrolling: "touch",
                        }}>
                        {products.map((product, i) => (
                            <div
                                key={product._id}
                                className="shrink-0 snap-start"
                                style={{ width: 160, touchAction: "pan-x pan-y" }}>
                                <SectionCard product={product} sectionIndex={sectionIndex} cardIndex={i} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Desktop: grid (max 10 per section) */}
                <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {products.slice(0, 10).map((product, i) => (
                        <SectionCard key={product._id} product={product} sectionIndex={sectionIndex} cardIndex={i} />
                    ))}
                </div>

                {/* Desktop see more */}
                {products.length > 10 && (
                    <div className="mt-4 hidden justify-center md:flex">
                        <button
                            onClick={handleViewAll}
                            className="group flex items-center gap-2 rounded-full border px-5 py-2.5 text-[12px] font-black transition-all hover:shadow-md"
                            style={{
                                borderColor: `${meta.accent}35`,
                                background: `${meta.accent}06`,
                                color: meta.accent,
                            }}>
                            View all {products.length} {category} items
                            <ArrowRight size={13} strokeWidth={2.5}
                                className="transition-transform group-hover:translate-x-0.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* WAVE 3C: module-level CSS constant — injected once, not recreated per render */}
            <style>{CAT_SECTION_CSS}</style>
        </section>
    );
});

export default CategorySection;