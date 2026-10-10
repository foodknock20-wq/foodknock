"use client";

// src/components/products/ProductDetail.tsx
//
// FoodKnock Phase 4 — Product Detail 2.0. Light `--fk-*` token restyle +
// two "no fake data" fixes found during the Phase 3 audit (now in scope
// since Phase 4 includes Product Detail):
//   1. Rating used to fall back to a hardcoded 4.2 when `product.rating`
//      was null, and "happy customers" count was a fake number hashed
//      from the product _id. Both removed — rating now only ever renders
//      when it's a real non-null number (same truthful pattern used
//      since Phase 2's Home rework), and the fake review count is gone
//      entirely (no real field backs it).
//   2. The "Prep Time"/"Serves" info cards were static, hardcoded, not
//      tied to any real per-product field — removed. The real
//      stock/availability card stays (backed by `product.stock`).
// Add-to-cart (both the hero qty-stepper and the upsell mini-cards) now
// goes through the shared `useAddToCart` hook (src/hooks/useAddToCart.ts,
// Phase 3) instead of two more hand-rolled cartStore/toast
// implementations — the hook's `quantity` parameter (added this phase)
// lets the hero stepper add its chosen qty in one call.
// No variants/options/add-ons UI — confirmed (again) no such schema/data
// exists; add-to-cart stays single qty-stepper → cartStore, exactly as
// before.

import { useState, useCallback, useMemo, memo } from "react";
import {
    ShoppingCart,
    Star,
    Flame,
    Leaf,
    ChevronLeft,
    Plus,
    Minus,
    BadgeCheck,
    Clock,
    Zap,
    Package,
} from "lucide-react";
import Link from "next/link";
import ProductCard from "./ProductCard";
import { cdnImage } from "@/lib/cdnImage";
import { useAddToCart, type AddToCartProduct } from "@/hooks/useAddToCart";
import PriceDisplay from "@/components/ui/PriceDisplay";
import ProductShareButton from "./ProductShareButton";
import ProductReviews from "./ProductReviews";

