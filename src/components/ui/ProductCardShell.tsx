"use client";

// src/components/ui/ProductCardShell.tsx
//
// FoodKnock UI 2.0 — Phase 1 built this as an additive, dark-theme-ready
// ProductCard foundation (not wired into any route yet). Phase 2 is the
// first phase to render it live — see src/components/home/ProductRail.tsx,
// which replaced Home's old FeaturedProductCard/BestSellers components
// entirely (both deleted). src/components/products/ProductCard.tsx (Menu)
// and its other page-specific variants are still untouched — out of scope
// until a Menu redesign phase.
//
// Deliberately presentational: callers own add-to-cart/guest-gating/
// routing via props/callbacks — this component never imports cartStore,
// authStore, or any business-authority module directly.

import { useState } from "react";
import { Plus, Check, Minus, Star } from "lucide-react";
import { cdnImage } from "@/lib/cdnImage";
import { cn } from "@/lib/utils";
import PriceDisplay from "./PriceDisplay";
import { DiscountBadge } from "./Badge";

export interface ProductCardShellProduct {
    _id: string;
    name: string;
    price: number;
    compareAtPrice?: number | null;
    image: string;
    stock: number;
    isAvailable: boolean;
    // Real Product.rating (0-5), only ever rendered when present — never a
    // fabricated default (spec: "rating where available").
    rating?: number | null;
}

export interface ProductCardShellProps {
    product: ProductCardShellProduct;
    href?: string;
    onAdd?: (product: ProductCardShellProduct) => void;
    added?: boolean;
    className?: string;
    // FoodKnock UI 2.0 — Phase 2: optional quantity-stepper mode. When
    // `quantity > 0` and both handlers are supplied, the Add button is
    // replaced with a +/- stepper reflecting real cart state. Still
    // presentational — the caller (e.g. src/components/home/ProductRail.tsx)
    // owns all cart reads/writes; this component never imports cartStore.
    quantity?: number;
    onIncrease?: (product: ProductCardShellProduct) => void;
    onDecrease?: (product: ProductCardShellProduct) => void;
}

export default function ProductCardShell({
    product,
    href,
    onAdd,
    added = false,
    className,
    quantity = 0,
    onIncrease,
    onDecrease,
}: ProductCardShellProps) {
    const [imgSrc, setImgSrc] = useState(() => cdnImage(product.image, 400));
    const unavailable = !product.isAvailable || product.stock <= 0;
    const discountPct =
        product.compareAtPrice && product.compareAtPrice > product.price
            ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
            : 0;

    const content = (
        <>
            <div className="relative h-28 w-full overflow-hidden bg-fk-surface-interactive sm:h-32">
                <img
                    src={imgSrc}
                    alt={product.name}
                    width={400}
                    height={192}
                    loading="lazy"
                    onError={() => setImgSrc("/logo/logo.jpg")}
                    className={cn("h-full w-full object-cover", unavailable && "opacity-40 grayscale")}
                />
                {discountPct > 0 && (
                    <div className="absolute left-2.5 top-2.5">
                        <DiscountBadge percent={discountPct} />
                    </div>
                )}
                {unavailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="rounded-fk-pill bg-fk-surface-elevated px-3 py-1 text-[11px] font-black uppercase tracking-wide text-fk-text-secondary">
                            Out of stock
                        </span>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-2 p-3 sm:p-3.5">
                <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-bold text-fk-text">{product.name}</p>
                    {typeof product.rating === "number" && product.rating > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5 text-[10.5px] font-bold text-fk-text-secondary">
                            <Star size={10} className="fill-fk-gold text-fk-gold" />
                            {product.rating.toFixed(1)}
                        </span>
                    )}
                </div>
                {/* grid, not flex: `minmax(0,1fr)` guarantees the price column
                    actually shrinks instead of the Add button's fixed `auto`
                    column being pushed outside the card (a flex row's default
                    min-width:auto would let a wide compare-at-price string do
                    exactly that — the card's own overflow-hidden then clips
                    the button, looking like a "half visible +" bug). */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <div className="min-w-0 overflow-hidden">
                        <PriceDisplay price={product.price} compareAtPrice={product.compareAtPrice} size="sm" />
                    </div>
                    {quantity > 0 && onIncrease && onDecrease ? (
                        <div
                            className="flex h-9 shrink-0 items-center overflow-hidden rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white shadow-sm"
                            onClick={(e) => e.preventDefault()}
                        >
                            <button
                                type="button"
                                aria-label={`Decrease quantity of ${product.name}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDecrease(product);
                                }}
                                className="flex h-full w-8 items-center justify-center active:scale-90"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="w-4 text-center text-[13px] font-black">{quantity}</span>
                            <button
                                type="button"
                                aria-label={`Increase quantity of ${product.name}`}
                                disabled={quantity >= product.stock}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onIncrease(product);
                                }}
                                className="flex h-full w-8 items-center justify-center active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    ) : (
                        onAdd && (
                            <button
                                type="button"
                                disabled={unavailable}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onAdd(product);
                                }}
                                aria-label={`Add ${product.name} to cart`}
                                className={cn(
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-md shadow-sm transition-all active:scale-90",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fk-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-fk-surface-elevated",
                                    "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
                                    added
                                        ? "bg-fk-success text-white"
                                        : "bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white"
                                )}
                            >
                                {added ? <Check size={17} /> : <Plus size={17} strokeWidth={2.5} />}
                            </button>
                        )
                    )}
                </div>
            </div>
        </>
    );

    const wrapperClass = cn(
        "block overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated transition-transform active:scale-[0.98]",
        className
    );

    if (href) {
        return (
            <a href={href} className={wrapperClass}>
                {content}
            </a>
        );
    }
    return <div className={wrapperClass}>{content}</div>;
}
