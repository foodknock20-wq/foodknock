"use client";

// src/components/products/RecommendationRail.tsx
//
// Pre-Phase 17 — Phase 3: shared compact recommendation card rail, used by
// both Cart (src/app/(main)/cart/page.tsx) and Checkout's upsell strip
// (src/app/(main)/checkout/page.tsx) — one implementation, not two. Reuses
// useAddToCart (no second cart-state/validation/price implementation) so
// "Add" behaves exactly like every other Add-to-Cart button in the app.

import { Star, Plus } from "lucide-react";
import Link from "next/link";
import { cdnImage } from "@/lib/cdnImage";
import { useAddToCart } from "@/hooks/useAddToCart";
import type { RecommendedProduct } from "@/lib/recommendations";

export default function RecommendationRail({
    title,
    products,
    loading = false,
}: {
    title: string;
    products: RecommendedProduct[];
    loading?: boolean;
}) {
    const { handleAdd, addingId } = useAddToCart();

    if (!loading && products.length === 0) return null;

    return (
        // Cart Responsive Repair — `min-w-0` + `overflow-hidden` here are what
        // let this rail sit safely inside a CSS grid/flex column: without
        // them, a grid/flex item's automatic minimum size defaults to its
        // content's min-content width, so the horizontally-scrolling row of
        // fixed-width cards below would force this (and its parent column)
        // wider than the viewport instead of scrolling internally.
        <div className="w-full min-w-0 overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
            <div className="border-b border-fk-border bg-fk-surface-selected px-4 py-3">
                <p className="text-[13px] font-black tracking-tight text-fk-text">{title}</p>
            </div>
            <div className="flex gap-3 overflow-x-auto px-4 py-3.5" style={{ scrollSnapType: "x proximity" }}>
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-[148px] w-[120px] shrink-0 animate-pulse rounded-fk-md bg-fk-surface-interactive" />
                    ))
                    : products.map((product) => {
                        const adding = addingId === product._id;
                        const unavailable = !product.isAvailable || product.stock <= 0;
                        return (
                            <div
                                key={product._id}
                                className="w-[120px] shrink-0 overflow-hidden rounded-fk-md border border-fk-border bg-fk-surface-elevated"
                                style={{ scrollSnapAlign: "start" }}
                            >
                                <Link href={`/menu/${product.slug}`} className="block">
                                    <div className="relative h-20 w-full overflow-hidden bg-fk-surface-interactive">
                                        <img
                                            src={cdnImage(product.image, 160)}
                                            alt={product.name}
                                            loading="lazy"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div className="p-2">
                                        <p className="line-clamp-1 text-[11px] font-bold text-fk-text">{product.name}</p>
                                        {typeof product.rating === "number" && product.rating > 0 && (
                                            <span className="mt-0.5 flex items-center gap-0.5 text-[9.5px] font-bold text-fk-text-tertiary">
                                                <Star size={8} className="fill-fk-gold text-fk-gold" /> {product.rating.toFixed(1)}
                                            </span>
                                        )}
                                        <p className="mt-0.5 text-[12px] font-black text-[var(--fk-accent)]">₹{product.price}</p>
                                    </div>
                                </Link>
                                <div className="px-2 pb-2">
                                    <button
                                        type="button"
                                        disabled={unavailable || adding}
                                        onClick={() => handleAdd(product, `${product.name} added! 🛒`)}
                                        aria-label={`Add ${product.name} to cart`}
                                        className={`flex w-full items-center justify-center gap-1 rounded-fk-sm py-1.5 text-[10px] font-black transition-all ${unavailable
                                            ? "cursor-not-allowed bg-fk-surface-interactive text-fk-text-tertiary"
                                            : adding
                                                ? "bg-fk-success text-white"
                                                : "bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white active:scale-95"
                                            }`}
                                    >
                                        {adding ? "✓ Added" : unavailable ? "Sold Out" : <><Plus size={10} strokeWidth={3} /> Add</>}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}
