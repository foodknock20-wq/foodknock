"use client";

// src/components/home/BestSellers.tsx
// NEW FEATURE: "🔥 Most Loved" best sellers section for homepage
// PATCH: cdnImage applied to all product card images — zero Vercel image optimizer usage

import Link from "next/link";
import { ArrowRight, Flame, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import type { HomeProduct } from "@/app/(main)/page";
import { cdnImage } from "@/lib/cdnImage";

const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=75&auto=format&fit=crop";

const CATEGORY_ACCENT: Record<string, { color: string; bg: string; emoji: string }> = {
    "Pizza": { color: "#f97316", bg: "rgba(249,115,22,0.08)", emoji: "🍕" },
    "Ice Cream": { color: "#a855f7", bg: "rgba(168,85,247,0.08)", emoji: "🍦" },
    "Thali": { color: "#16a34a", bg: "rgba(22,163,74,0.08)", emoji: "🍛" },
    "Momos": { color: "#ea580c", bg: "rgba(234,88,12,0.08)", emoji: "🥟" },
    "Sandwich": { color: "#16a34a", bg: "rgba(22,163,74,0.08)", emoji: "🥪" },
    "Shake": { color: "#2563eb", bg: "rgba(37,99,235,0.08)", emoji: "🥤" },
    "Burger": { color: "#d97706", bg: "rgba(217,119,6,0.08)", emoji: "🍔" },
    "Coffee": { color: "#92400e", bg: "rgba(146,64,14,0.08)", emoji: "☕" },
};

const getAccent = (category: string) =>
    CATEGORY_ACCENT[category] ?? { color: "#FF5C1A", bg: "rgba(255,92,26,0.08)", emoji: "🍽️" };

const FALLBACK_PRODUCTS: HomeProduct[] = [
    {
        _id: "f1", name: "Classic Smash Burger", category: "Burger",
        price: 149, compareAtPrice: 199, image: FALLBACK_IMAGE,
        shortDescription: "Double patty, cheddar, special sauce", isFeatured: true,
    },
    {
        _id: "f2", name: "Margherita Pizza", category: "Pizza",
        price: 199, compareAtPrice: 249, image: FALLBACK_IMAGE,
        shortDescription: "Fresh mozzarella, basil, tomato", isFeatured: true,
    },
    {
        _id: "f3", name: "Chocolate Shake", category: "Shake",
        price: 99, compareAtPrice: null, image: FALLBACK_IMAGE,
        shortDescription: "Rich Belgian chocolate blend", isFeatured: false,
    },
    {
        _id: "f4", name: "Steamed Momos (6pc)", category: "Momos",
        price: 89, compareAtPrice: 109, image: FALLBACK_IMAGE,
        shortDescription: "Stuffed with veggies & spices", isFeatured: false,
    },
];

interface BestSellersProps {
    products: HomeProduct[];
}

function BestSellerCard({
    product,
    rank,
}: {
    product: HomeProduct;
    rank: number;
}) {
    const accent = getAccent(product.category);
    const hasDiscount =
        typeof product.compareAtPrice === "number" &&
        product.compareAtPrice > product.price;
    const discountPct = hasDiscount
        ? Math.round(
            ((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100
        )
        : null;

    const menuHref = `/menu?category=${encodeURIComponent(product.category)}`;

    // PATCH: cdnImage(url, 400) — card images are small; 400px is plenty, served direct from Cloudinary CDN
    const imageSrc = cdnImage(product.image ?? FALLBACK_IMAGE, 400);

    return (
        <Link
            href={menuHref}
            className="fk-bs-card group relative flex shrink-0 flex-col overflow-hidden rounded-2xl bg-white"
            style={{
                border: "1px solid rgba(0,0,0,0.07)",
                boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                width: "clamp(148px, 40vw, 180px)",
                touchAction: "auto",
            }}
        >
            {/* Rank badge */}
            <div
                className="absolute left-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black text-white shadow-md"
                style={{
                    background:
                        rank === 1
                            ? "linear-gradient(135deg,#FF5C1A,#FF8C42)"
                            : rank === 2
                                ? "linear-gradient(135deg,#d97706,#f59e0b)"
                                : "linear-gradient(135deg,#64748b,#94a3b8)",
                    pointerEvents: "none",
                }}
            >
                {rank === 1 ? "🔥" : rank}
            </div>

            {/* Image — PATCH: native <img> with cdnImage; no next/image optimizer involvement */}
            <div className="relative h-36 w-full overflow-hidden bg-stone-100 sm:h-40">
                <img
                    src={imageSrc}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
                    style={{ pointerEvents: "none" }}
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                    }}
                />
                <div
                    className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
                    style={{ pointerEvents: "none" }}
                />

                {discountPct !== null && (
                    <div
                        className="absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-black text-white shadow-sm"
                        style={{
                            background: "linear-gradient(135deg,#10b981,#059669)",
                            pointerEvents: "none",
                        }}
                    >
                        {discountPct}% OFF
                    </div>
                )}

                {product.isFeatured && (
                    <div
                        className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-black text-white"
                        style={{
                            background: "linear-gradient(135deg,#FF5C1A,#FF8C42)",
                            pointerEvents: "none",
                        }}
                    >
                        <Flame size={8} strokeWidth={3} />
                        Hot
                    </div>
                )}

                <div
                    className="absolute bottom-2 right-2 rounded-xl bg-white/94 px-2 py-0.5 text-[12px] font-black shadow backdrop-blur-sm sm:hidden"
                    style={{ color: accent.color, pointerEvents: "none" }}
                >
                    ₹{product.price}
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col p-3">
                <span
                    className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
                    style={{
                        background: accent.bg,
                        color: accent.color,
                        border: `1px solid ${accent.color}22`,
                    }}
                >
                    {accent.emoji} {product.category}
                </span>

                <h3
                    className="line-clamp-2 text-[12.5px] font-black leading-snug text-stone-900"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                    {product.name}
                </h3>

                {product.shortDescription && (
                    <p className="mt-0.5 line-clamp-1 text-[10.5px] text-stone-400">
                        {product.shortDescription}
                    </p>
                )}

                <div className="mt-auto hidden items-baseline gap-1.5 pt-2.5 sm:flex">
                    <span
                        className="text-[14px] font-black"
                        style={{ color: accent.color }}
                    >
                        ₹{product.price}
                    </span>
                    {hasDiscount && (
                        <span className="text-[10px] text-stone-400 line-through">
                            ₹{product.compareAtPrice}
                        </span>
                    )}
                </div>

                <div
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-black text-white transition-all duration-200 group-hover:brightness-110"
                    style={{
                        background: `linear-gradient(135deg, ${accent.color}, ${accent.color}cc)`,
                        boxShadow: `0 2px 8px ${accent.color}30`,
                    }}
                >
                    Order Now
                </div>
            </div>
        </Link>
    );
}

export default function BestSellers({ products }: BestSellersProps) {
    const displayProducts = useMemo(() => {
        const list = products.length > 0 ? products : FALLBACK_PRODUCTS;
        return list.slice(0, 10);
    }, [products]);

    if (displayProducts.length === 0) return null;

    return (
        <section className="border-b border-amber-100/80 bg-[#FFFBF5] py-14 md:py-18">
            <div className="mx-auto max-w-7xl px-4 md:px-8">
                <div className="mb-8 flex items-end justify-between">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5">
                            <TrendingUp size={11} className="text-rose-600" />
                            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-600">
                                Most Loved
                            </span>
                        </div>
                        <h2
                            className="text-2xl font-black text-stone-900 md:text-3xl"
                            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                        >
                            🔥 What Everyone&apos;s Ordering
                        </h2>
                        <p className="mt-1.5 text-sm text-stone-500">
                            Our most-ordered items — loved by thousands of customers.
                        </p>
                    </div>

                    <Link
                        href="/menu"
                        className="group hidden items-center gap-1.5 text-sm font-bold text-amber-700 transition-colors hover:text-orange-600 md:inline-flex"
                    >
                        See Full Menu{" "}
                        <ArrowRight
                            size={13}
                            className="transition-transform group-hover:translate-x-0.5"
                        />
                    </Link>
                </div>

                {/* Mobile: horizontal scroll */}
                <div
                    className="no-scrollbar flex gap-3 overflow-x-auto pb-2 md:hidden"
                    style={{
                        scrollSnapType: "x mandatory",
                        touchAction: "pan-x pan-y",
                        WebkitOverflowScrolling: "touch",
                    }}
                >
                    {displayProducts.map((product, i) => (
                        <div
                            key={product._id}
                            className="shrink-0 snap-start"
                            style={{ touchAction: "pan-x pan-y" }}
                        >
                            <BestSellerCard product={product} rank={i + 1} />
                        </div>
                    ))}
                </div>

                {/* Desktop: responsive grid */}
                <div className="hidden gap-4 md:grid md:grid-cols-4 lg:grid-cols-5">
                    {displayProducts.map((product, i) => (
                        <div key={product._id} style={{ width: "100%" }}>
                            <BestSellerCard product={product} rank={i + 1} />
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex justify-center md:hidden">
                    <Link
                        href="/menu"
                        className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-6 py-2.5 text-sm font-bold text-stone-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                    >
                        See Full Menu <ArrowRight size={13} />
                    </Link>
                </div>
            </div>

            <style jsx global>{`
                .fk-bs-card:hover {
                    box-shadow: 0 12px 36px rgba(255, 92, 26, 0.14),
                        0 0 0 1px rgba(255, 92, 26, 0.1);
                    transform: translateY(-2px);
                }
                .fk-bs-card {
                    transition: transform 0.25s ease, box-shadow 0.25s ease;
                }
            `}</style>
        </section>
    );
}