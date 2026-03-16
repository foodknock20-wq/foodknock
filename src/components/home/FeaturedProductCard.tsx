"use client";

// src/components/home/FeaturedProductCard.tsx

import Link from "next/link";
import { ShoppingBag, TrendingUp, Flame } from "lucide-react";
import type { HomeProduct } from "@/app/(main)/page";

const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=75&auto=format&fit=crop";

export default function FeaturedProductCard({ product }: { product: HomeProduct }) {
    const hasDiscount =
        typeof product.compareAtPrice === "number" && product.compareAtPrice > product.price;

    const saving = hasDiscount
        ? Math.round(product.compareAtPrice! - product.price)
        : null;

    const discountPct = hasDiscount
        ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
        : null;

    return (
        <Link href="/menu" className="block">
            <div
                className="group relative flex flex-col overflow-hidden rounded-[20px] bg-white transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                style={{
                    boxShadow: "0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                        "0 12px 40px rgba(255,92,26,0.15), 0 0 0 1px rgba(255,92,26,0.12)";
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                        "0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)";
                }}
            >
                {/* ── Image area ── */}
                <div className="relative h-40 w-full overflow-hidden bg-stone-100 sm:h-44 md:h-48">
                    <img
                        src={product.image ?? FALLBACK_IMAGE}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.08]"
                        loading="lazy"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                        }}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                    <span className="absolute left-2.5 top-2.5 rounded-full border border-white/40 bg-black/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-md">
                        {product.category}
                    </span>

                    {product.isFeatured && (
                        <span
                            className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black text-white"
                            style={{ background: "linear-gradient(135deg, #FF5C1A, #FF8C42)" }}
                        >
                            <Flame size={9} strokeWidth={3} />
                            Popular
                        </span>
                    )}

                    {discountPct !== null && (
                        <span
                            className="absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-1 text-[10px] font-black text-white"
                            style={{
                                background: "linear-gradient(135deg, #10b981, #059669)",
                                boxShadow: "0 2px 8px rgba(16,185,129,0.4)",
                            }}
                        >
                            {discountPct}% OFF
                        </span>
                    )}
                </div>

                {/* ── Content area ── */}
                <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                    <h3
                        className="line-clamp-1 font-black leading-snug text-stone-900"
                        style={{
                            fontSize: "clamp(0.82rem, 2.5vw, 0.95rem)",
                            fontFamily: "'Playfair Display', Georgia, serif",
                        }}
                    >
                        {product.name}
                    </h3>

                    {(product.shortDescription || product.description) && (
                        <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-stone-400">
                            {product.shortDescription || product.description}
                        </p>
                    )}

                    <div className="mt-auto flex items-end justify-between pt-3.5">
                        <div className="flex flex-col gap-0.5 leading-none">
                            <div className="flex items-baseline gap-1.5">
                                <span
                                    className="font-black text-stone-900"
                                    style={{
                                        fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)",
                                        color: "#FF5C1A",
                                    }}
                                >
                                    ₹{product.price}
                                </span>

                                {hasDiscount && (
                                    <span className="text-[12px] font-medium text-stone-300 line-through">
                                        ₹{product.compareAtPrice}
                                    </span>
                                )}
                            </div>

                            {saving !== null && (
                                <span className="text-[10px] font-bold text-emerald-500">
                                    You save ₹{saving}
                                </span>
                            )}
                        </div>

                        {/* Order button visual only */}
                        <span
                            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-black text-white transition-all duration-200"
                            style={{
                                background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)",
                                boxShadow: "0 3px 10px rgba(255,92,26,0.35)",
                                minHeight: "34px",
                            }}
                        >
                            <ShoppingBag size={11} strokeWidth={2.5} />
                            Order
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}