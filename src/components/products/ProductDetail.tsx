"use client";

// src/components/products/ProductDetail.tsx

import { useState } from "react";
import { useCartStore } from "@/store/cartStore";
import { toast } from "react-hot-toast";
import {
    ShoppingCart, Star, Flame, Leaf, ChevronLeft,
    Plus, Minus, BadgeCheck, Clock, Zap, Users, Package,
} from "lucide-react";
import Link from "next/link";
import ProductCard from "./ProductCard";

// ─── Types ────────────────────────────────────────────────────────────────
type Product = {
    _id: string;
    name: string;
    slug: string;
    description: string;
    shortDescription?: string;
    price: number;
    category: string;
    image: string;
    stock: number;
    isAvailable: boolean;
    isFeatured?: boolean;
    tags?: string[];
    rating?: number;
    ingredients?: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function normalizeCategory(cat: string) {
    return cat.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

const TAG_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    veg:           { bg: "bg-green-50 border-green-200",   text: "text-green-700",  icon: <Leaf size={11} strokeWidth={2.5} /> },
    spicy:         { bg: "bg-red-50 border-red-200",       text: "text-red-600",    icon: <Flame size={11} strokeWidth={2.5} /> },
    popular:       { bg: "bg-amber-50 border-amber-200",   text: "text-amber-700",  icon: <Star size={11} strokeWidth={2.5} /> },
    "best seller": { bg: "bg-orange-50 border-orange-200", text: "text-orange-600", icon: <BadgeCheck size={11} strokeWidth={2.5} /> },
    "must try":    { bg: "bg-purple-50 border-purple-200", text: "text-purple-600", icon: <Zap size={11} strokeWidth={2.5} /> },
    fast:          { bg: "bg-sky-50 border-sky-200",       text: "text-sky-600",    icon: <Clock size={11} strokeWidth={2.5} /> },
};

function getTagStyle(tag: string) {
    return TAG_STYLES[tag.toLowerCase()] ?? { bg: "bg-stone-50 border-stone-200", text: "text-stone-600", icon: null };
}

// ─── Upsell mini-card ─────────────────────────────────────────────────────
function UpsellCard({ product }: { product: Product }) {
    const addItem  = useCartStore((s) => s.addItem);
    const [adding, setAdding] = useState(false);
    const [imgErr, setImgErr] = useState(false);

    const handleAdd = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!product.isAvailable || product.stock <= 0) return;
        setAdding(true);
        addItem({
            _id: product._id, name: product.name,
            price: product.price, image: product.image,
            quantity: 1, stock: product.stock, category: product.category,
        });
        toast.success(`${product.name} added to your order! 🛒`, {
            style: { background: "#fff7ed", color: "#7c2d12", border: "1px solid #fed7aa", borderRadius: "14px" },
            iconTheme: { primary: "#f97316", secondary: "#fff7ed" },
        });
        setTimeout(() => setAdding(false), 1500);
    };

    return (
        <div className="group flex overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition-all duration-200 hover:border-orange-200 hover:shadow-md hover:shadow-orange-100/60">
            {/* Image */}
            <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50">
                {!imgErr ? (
                    <img
                        src={product.image} alt={product.name}
                        onError={() => setImgErr(true)}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <span className="text-3xl opacity-40">🍽️</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
            </div>

            {/* Info */}
            <div className="flex flex-1 flex-col justify-between p-3">
                <div>
                    <span className="mb-1 inline-block rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-orange-500">
                        {normalizeCategory(product.category)}
                    </span>
                    <p className="line-clamp-1 text-[13px] font-black text-stone-800">{product.name}</p>
                    <p className="mt-0.5 text-sm font-black text-orange-600">₹{product.price}</p>
                </div>
                <button
                    onClick={handleAdd}
                    disabled={adding || !product.isAvailable || product.stock <= 0}
                    className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-1.5 text-[11px] font-black transition-all duration-200 ${
                        adding
                            ? "bg-green-500 text-white shadow-sm"
                            : !product.isAvailable || product.stock <= 0
                            ? "cursor-not-allowed border border-stone-200 bg-stone-100 text-stone-400"
                            : "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-200 hover:brightness-110 active:scale-95"
                    }`}
                >
                    {adding ? (
                        <>✓ Added!</>
                    ) : (
                        <><Plus size={10} strokeWidth={3} /> Add to Order</>
                    )}
                </button>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function ProductDetail({
    product,
    upsellProducts = [],
    relatedProducts = [],
}: {
    product: Product;
    upsellProducts?: Product[];
    relatedProducts?: Product[];
}) {
    const addItem       = useCartStore((s) => s.addItem);
    const isUnavailable = !product.isAvailable || product.stock <= 0;
    const [qty, setQty]       = useState(1);
    const [adding, setAdding] = useState(false);
    const [imgError, setImgError] = useState(false);

    const rating      = product.rating ?? 4.2;
    const ratingCount = Math.floor((parseInt(product._id.slice(-4), 16) % 800) + 100);

    const handleAddToCart = () => {
        if (isUnavailable) { toast.error("This item is currently unavailable"); return; }
        setAdding(true);
        for (let i = 0; i < qty; i++) {
            addItem({
                _id: product._id, name: product.name,
                price: product.price, image: product.image,
                quantity: 1, stock: product.stock, category: product.category,
            });
        }
        toast.success(`${qty > 1 ? `${qty}× ` : ""}${product.name} added to your cart! 🛒`, {
            style: { background: "#fff7ed", color: "#7c2d12", border: "1px solid #fed7aa", borderRadius: "14px" },
            iconTheme: { primary: "#f97316", secondary: "#fff7ed" },
        });
        setTimeout(() => setAdding(false), 600);
    };

    return (
        <main className="min-h-screen bg-[#FFFBF5]">

            {/* ── Breadcrumb nav ── */}
            <div className="sticky top-0 z-30 border-b border-amber-100 bg-[#FFFBF5]/95 backdrop-blur-md">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
                    <Link
                        href="/menu"
                        className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-stone-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 active:scale-95"
                    >
                        <ChevronLeft size={14} strokeWidth={2.5} />
                        Back to Menu
                    </Link>
                    <div className="h-4 w-px bg-stone-200" />
                    <p className="truncate text-xs text-stone-400">
                        <span className="font-semibold text-stone-500">{normalizeCategory(product.category)}</span>
                        <span className="mx-1.5 text-stone-300">›</span>
                        <span className="font-bold text-stone-700">{product.name}</span>
                    </p>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">

                {/* ════════════════════════════════════════
                    SECTION 1 — PRODUCT HERO
                ════════════════════════════════════════ */}
                <div className="grid gap-8 md:grid-cols-2 md:gap-14">

                    {/* Left: Image */}
                    <div className="relative">
                        <div className="relative aspect-square overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 to-orange-100 shadow-xl shadow-orange-100/70">
                            {!imgError ? (
                                <img
                                    src={product.image} alt={product.name}
                                    onError={() => setImgError(true)}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <span className="text-8xl opacity-30">🍽️</span>
                                </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />

                            {/* Featured badge */}
                            {product.isFeatured && (
                                <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-stone-900 shadow-lg shadow-amber-300/50">
                                    <Star size={11} strokeWidth={3} className="fill-stone-900" />
                                    Chef's Pick
                                </div>
                            )}

                            {/* Unavailable overlay */}
                            {isUnavailable && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/60 backdrop-blur-sm">
                                    <span className="rounded-2xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-black uppercase tracking-widest text-stone-500 shadow-md">
                                        Currently Unavailable
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Floating category pill */}
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                            <span className="whitespace-nowrap rounded-full border border-orange-200 bg-white px-4 py-1.5 text-xs font-black uppercase tracking-wider text-orange-500 shadow-md">
                                {normalizeCategory(product.category)}
                            </span>
                        </div>
                    </div>

                    {/* Right: Details */}
                    <div className="flex flex-col pt-6 md:pt-0">

                        {/* Tags */}
                        {product.tags && product.tags.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-1.5">
                                {product.tags.map((tag) => {
                                    const s = getTagStyle(tag);
                                    return (
                                        <span key={tag} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${s.bg} ${s.text}`}>
                                            {s.icon}{tag}
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {/* Name */}
                        <h1 className="text-2xl font-black leading-tight text-stone-900 md:text-3xl lg:text-4xl">
                            {product.name}
                        </h1>

                        {/* Rating row */}
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5 rounded-lg bg-green-600 px-2.5 py-1 shadow-sm">
                                <Star size={11} strokeWidth={3} className="fill-white text-white" />
                                <span className="text-xs font-black text-white">{rating.toFixed(1)}</span>
                            </div>
                            <span className="text-xs font-medium text-stone-400">{ratingCount.toLocaleString()} happy customers</span>
                            <div className="h-3 w-px bg-stone-200" />
                            <span className={`flex items-center gap-1.5 text-xs font-bold ${isUnavailable ? "text-red-500" : "text-green-600"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${isUnavailable ? "bg-red-400" : "bg-green-500 animate-pulse"}`} />
                                {isUnavailable ? "Out of Stock" : "In Stock · Ready to Order"}
                            </span>
                        </div>

                        {/* Price */}
                        <div className="mt-5 flex items-end gap-2">
                            <span className="text-4xl font-black text-orange-600 md:text-5xl">₹{product.price}</span>
                            <span className="mb-1.5 text-sm font-medium text-stone-400">per serving</span>
                        </div>

                        {/* Short description */}
                        {product.shortDescription && (
                            <p className="mt-1.5 text-sm font-semibold text-stone-500 leading-relaxed">{product.shortDescription}</p>
                        )}

                        {/* Full description */}
                        <p className="mt-3 text-sm leading-relaxed text-stone-600 md:text-base">{product.description}</p>

                        {/* Divider */}
                        <div className="my-5 h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent" />

                        {/* ── Info cards ── */}
                        <div className="mb-5 grid grid-cols-3 gap-3">
                            {[
                                { icon: <Clock size={16} className="text-amber-500" strokeWidth={2} />, label: "Prep Time", value: "15–20 min" },
                                { icon: <Users size={16} className="text-orange-500" strokeWidth={2} />, label: "Serves", value: "1 Person" },
                                { icon: <Package size={16} className="text-green-500" strokeWidth={2} />, label: "Availability", value: product.stock > 0 ? `${Math.min(product.stock, 99)}+ left` : "Sold Out" },
                            ].map((card) => (
                                <div key={card.label} className="flex flex-col items-center gap-1.5 rounded-2xl border border-amber-100 bg-white p-3 text-center shadow-sm">
                                    {card.icon}
                                    <span className="text-xs font-black text-stone-800">{card.value}</span>
                                    <span className="text-[10px] text-stone-400">{card.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Ingredients */}
                        {product.ingredients && product.ingredients.length > 0 && (
                            <div className="mb-5">
                                <p className="mb-2.5 text-xs font-black uppercase tracking-wider text-stone-500">What's Inside</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {product.ingredients.map((ing) => (
                                        <span key={ing} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-stone-600 capitalize">
                                            {ing}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Qty + Add to cart (desktop) ── */}
                        <div className="mt-auto hidden items-center gap-3 md:flex">
                            {/* Qty picker */}
                            <div className="flex items-center overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
                                <button
                                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                                    disabled={isUnavailable}
                                    className="flex h-11 w-11 items-center justify-center text-stone-500 transition-colors hover:bg-amber-50 hover:text-orange-500 disabled:opacity-30 active:scale-95"
                                >
                                    <Minus size={14} strokeWidth={2.5} />
                                </button>
                                <span className="min-w-[2.5rem] border-x border-amber-200 px-2 text-center text-sm font-black text-stone-800">{qty}</span>
                                <button
                                    onClick={() => setQty((q) => Math.min(Math.min(10, product.stock), q + 1))}
                                    disabled={isUnavailable}
                                    className="flex h-11 w-11 items-center justify-center text-stone-500 transition-colors hover:bg-amber-50 hover:text-orange-500 disabled:opacity-30 active:scale-95"
                                >
                                    <Plus size={14} strokeWidth={2.5} />
                                </button>
                            </div>

                            {/* Add to cart */}
                            <button
                                onClick={handleAddToCart}
                                disabled={isUnavailable || adding}
                                className={`flex flex-1 items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-black transition-all duration-200 ${
                                    isUnavailable
                                        ? "cursor-not-allowed border border-stone-200 bg-stone-100 text-stone-400"
                                        : adding
                                        ? "scale-[0.98] bg-green-500 text-white shadow-lg shadow-green-200"
                                        : "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200 hover:brightness-110 hover:shadow-orange-300 active:scale-[0.98]"
                                }`}
                            >
                                {adding ? (
                                    <><span>✓</span> Added to Cart!</>
                                ) : isUnavailable ? (
                                    <><ShoppingCart size={16} strokeWidth={2.5} /> Not Available</>
                                ) : (
                                    <><ShoppingCart size={16} strokeWidth={2.5} /> Add {qty > 1 ? `${qty} × ` : ""}to Cart · ₹{product.price * qty}</>
                                )}
                            </button>
                        </div>

                        {/* Mobile qty hint (visible above sticky bar) */}
                        <div className="mt-5 flex items-center gap-2 md:hidden">
                            <div className="flex items-center overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
                                <button
                                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                                    disabled={isUnavailable}
                                    className="flex h-11 w-11 items-center justify-center text-stone-500 transition-colors hover:bg-amber-50 hover:text-orange-500 disabled:opacity-30"
                                >
                                    <Minus size={13} strokeWidth={2.5} />
                                </button>
                                <span className="min-w-[2.5rem] border-x border-amber-200 px-2 text-center text-sm font-black text-stone-800">{qty}</span>
                                <button
                                    onClick={() => setQty((q) => Math.min(Math.min(10, product.stock), q + 1))}
                                    disabled={isUnavailable}
                                    className="flex h-11 w-11 items-center justify-center text-stone-500 transition-colors hover:bg-amber-50 hover:text-orange-500 disabled:opacity-30"
                                >
                                    <Plus size={13} strokeWidth={2.5} />
                                </button>
                            </div>
                            <p className="text-xs text-stone-400">Tap <span className="font-bold text-orange-500">Add to Cart</span> below to order</p>
                        </div>
                    </div>
                </div>

                {/* ════════════════════════════════════════
                    SECTION 2 — FREQUENTLY BOUGHT TOGETHER
                ════════════════════════════════════════ */}
                {upsellProducts.length > 0 && (
                    <section className="mt-16">
                        <div className="mb-5 flex items-center gap-3">
                            <div>
                                <h2 className="text-lg font-black text-stone-900 md:text-xl">Pairs Perfectly With</h2>
                                <p className="text-xs text-stone-400 mt-0.5">Customers who order this also love these</p>
                            </div>
                            <div className="h-px flex-1 bg-gradient-to-r from-amber-200 to-transparent" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                            {upsellProducts.map((p) => (
                                <UpsellCard key={p._id} product={p} />
                            ))}
                        </div>
                    </section>
                )}

                {/* ════════════════════════════════════════
                    SECTION 3 — YOU MAY ALSO LIKE
                ════════════════════════════════════════ */}
                {relatedProducts.length > 0 && (
                    <section className="mt-16 pb-32 md:pb-12">
                        <div className="mb-5 flex items-center gap-3">
                            <div>
                                <h2 className="text-lg font-black text-stone-900 md:text-xl">You Might Also Love</h2>
                                <p className="text-xs text-stone-400 mt-0.5">More from {normalizeCategory(product.category)}</p>
                            </div>
                            <div className="h-px flex-1 bg-gradient-to-r from-amber-200 to-transparent" />
                            <Link
                                href="/menu"
                                className="shrink-0 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-500 transition-all hover:bg-orange-100 hover:text-orange-600"
                            >
                                View All →
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                            {relatedProducts.map((p, i) => (
                                <ProductCard key={p._id} product={p} index={i} />
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* ════════════════════════════════════════
                STICKY MOBILE CTA BAR
            ════════════════════════════════════════ */}
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-amber-100 bg-white/97 px-4 py-3 backdrop-blur-md md:hidden shadow-xl shadow-stone-200/80">
                <div className="flex items-center gap-3">
                    {/* Qty picker */}
                    <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
                        <button
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                            disabled={isUnavailable}
                            className="flex h-11 w-11 items-center justify-center text-stone-500 transition-colors hover:bg-amber-50 hover:text-orange-500 disabled:opacity-30 active:scale-95"
                        >
                            <Minus size={13} strokeWidth={2.5} />
                        </button>
                        <span className="min-w-[2rem] border-x border-amber-200 px-2 text-center text-sm font-black text-stone-800">{qty}</span>
                        <button
                            onClick={() => setQty((q) => Math.min(Math.min(10, product.stock), q + 1))}
                            disabled={isUnavailable}
                            className="flex h-11 w-11 items-center justify-center text-stone-500 transition-colors hover:bg-amber-50 hover:text-orange-500 disabled:opacity-30 active:scale-95"
                        >
                            <Plus size={13} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Add to cart */}
                    <button
                        onClick={handleAddToCart}
                        disabled={isUnavailable || adding}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all duration-200 ${
                            isUnavailable
                                ? "cursor-not-allowed bg-stone-100 text-stone-400"
                                : adding
                                ? "bg-green-500 text-white shadow-lg shadow-green-200"
                                : "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200 active:scale-[0.98]"
                        }`}
                    >
                        {adding ? (
                            <><span>✓</span> Added to Cart!</>
                        ) : isUnavailable ? (
                            "Currently Unavailable"
                        ) : (
                            <><ShoppingCart size={15} strokeWidth={2.5} /> Add to Cart · ₹{product.price * qty}</>
                        )}
                    </button>
                </div>
                {/* Safe area spacer for phones with home indicator */}
                <div className="h-safe-area-inset-bottom" />
            </div>
        </main>
    );
}