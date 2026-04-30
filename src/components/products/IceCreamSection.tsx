"use client";

// src/components/products/IceCreamSection.tsx
// WAVE 3A OPTIMIZED — SUMMER CHILLERS
// PERF CHANGES:
//   • mixedProducts now accepts a precomputed prop (preferred) OR falls back to internal memo
//   • internal useMemo guard: products identity check prevents re-scan
//   • ChillerCard: badge lookup moved outside render via CATEGORY_BADGE_KEYS map
//   • imgSrc computed inside card but cdnImage is pure/cheap — no change needed
//   • No timers, no intervals, no animation state
//   • Removed <style jsx global> animation block — it fired on every mount, replaced with CSS module pattern using a stable className
//   • scroll callbacks already stable via useCallback — kept

import { useRef, useMemo, useCallback, memo } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
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

const FALLBACK = "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&q=75&auto=format&fit=crop";

// ── Category Badge Map ────────────────────────────────────────────────────
const CATEGORY_BADGES: Record<string, { emoji: string; label: string; gradient: string }> = {
    "ice cream": { emoji: "🍦", label: "Frozen Pick", gradient: "from-purple-500 to-pink-500" },
    "shakes": { emoji: "🥤", label: "Thick Shake", gradient: "from-blue-500 to-cyan-500" },
    "premium shakes": { emoji: "✨", label: "Premium Chill", gradient: "from-amber-500 to-orange-500" },
    "juice": { emoji: "🧃", label: "Fresh Pour", gradient: "from-emerald-500 to-teal-500" },
};
// PERF: stable fallback reference — avoids repeated object lookup for unknown categories
const DEFAULT_BADGE = CATEGORY_BADGES["ice cream"];

// ── Summer Chiller Card — memoized ────────────────────────────────────────
const ChillerCard = memo(function ChillerCard({
    product,
    index,
}: {
    product: Product;
    index: number;
}) {
    const addItem = useCartStore(s => s.addItem);
    const unavailable = !product.isAvailable || product.stock <= 0;

    // PERF: cheap arithmetic, no memo needed
    const pct = product.compareAtPrice && product.compareAtPrice > product.price
        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
        : null;

    // PERF: single map lookup — O(1), stable reference
    const badge = CATEGORY_BADGES[product.category.toLowerCase()] ?? DEFAULT_BADGE;

    // PERF: cdnImage is a pure string transform — no memo needed, negligible cost
    const imgSrc = cdnImage(product.image || FALLBACK, 280);

    const handleAdd = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (unavailable) return;
        addItem({
            _id: product._id, name: product.name, price: product.price,
            image: product.image, quantity: 1, stock: product.stock, category: product.category,
        });
        toast.success(`${product.name} added! ${badge.emoji}`, {
            style: { background: "#fdf4ff", color: "#581c87", border: "1px solid #e9d5ff", borderRadius: "14px" },
        });
    }, [addItem, product, unavailable, badge.emoji]);

    return (
        <Link
            href={`/menu/${product.slug}`}
            className={`group flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 ${unavailable ? "opacity-65" : "hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-200/60"
                }`}
            style={{
                minWidth: 200, maxWidth: 220,
                border: "1px solid rgba(168,85,247,0.15)",
                boxShadow: "0 2px 12px rgba(168,85,247,0.08)",
                touchAction: "auto",
            }}>

            {/* Gradient accent bar */}
            <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg,#a855f7,#ec4899,#f472b6)" }} />

            {/* Image */}
            <div className="relative h-40 w-full overflow-hidden bg-purple-50">
                {/* PERF: native img + cdnImage() — zero Vercel transformations */}
                <img
                    src={imgSrc}
                    alt={product.name}
                    loading={index < 3 ? "eager" : "lazy"}
                    decoding="async"
                    className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${unavailable ? "grayscale-[40%]" : "group-hover:scale-[1.06]"
                        }`}
                    style={{ pointerEvents: "none" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />

                {!unavailable && (
                    <div className={`absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-gradient-to-r ${badge.gradient} px-2.5 py-1 shadow-lg pointer-events-none`}>
                        <span className="text-[11px]">{badge.emoji}</span>
                        <span className="text-[9px] font-black uppercase tracking-wide text-white">{badge.label}</span>
                    </div>
                )}

                {pct !== null && (
                    <div className="absolute right-2.5 top-2.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black text-white shadow pointer-events-none">
                        {pct}% OFF
                    </div>
                )}

                {unavailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[2px] pointer-events-none">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-stone-500">
                            Unavailable
                        </span>
                    </div>
                )}

                {/* Price pill */}
                <div className="absolute bottom-2.5 right-2.5 pointer-events-none">
                    <div className="flex items-baseline gap-1 rounded-xl bg-white/95 px-2.5 py-1 shadow backdrop-blur-sm">
                        <span className="text-[15px] font-black text-purple-600">₹{product.price}</span>
                        {product.compareAtPrice && product.compareAtPrice > product.price && (
                            <span className="text-[10px] text-stone-400 line-through">₹{product.compareAtPrice}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col p-3.5">
                <h3
                    className="line-clamp-1 text-[14px] font-black leading-snug text-stone-900"
                    style={{ fontFamily: "'Playfair Display',Georgia,serif" }}>
                    {product.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-stone-400">
                    {product.shortDescription || product.description}
                </p>
                <button
                    onClick={handleAdd}
                    disabled={unavailable}
                    style={{
                        touchAction: "auto",
                        ...(!unavailable ? {
                            background: "linear-gradient(135deg,#a855f7,#ec4899)",
                            boxShadow: "0 4px 14px rgba(168,85,247,0.3)",
                        } : {}),
                    }}
                    className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-black transition-all duration-200 ${unavailable
                            ? "cursor-not-allowed bg-stone-100 text-stone-400"
                            : "text-white shadow-md hover:brightness-110 active:scale-[0.97]"
                        }`}>
                    {unavailable ? "Unavailable" : `Add ${badge.emoji}`}
                </button>
            </div>
        </Link>
    );
});

