"use client";

// src/components/products/TopPicksSection.tsx
// WAVE 3A OPTIMIZED — TOP PICKS CAROUSEL
// PERF CHANGES:
//   • Accepts precomputed `topPicks` from MenuClient (zero internal tag/featured scan)
//   • Fallback internal memo retained for legacy raw-products usage
//   • isFeatured + tags scan moved into standalone pure function outside component
//   • Removed <style jsx global> — was injecting new CSS on every section mount
//     Replaced with a static className + a single <style> tag whose content is a module-level constant
//   • next/image REMOVED — native <img> with cdnImage() for Cloudinary-direct delivery
//     Zero Vercel image optimizer usage, zero hidden quota cost
//   • No timers, no intervals, no animation state
//   • TopPickCard: saving computed inline (cheap arithmetic, no memo)

import { useRef, useMemo, useCallback, memo } from "react";
import { useCartStore } from "@/store/cartStore";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight, Flame, ShoppingCart, Star } from "lucide-react";
import Link from "next/link";
import { cdnImage } from "@/lib/cdnImage";

type Product = {
    _id: string; name: string; slug: string; description: string;
    shortDescription?: string; price: number; compareAtPrice?: number | null;
    category: string; image: string; stock: number; isAvailable: boolean;
    isFeatured?: boolean; tags?: string[];
};

const FALLBACK = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=75&auto=format&fit=crop";

// PERF: module-level constant — CSS string allocated once, never recreated
const TOP_PICKS_ANIMATION_CSS = `
.fk-tp-card { animation: fkTPIn 0.4s ease both; }
@keyframes fkTPIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
}`;

// PERF: pure filter outside component — not recreated on re-render
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