// ─── Types ────────────────────────────────────────────────────────────────
type Product = {
    _id: string;
    name: string;
    slug: string;
    description: string;
    shortDescription?: string;
    price: number;
    compareAtPrice?: number | null;
    category: string;
    image: string;
    stock: number;
    isAvailable: boolean;
    isFeatured?: boolean;
    tags?: string[];
    rating?: number | null;
    reviewCount?: number;
    ingredients?: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function normalizeCategory(cat: string) {
    return cat.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

const TAG_STYLES: Record<string, { className: string; icon: React.ReactNode }> = {
    veg: { className: "border-fk-success/30 bg-fk-success/10 text-fk-success", icon: <Leaf size={11} strokeWidth={2.5} /> },
    spicy: { className: "border-fk-danger/30 bg-fk-danger/10 text-fk-danger", icon: <Flame size={11} strokeWidth={2.5} /> },
    popular: { className: "border-fk-border bg-fk-gold-soft text-fk-gold", icon: <Star size={11} strokeWidth={2.5} /> },
    "best seller": { className: "border-fk-border bg-fk-surface-selected text-[var(--fk-accent)]", icon: <BadgeCheck size={11} strokeWidth={2.5} /> },
    "must try": { className: "border-fk-border bg-fk-surface-selected text-[var(--fk-accent)]", icon: <Zap size={11} strokeWidth={2.5} /> },
    fast: { className: "border-fk-border bg-fk-surface-interactive text-fk-text-secondary", icon: <Clock size={11} strokeWidth={2.5} /> },
};

function getTagStyle(tag: string) {
    return TAG_STYLES[tag.toLowerCase()] ?? { className: "border-fk-border bg-fk-surface-interactive text-fk-text-secondary", icon: null };
}

// ─── Upsell mini-card ─────────────────────────────────────────────────────
const UpsellCard = memo(function UpsellCard({ product }: { product: Product }) {
    const { handleAdd, addingId } = useAddToCart();
    const adding = addingId === product._id;
    const isUnavailable = !product.isAvailable || product.stock <= 0;

    const onAdd = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            handleAdd(product as AddToCartProduct, `${product.name} added to your order! 🛒`);
        },
        [handleAdd, product]
    );

    return (
        <div className="group flex overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm transition-all duration-200 hover:shadow-md">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-fk-surface-interactive">
                <img
                    src={cdnImage(product.image, 120)}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
                />
            </div>
            <div className="flex flex-1 flex-col justify-between p-3">
                <div>
                    <span className="mb-1 inline-block rounded-fk-pill border border-fk-border bg-fk-surface-selected px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--fk-accent)]">
                        {normalizeCategory(product.category)}
                    </span>
                    <p className="line-clamp-1 text-[13px] font-black text-fk-text">{product.name}</p>
                    <div className="mt-0.5">
                        <PriceDisplay price={product.price} compareAtPrice={product.compareAtPrice} size="sm" />
                    </div>
                </div>
                <button
                    onClick={onAdd}
                    disabled={adding || isUnavailable}
                    aria-label={`Add ${product.name} to cart`}
                    className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-fk-sm py-1.5 text-[11px] font-black transition-all duration-200 ${adding
                        ? "bg-fk-success text-white"
                        : isUnavailable
                            ? "cursor-not-allowed border border-fk-border bg-fk-surface-interactive text-fk-text-tertiary"
                            : "bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white active:scale-95"
                        }`}
                >
                    {adding ? <>✓ Added!</> : <><Plus size={10} strokeWidth={3} /> Add to Order</>}
                </button>
            </div>
        </div>
    );
});

// ─── Main component ───────────────────────────────────────────────────────
export default function ProductDetail({
    product,
    upsellProducts = [],
    relatedProducts = [],
    upsellTitle = "Goes Great With This",
}: {
    product: Product;
    upsellProducts?: Product[];
    relatedProducts?: Product[];
    // Pre-Phase 17 Phase 3 — reflects the REAL recommendation source
    // (src/lib/recommendations.ts): "Frequently Bought Together" only when
    // genuine co-purchase data backs it, otherwise an honest fallback title.
    upsellTitle?: string;
}) {
    const { handleAdd, addingId } = useAddToCart();
    const [qty, setQty] = useState(1);
    const adding = addingId === product._id;

    // Lifted so the hero rating badge and the Reviews section below always
    // reflect the exact same live value — updates instantly after a review
    // is submitted, no full page reload needed.
    const [ratingSummary, setRatingSummary] = useState<{ average: number | null; count: number }>({
        average: product.rating ?? null,
        count: product.reviewCount ?? 0,
    });

    const isUnavailable = !product.isAvailable || product.stock <= 0;

    const stockLabel = useMemo(
        () => (product.stock > 0 ? `${Math.min(product.stock, 99)}+ left` : "Sold Out"),
        [product.stock]
    );

    const decQty = useCallback(() => setQty((q) => Math.max(1, q - 1)), []);
    const incQty = useCallback(
        () => setQty((q) => Math.min(Math.min(10, product.stock), q + 1)),
        [product.stock]
    );

    const handleAddToCart = useCallback(() => {
        handleAdd(
            product as AddToCartProduct,
            `${qty > 1 ? `${qty}× ` : ""}${product.name} added to your cart! 🛒`,
            qty
        );
    }, [handleAdd, product, qty]);

    return (
        <main className="min-h-screen bg-fk-bg">

            {/* ── Breadcrumb nav ── */}
            <div className="sticky top-0 z-30 border-b border-fk-border bg-fk-bg/95 backdrop-blur-md">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
                    <Link
                        href="/menu"
                        className="flex items-center gap-1.5 rounded-fk-md border border-fk-border bg-fk-surface-elevated px-3 py-2 text-xs font-bold text-fk-text-secondary transition-all hover:text-fk-text active:scale-95"
                    >
                        <ChevronLeft size={14} strokeWidth={2.5} />
                        Back to Menu
                    </Link>
                    <div className="h-4 w-px bg-fk-border" />
                    <p className="truncate text-xs text-fk-text-tertiary">
                        <span className="font-semibold text-fk-text-secondary">{normalizeCategory(product.category)}</span>
                        <span className="mx-1.5 text-fk-text-tertiary">›</span>
                        <span className="font-bold text-fk-text">{product.name}</span>
                    </p>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">

                {/* SECTION 1 — PRODUCT HERO */}
                <div className="grid gap-8 md:grid-cols-2 md:gap-14">

                    {/* Left: Image */}
                    <div className="relative">
                        <div className="relative aspect-square overflow-hidden rounded-fk-lg bg-fk-surface-interactive shadow-fk-lg">
                            <img
                                src={cdnImage(product.image, 700)}
                                alt={product.name}
                                loading="eager"
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />

                            {product.isFeatured && (
                                <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-3 py-1.5 text-xs font-black text-white shadow-fk-md">
                                    <Star size={11} strokeWidth={3} className="fill-white" />
                                    Chef&apos;s Pick
                                </div>
                            )}

                            {isUnavailable && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-fk-lg bg-white/60 backdrop-blur-sm">
                                    <span className="rounded-fk-md border border-fk-border bg-fk-surface-elevated px-5 py-2.5 text-sm font-black uppercase tracking-widest text-fk-text-secondary shadow-fk-md">
                                        Currently Unavailable
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                            <span className="whitespace-nowrap rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[var(--fk-accent)] shadow-fk-md">
                                {normalizeCategory(product.category)}
                            </span>
                        </div>
                    </div>

                    {/* Right: Details */}
                    <div className="flex flex-col pt-6 md:pt-0">

                        {product.tags && product.tags.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-1.5">
                                {product.tags.map((tag) => {
                                    const s = getTagStyle(tag);
                                    return (
                                        <span key={tag} className={`flex items-center gap-1 rounded-fk-pill border px-2.5 py-1 text-[10px] font-bold capitalize ${s.className}`}>
                                            {s.icon}
                                            {tag}
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        <h1 className="font-display text-2xl font-black leading-tight text-fk-text md:text-3xl lg:text-4xl">
                            {product.name}
                        </h1>

                        {/* Rating row — only when real, no fabricated fallback/count */}
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            {typeof ratingSummary.average === "number" && ratingSummary.average > 0 && (
                                <>
                                    <div className="flex items-center gap-1.5 rounded-fk-sm bg-fk-success px-2.5 py-1">
                                        <Star size={11} strokeWidth={3} className="fill-white text-white" />
                                        <span className="text-xs font-black text-white">{ratingSummary.average.toFixed(1)}</span>
                                    </div>
                                    {ratingSummary.count > 0 && (
                                        <span className="text-[11px] font-bold text-fk-text-tertiary">
                                            ({ratingSummary.count} review{ratingSummary.count !== 1 ? "s" : ""})
                                        </span>
                                    )}
                                    <div className="h-3 w-px bg-fk-border" />
                                </>
                            )}
                            <span className={`flex items-center gap-1.5 text-xs font-bold ${isUnavailable ? "text-fk-danger" : "text-fk-success"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${isUnavailable ? "bg-fk-danger" : "bg-fk-success animate-pulse motion-reduce:animate-none"}`} />
                                {isUnavailable ? "Out of Stock" : "In Stock · Ready to Order"}
                            </span>
                            <div className="h-3 w-px bg-fk-border" />
                            <ProductShareButton productName={product.name} />
                        </div>

                        {/* Price */}
                        <div className="mt-5">
                            <PriceDisplay price={product.price} compareAtPrice={product.compareAtPrice} size="lg" />
                        </div>

                        {product.shortDescription && (
                            <p className="mt-1.5 text-sm font-semibold leading-relaxed text-fk-text-secondary">{product.shortDescription}</p>
                        )}

                        <p className="mt-3 text-sm leading-relaxed text-fk-text-secondary md:text-base">{product.description}</p>

                        <div className="my-5 h-px bg-fk-border" />

                        {/* Availability card — real data only (fabricated "Prep Time"/"Serves" cards removed) */}
                        <div className="mb-5 flex items-center gap-2.5 rounded-fk-md border border-fk-border bg-fk-surface-elevated p-3">
                            <Package size={16} className="text-fk-success shrink-0" strokeWidth={2} />
                            <div>
                                <span className="block text-xs font-black text-fk-text">{stockLabel}</span>
                                <span className="block text-[10px] text-fk-text-tertiary">Availability</span>
                            </div>
                        </div>

                        {product.ingredients && product.ingredients.length > 0 && (
                            <div className="mb-5">
                                <p className="mb-2.5 text-xs font-black uppercase tracking-wider text-fk-text-secondary">What&apos;s Inside</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {product.ingredients.map((ing) => (
                                        <span key={ing} className="rounded-fk-pill border border-fk-border bg-fk-surface-selected px-3 py-1 text-xs font-semibold capitalize text-fk-text-secondary">
                                            {ing}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Qty + Add to cart (desktop) */}
                        <div className="mt-auto hidden items-center gap-3 md:flex">
                            <div className="flex items-center overflow-hidden rounded-fk-md border border-fk-border bg-fk-surface-elevated">
                                <button onClick={decQty} disabled={isUnavailable} aria-label="Decrease quantity"
                                    className="flex h-11 w-11 items-center justify-center text-fk-text-secondary transition-colors hover:text-[var(--fk-accent)] disabled:opacity-30 active:scale-95">
                                    <Minus size={14} strokeWidth={2.5} />
                                </button>
                                <span className="min-w-[2.5rem] border-x border-fk-border px-2 text-center text-sm font-black text-fk-text" aria-live="polite">{qty}</span>
                                <button onClick={incQty} disabled={isUnavailable} aria-label="Increase quantity"
                                    className="flex h-11 w-11 items-center justify-center text-fk-text-secondary transition-colors hover:text-[var(--fk-accent)] disabled:opacity-30 active:scale-95">
                                    <Plus size={14} strokeWidth={2.5} />
                                </button>
                            </div>

                            <button
                                onClick={handleAddToCart}
                                disabled={isUnavailable || adding}
                                aria-label={`Add ${qty > 1 ? `${qty} ` : ""}${product.name} to cart`}
                                className={`flex flex-1 items-center justify-center gap-2.5 rounded-fk-md py-3.5 text-sm font-black transition-all duration-200 ${isUnavailable
                                    ? "cursor-not-allowed border border-fk-border bg-fk-surface-interactive text-fk-text-tertiary"
                                    : adding
                                        ? "scale-[0.98] bg-fk-success text-white"
                                        : "bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white shadow-fk-md active:scale-[0.98]"
                                    }`}
                            >
                                {adding ? <><span>✓</span> Added to Cart!</> : isUnavailable ? <><ShoppingCart size={16} strokeWidth={2.5} /> Not Available</> : <><ShoppingCart size={16} strokeWidth={2.5} /> Add {qty > 1 ? `${qty} × ` : ""}to Cart · ₹{product.price * qty}</>}
                            </button>
                        </div>

                        {/* Mobile inline action row */}
                        <div className="mt-5 flex items-center gap-2.5 md:hidden">
                            <div className="flex shrink-0 items-center overflow-hidden rounded-fk-md border border-fk-border bg-fk-surface-elevated">
                                <button onClick={decQty} disabled={isUnavailable} aria-label="Decrease quantity"
                                    className="flex h-12 w-11 items-center justify-center text-fk-text-secondary transition-colors hover:text-[var(--fk-accent)] disabled:opacity-30 active:scale-95">
                                    <Minus size={13} strokeWidth={2.5} />
                                </button>
                                <span className="min-w-[2.25rem] border-x border-fk-border px-2 text-center text-sm font-black text-fk-text" aria-live="polite">{qty}</span>
                                <button onClick={incQty} disabled={isUnavailable} aria-label="Increase quantity"
                                    className="flex h-12 w-11 items-center justify-center text-fk-text-secondary transition-colors hover:text-[var(--fk-accent)] disabled:opacity-30 active:scale-95">
                                    <Plus size={13} strokeWidth={2.5} />
                                </button>
                            </div>

                            <button
                                onClick={handleAddToCart}
                                disabled={isUnavailable || adding}
                                aria-label={`Add ${qty > 1 ? `${qty} ` : ""}${product.name} to cart for ₹${product.price * qty}`}
                                className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-fk-md text-[13.5px] font-black transition-all duration-200 ${isUnavailable
                                    ? "cursor-not-allowed border border-fk-border bg-fk-surface-interactive text-fk-text-tertiary"
                                    : adding
                                        ? "scale-[0.98] bg-fk-success text-white"
                                        : "bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white shadow-fk-md active:scale-[0.98]"
                                    }`}
                            >
                                {adding ? <><span>✓</span> Added!</> : isUnavailable ? "Not Available" : <><ShoppingCart size={15} strokeWidth={2.5} /> Add to Cart · ₹{product.price * qty}</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* SECTION 2 — RATINGS & REVIEWS */}
                <ProductReviews
                    productId={product._id}
                    productName={product.name}
                    summary={ratingSummary}
                    onSummaryChange={setRatingSummary}
                />

                {/* SECTION 3 — FREQUENTLY BOUGHT TOGETHER */}
                {upsellProducts.length > 0 && (
                    <section className="mt-16">
                        <div className="mb-5 flex items-center gap-3">
                            <div>
                                <h2 className="font-display text-lg font-black text-fk-text md:text-xl">{upsellTitle}</h2>
                                <p className="mt-0.5 text-xs text-fk-text-tertiary">
                                    {upsellTitle === "Frequently Bought Together"
                                        ? "Based on what customers actually order together"
                                        : "Complements this dish nicely"}
                                </p>
                            </div>
                            <div className="h-px flex-1 bg-fk-border" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                            {upsellProducts.map((p) => (<UpsellCard key={p._id} product={p} />))}
                        </div>
                    </section>
                )}

                {/* SECTION 4 — YOU MAY ALSO LIKE */}
                {relatedProducts.length > 0 && (
                    <section className="mt-16 pb-32 md:pb-12">
                        <div className="mb-5 flex items-center gap-3">
                            <div>
                                <h2 className="font-display text-lg font-black text-fk-text md:text-xl">You Might Also Love</h2>
                                <p className="mt-0.5 text-xs text-fk-text-tertiary">More from {normalizeCategory(product.category)}</p>
                            </div>
                            <div className="h-px flex-1 bg-fk-border" />
                            <Link href="/menu" className="shrink-0 rounded-fk-pill border border-fk-border bg-fk-surface-selected px-3 py-1.5 text-xs font-bold text-[var(--fk-accent)] transition-all hover:brightness-110">
                                View All →
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                            {relatedProducts.map((p, i) => (<ProductCard key={p._id} product={p} index={i} />))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