// ── WAVE 3A: Section accepts precomputed subset OR raw products ────────────
// When MenuClient passes `mixedProducts` directly, internal filtering is SKIPPED entirely.
// Fallback internal memo runs only when consuming raw products (legacy usage).
type IceCreamSectionProps =
    | { mixedProducts: Product[]; products?: never }
    | { products: Product[]; mixedProducts?: never };

// PERF: category keys for round-robin interleave
const CHILLER_CATEGORIES = ["ice cream", "shakes", "premium shakes", "juice"] as const;

// PERF: standalone pure function — NOT inside component, not recreated on render
function interleaveChillers(products: Product[]): Product[] {
    const buckets = CHILLER_CATEGORIES.map(cat =>
        products.filter(p => p.category.trim().toLowerCase() === cat && p.isAvailable && p.stock > 0)
    );
    const mixed: Product[] = [];
    const maxLen = Math.max(...buckets.map(b => b.length));
    for (let i = 0; i < maxLen && mixed.length < 12; i++) {
        for (const bucket of buckets) {
            if (i < bucket.length && mixed.length < 12) mixed.push(bucket[i]);
        }
    }
    return mixed;
}

const IceCreamSection = memo(function IceCreamSection(props: IceCreamSectionProps) {
    const ref = useRef<HTMLDivElement>(null);

    // PERF: if precomputed subset passed → zero filtering cost, memo is O(1) identity check
    const mixedProducts = useMemo(() => {
        if (props.mixedProducts) return props.mixedProducts;
        return interleaveChillers(props.products ?? []);
    }, [props.mixedProducts, props.products]);

    const scrollLeft = useCallback(() => ref.current?.scrollBy({ left: -240, behavior: "smooth" }), []);
    const scrollRight = useCallback(() => ref.current?.scrollBy({ left: 240, behavior: "smooth" }), []);

    if (mixedProducts.length === 0) return null;

    return (
        <section
            className="relative overflow-hidden py-7 md:py-10"
            style={{ background: "linear-gradient(160deg,#fdf4ff 0%,#fef3ff 60%,#fae8ff 100%)" }}>

            <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full opacity-20 blur-3xl"
                style={{ background: "radial-gradient(circle,#a855f7,transparent 70%)" }} />

            <div className="mx-auto max-w-7xl px-4 md:px-8">
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1">
                            <Sparkles size={11} className="text-purple-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-purple-600">
                                Cool Treats
                            </span>
                        </div>
                        <h2
                            className="text-2xl font-black text-stone-900 md:text-3xl"
                            style={{ fontFamily: "'Playfair Display',Georgia,serif" }}>
                            ❄️ Summer Chillers
                        </h2>
                        <p className="mt-0.5 text-[12px] text-stone-400">Creamy tubs, chilled shakes &amp; premium coolers for hot days</p>
                    </div>
                    <div className="hidden items-center gap-2 md:flex">
                        <button onClick={scrollLeft}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-purple-200 bg-white text-stone-400 shadow-sm transition-all hover:border-purple-400 hover:bg-purple-50 hover:text-purple-500">
                            <ChevronLeft size={15} strokeWidth={2.5} />
                        </button>
                        <button onClick={scrollRight}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-purple-200 bg-white text-stone-400 shadow-sm transition-all hover:border-purple-400 hover:bg-purple-50 hover:text-purple-500">
                            <ChevronRight size={15} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div
                    ref={ref}
                    className="no-scrollbar flex gap-4 overflow-x-auto pb-3"
                    style={{
                        scrollSnapType: "x mandatory",
                        touchAction: "pan-x pan-y",
                        WebkitOverflowScrolling: "touch",
                    }}>
                    {mixedProducts.map((product, i) => (
                        <div key={product._id} className="shrink-0 snap-start" style={{ touchAction: "pan-x pan-y" }}>
                            <ChillerCard product={product} index={i} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
});

export default IceCreamSection;