// ── Top Pick Card — memoized ───────────────────────────────────────────────
const TopPickCard = memo(function TopPickCard({
    product,
    index,
}: {
    product: Product;
    index: number;
}) {
    const addItem = useCartStore(s => s.addItem);
    const unavailable = !product.isAvailable || product.stock <= 0;

    // PERF: cheap arithmetic — no useMemo needed
    const saving = product.compareAtPrice && product.compareAtPrice > product.price
        ? Math.round(product.compareAtPrice - product.price)
        : null;

    // Above-fold cards (first 3) load eagerly; rest are lazy
    const isAboveFold = index < 3;

    const handleAdd = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (unavailable) return;
        addItem({
            _id: product._id, name: product.name, price: product.price,
            image: product.image, quantity: 1, stock: product.stock, category: product.category,
        });
        toast.success(`${product.name} added!`, {
            style: { background: "#fff7ed", color: "#7c2d12", border: "1px solid #fed7aa", borderRadius: "14px" },
        });
    }, [addItem, product, unavailable]);

    return (
        <Link
            href={`/menu/${product.slug}`}
            style={{ animationDelay: `${index * 60}ms`, minWidth: 220, maxWidth: 240 }}
            className={`fk-tp-card group relative flex shrink-0 flex-col overflow-hidden rounded-3xl bg-white transition-all duration-300 snap-start ${unavailable ? "opacity-60" : "hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-200/60"
                }`}>

            {/* Gradient accent bar */}
            <div className="h-1 w-full flex-shrink-0" style={{ background: "linear-gradient(90deg,#f97316,#ef4444,#f59e0b)" }} />

            {/* Image — fixed 176px height, stable wrapper prevents layout shift */}
            <div className="relative h-44 w-full flex-shrink-0 overflow-hidden bg-stone-50">
                <img
                    src={cdnImage(product.image || FALLBACK, 480)}
                    alt={product.name}
                    width={240}
                    height={176}
                    loading={isAboveFold ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority={isAboveFold ? "high" : "auto"}
                    className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${unavailable ? "grayscale-[40%]" : "group-hover:scale-[1.06]"
                        }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

                {!unavailable && (
                    <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2.5 py-1 shadow-lg">
                        <Star size={8} fill="white" className="text-white" />
                        <span className="text-[9px] font-black uppercase tracking-wide text-white">Top Pick</span>
                    </div>
                )}

                {saving !== null && (
                    <div className="absolute right-2.5 top-2.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black text-white shadow">
                        Save ₹{saving}
                    </div>
                )}

                {unavailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[2px]">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-stone-500">
                            Unavailable
                        </span>
                    </div>
                )}

                {/* Price pill */}
                <div className="absolute bottom-2.5 right-2.5">
                    <div className="flex items-baseline gap-1 rounded-xl bg-white/95 px-2.5 py-1 shadow backdrop-blur-sm">
                        <span className="text-[15px] font-black text-orange-600">₹{product.price}</span>
                        {product.compareAtPrice && product.compareAtPrice > product.price && (
                            <span className="text-[10px] text-stone-400 line-through">₹{product.compareAtPrice}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col p-4">
                <h3
                    className="line-clamp-1 text-[14.5px] font-black leading-snug text-stone-900"
                    style={{ fontFamily: "'Playfair Display',Georgia,serif" }}>
                    {product.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-stone-400">
                    {product.shortDescription || product.description}
                </p>
                <button
                    onClick={handleAdd}
                    disabled={unavailable}
                    className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-black transition-all duration-200 ${unavailable
                            ? "cursor-not-allowed bg-stone-100 text-stone-400"
                            : "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-200 hover:brightness-110 active:scale-[0.97]"
                        }`}>
                    <ShoppingCart size={12} strokeWidth={2.5} />
                    {unavailable ? "Unavailable" : "Add to Cart"}
                </button>
            </div>
        </Link>
    );
});

// ── WAVE 3A: Section accepts precomputed topPicks OR raw products ──────────
// Preferred usage from MenuClient:
//   <TopPicksSection topPicks={precomputedTopPicks} />
// Legacy usage:
//   <TopPicksSection products={allProducts} />
type TopPicksSectionProps =
    | { topPicks: Product[]; products?: never }
    | { products: Product[]; topPicks?: never };

// ── Section — memoized ─────────────────────────────────────────────────────
const TopPicksSection = memo(function TopPicksSection(props: TopPicksSectionProps) {
    const ref = useRef<HTMLDivElement>(null);

    // PERF: if precomputed array passed → identity check only, zero scan cost
    const topPicks = useMemo(() => {
        if (props.topPicks !== undefined) return props.topPicks;
        return computeTopPicks(props.products ?? []);
    }, [props.topPicks, props.products]);

    const scrollLeft = useCallback(() => ref.current?.scrollBy({ left: -260, behavior: "smooth" }), []);
    const scrollRight = useCallback(() => ref.current?.scrollBy({ left: 260, behavior: "smooth" }), []);

    if (topPicks.length === 0) return null;

    return (
        <section
            className="relative overflow-hidden py-7 md:py-10"
            style={{ background: "linear-gradient(160deg,#fff8f0 0%,#fffbf5 60%,#fff3e0 100%)" }}>

            <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full opacity-20 blur-3xl"
                style={{ background: "radial-gradient(circle,#f97316,transparent 70%)" }} />

            <div className="mx-auto max-w-7xl px-4 md:px-8">
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1">
                            <Flame size={11} className="text-orange-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">
                                Editor&apos;s Choice
                            </span>
                        </div>
                        <h2
                            className="text-2xl font-black text-stone-900 md:text-3xl"
                            style={{ fontFamily: "'Playfair Display',Georgia,serif" }}>
                            🔥 Top Picks
                        </h2>
                        <p className="mt-0.5 text-[12px] text-stone-400">Our most loved items, handpicked for you</p>
                    </div>
                    <div className="hidden items-center gap-2 md:flex">
                        <button onClick={scrollLeft}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 bg-white text-stone-400 shadow-sm transition-all hover:border-orange-400 hover:bg-orange-50 hover:text-orange-500">
                            <ChevronLeft size={15} strokeWidth={2.5} />
                        </button>
                        <button onClick={scrollRight}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 bg-white text-stone-400 shadow-sm transition-all hover:border-orange-400 hover:bg-orange-50 hover:text-orange-500">
                            <ChevronRight size={15} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div
                    ref={ref}
                    className="no-scrollbar flex gap-4 overflow-x-auto pb-3"
                    style={{ scrollSnapType: "x mandatory" }}>
                    {topPicks.map((product, i) => (
                        <TopPickCard key={product._id} product={product} index={i} />
                    ))}
                </div>
            </div>

            {/* PERF: module-level constant CSS string — not recreated on re-render */}
            <style>{TOP_PICKS_ANIMATION_CSS}</style>
        </section>
    );
});

export default TopPicksSection;