"use client";

// src/components/products/ProductCard.tsx
// FoodKnock — Premium product card (regular + combo variants)
// Ember CTA · Playfair Display name · mobile price overlay · mobile-first

import { toast } from "react-hot-toast";
import { useCartStore } from "@/store/cartStore";
import { ShoppingCart, Plus, Tag, Flame } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

type Product = {
    _id:             string;
    name:            string;
    slug:            string;
    description:     string;
    shortDescription?: string;
    price:           number;
    compareAtPrice?: number | null;
    category:        string;
    image:           string;
    stock:           number;
    isAvailable:     boolean;
    isFeatured?:     boolean;
    tags?:           string[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function hasDiscount(price: number, cap?: number | null): cap is number {
    return typeof cap === "number" && cap > price;
}
function saving(price: number, cap?: number | null): number | null {
    return hasDiscount(price, cap) ? Math.round(cap - price) : null;
}
function discPct(price: number, cap?: number | null): number | null {
    if (!hasDiscount(price, cap)) return null;
    return Math.round(((cap - price) / cap) * 100);
}
const normalize = (cat: string) => cat.trim().replace(/\b\w/g, c => c.toUpperCase());

// Deterministic product badge (shown top-left on image)
const PROD_BADGES = [
    { label:"🔥 Hot Pick",     bg:"#FF5C1A", text:"#fff"      },
    { label:"⭐ Chef's Pick",   bg:"#d97706", text:"#fff"      },
    { label:"✓ Fan Favourite", bg:"#059669", text:"#fff"      },
    { label:"💥 Must Try",     bg:"#7c3aed", text:"#fff"      },
];
const getProdBadge = (id: string): typeof PROD_BADGES[0] | null => {
    const n = parseInt(id.slice(-2), 16) % 7;
    return n < PROD_BADGES.length ? PROD_BADGES[n] : null;
};

// Deterministic combo badge
const COMBO_BADGES = [
    { label:"🔥 Best Deal",    from:"#e11d48", to:"#FF5C1A" },
    { label:"⚡ Hot Combo",    from:"#FF5C1A", to:"#FF8C42" },
    { label:"🏆 Most Popular", from:"#d97706", to:"#f59e0b" },
    { label:"💚 Save More",    from:"#059669", to:"#10b981" },
    { label:"🎯 Must Try",     from:"#7c3aed", to:"#a78bfa" },
    { label:"👑 Premium",      from:"#b45309", to:"#d97706" },
];
const getComboBadge = (id: string) => COMBO_BADGES[parseInt(id.slice(-3), 16) % COMBO_BADGES.length];

// ─── Sub-components ────────────────────────────────────────────────────────

/** Desktop price block (hidden on mobile — price shown as overlay on image instead) */
function PriceBlock({ price, compareAtPrice }: { price: number; compareAtPrice?: number | null }) {
    const sv = saving(price, compareAtPrice);
    return (
        <div className="hidden flex-col gap-0.5 leading-none sm:flex">
            <div className="flex items-baseline gap-1.5">
                <span className="text-[1.05rem] font-black md:text-[1.15rem]" style={{ color:"#FF5C1A" }}>
                    ₹{price}
                </span>
                {hasDiscount(price, compareAtPrice) && (
                    <span className="text-[11px] font-medium text-stone-400 line-through">₹{compareAtPrice}</span>
                )}
            </div>
            {sv !== null && (
                <span className="text-[9.5px] font-bold text-emerald-600">Save ₹{sv}</span>
            )}
        </div>
    );
}

/** Mobile price overlay — shown bottom-right inside image area */
function MobilePrice({ price, compareAtPrice }: { price: number; compareAtPrice?: number | null }) {
    return (
        <div className="absolute bottom-2 right-2 flex flex-col items-end gap-0.5 sm:hidden">
            <span className="rounded-xl px-2 py-0.5 text-[13px] font-black shadow-sm"
                  style={{ background:"rgba(255,255,255,0.94)", backdropFilter:"blur(4px)", color:"#FF5C1A" }}>
                ₹{price}
            </span>
            {hasDiscount(price, compareAtPrice) && (
                <span className="rounded-lg px-1.5 py-0.5 text-[9px] font-bold text-stone-500 line-through"
                      style={{ background:"rgba(255,255,255,0.80)", backdropFilter:"blur(4px)" }}>
                    ₹{compareAtPrice}
                </span>
            )}
        </div>
    );
}

/** Shared Add-to-cart button */
function AddBtn({
    unavailable, adding, isCombo, onClick, name,
}: {
    unavailable: boolean; adding: boolean; isCombo: boolean;
    onClick: (e: React.MouseEvent) => void; name: string;
}) {
    const active = isCombo
        ? { background:"linear-gradient(135deg,#e11d48,#FF5C1A)", boxShadow:"0 4px 14px rgba(225,29,72,0.3)" }
        : { background:"linear-gradient(135deg,#FF5C1A,#FF8C42)", boxShadow:"0 4px 14px rgba(255,92,26,0.3)" };

    return (
        <button onClick={onClick} disabled={unavailable || adding} aria-label={`Add ${name} to cart`}
                className={`group/btn flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-black transition-all duration-200 sm:gap-1.5 sm:px-3.5 sm:text-[12px] ${
                    unavailable
                        ? "cursor-not-allowed border border-stone-200 bg-stone-100 text-stone-400"
                        : adding
                            ? "scale-95 text-white"
                            : "text-white active:scale-95"
                }`}
                style={ unavailable ? {} : adding
                    ? { background:"#10b981", boxShadow:"0 4px 14px rgba(16,185,129,0.4)" }
                    : active }>
            {adding ? (
                <><span className="text-xs">✓</span><span className="hidden sm:inline">Added!</span></>
            ) : unavailable ? (
                <><ShoppingCart size={11} strokeWidth={2.5} /><span className="hidden sm:inline">Sold Out</span></>
            ) : (
                <>
                    <Plus size={12} strokeWidth={3}
                          className="transition-transform duration-200 group-hover/btn:scale-125" />
                    <span className="hidden sm:inline">Add</span>
                    <ShoppingCart size={11} strokeWidth={2.5} className="sm:hidden" />
                </>
            )}
        </button>
    );
}

// ─── Main export ───────────────────────────────────────────────────────────
export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
    const addItem     = useCartStore(s => s.addItem);
    const unavailable = !product.isAvailable || product.stock <= 0;
    const [adding, setAdding] = useState(false);

    const isCombo    = product.category.trim().toLowerCase() === "combos";
    const comboBadge = isCombo ? getComboBadge(product._id) : null;
    const prodBadge  = !isCombo ? getProdBadge(product._id) : null;
    const pct        = discPct(product.price, product.compareAtPrice);

    const blurb = isCombo
        ? (product.shortDescription?.trim() || product.tags?.slice(0,4).join(" + ") || product.description.slice(0,58))
        : (product.shortDescription ?? product.description);

    const handleAdd = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (unavailable) { toast.error("This item is currently unavailable"); return; }
        setAdding(true);
        addItem({ _id:product._id, name:product.name, price:product.price,
                  image:product.image, quantity:1, stock:product.stock, category:product.category });
        toast.success(`${product.name} added! 🛒`, {
            style: { background:"#fff7ed", color:"#7c2d12", border:"1px solid rgba(255,92,26,0.22)", borderRadius:"14px" },
            iconTheme: { primary:"#FF5C1A", secondary:"#fff7ed" },
        });
        setTimeout(() => setAdding(false), 700);
    };

    // ══════════════════════════════
    // COMBO CARD
    // ══════════════════════════════
    if (isCombo) {
        return (
            <Link href={`/menu/${product.slug}`}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 sm:rounded-3xl ${
                      unavailable
                          ? "opacity-65"
                          : "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-100/60"
                  }`}
                  style={{ border:"1.5px solid rgba(255,92,26,0.14)", boxShadow:"0 2px 10px rgba(0,0,0,0.05)",
                           animationDelay:`${index*40}ms` }}>

                {/* Accent top bar */}
                <div className="h-[3px] w-full"
                     style={{ background:`linear-gradient(90deg,${comboBadge!.from},${comboBadge!.to})` }} />

                {/* Image */}
                <div className="relative h-36 w-full shrink-0 overflow-hidden bg-stone-100 sm:h-44 md:h-48">
                    <img src={product.image} alt={product.name} loading="lazy"
                         className={`h-full w-full object-cover transition-transform duration-500 ${
                             unavailable ? "grayscale-[45%]" : "group-hover:scale-[1.07]"
                         }`}
                         onError={e => {
                             (e.target as HTMLImageElement).src =
                                 "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=75&auto=format&fit=crop";
                         }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

                    {unavailable && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-[2px]">
                            <span className="rounded-full border border-stone-300 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-stone-500 shadow-sm">
                                Unavailable
                            </span>
                        </div>
                    )}

                    {comboBadge && !unavailable && (
                        <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-black text-white shadow-md"
                             style={{ background:`linear-gradient(135deg,${comboBadge.from},${comboBadge.to})` }}>
                            {comboBadge.label}
                        </div>
                    )}

                    <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 shadow-sm backdrop-blur-sm">
                        <Tag size={9} strokeWidth={2.5} style={{ color:"#e11d48" }} />
                        <span className="text-[9px] font-black" style={{ color:"#e11d48" }}>COMBO</span>
                    </div>

                    <MobilePrice price={product.price} compareAtPrice={product.compareAtPrice} />
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-3 sm:p-4">
                    <div className="mb-1.5 flex items-center justify-between gap-1">
                        <span className="truncate rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                              style={{ background:"rgba(225,29,72,0.07)", color:"#e11d48", border:"1px solid rgba(225,29,72,0.18)" }}>
                            Combo Deal
                        </span>
                        <span className={`flex shrink-0 items-center gap-1 text-[9.5px] font-bold ${!unavailable ? "text-green-600" : "text-red-400"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${!unavailable ? "bg-green-500" : "bg-red-400"}`} />
                            {!unavailable ? "Available" : "Out"}
                        </span>
                    </div>

                    <h3 className="line-clamp-2 text-[13.5px] font-black leading-snug text-stone-900 sm:text-[0.92rem] md:text-[0.95rem]"
                        style={{ fontFamily:"'Playfair Display',Georgia,serif" }}>
                        {product.name}
                    </h3>

                    {blurb && (
                        <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-stone-400">{blurb}</p>
                    )}

                    <div className="my-2.5 border-t border-dashed border-stone-100" />

                    <div className="mt-auto flex items-center justify-between gap-2">
                        <PriceBlock price={product.price} compareAtPrice={product.compareAtPrice} />
                        <AddBtn unavailable={unavailable} adding={adding} isCombo name={product.name} onClick={handleAdd} />
                    </div>
                </div>
            </Link>
        );
    }

    // ══════════════════════════════
    // REGULAR PRODUCT CARD
    // ══════════════════════════════
    return (
        <Link href={`/menu/${product.slug}`}
              className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 sm:rounded-3xl ${
                  unavailable
                      ? "opacity-65"
                      : "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-100/60"
              }`}
              style={{ border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 2px 10px rgba(0,0,0,0.04)",
                       animationDelay:`${index*40}ms` }}>

            {/* Image */}
            <div className="relative h-36 w-full shrink-0 overflow-hidden bg-stone-100 sm:h-44 md:h-48">
                <img src={product.image} alt={product.name} loading="lazy"
                     className={`h-full w-full object-cover transition-transform duration-500 ${
                         unavailable ? "grayscale-[45%]" : "group-hover:scale-[1.07]"
                     }`}
                     onError={e => {
                         (e.target as HTMLImageElement).src =
                             "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=75&auto=format&fit=crop";
                     }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-transparent" />

                {unavailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-[2px]">
                        <span className="rounded-full border border-stone-300 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-stone-500 shadow-sm">
                            Unavailable
                        </span>
                    </div>
                )}

                {/* Product badge (top-left) */}
                {prodBadge && !unavailable && (
                    <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-black shadow-md"
                         style={{ background:prodBadge.bg, color:prodBadge.text }}>
                        {prodBadge.label}
                    </div>
                )}

                {/* Discount % (top-right) */}
                {pct !== null && (
                    <div className="absolute right-2.5 top-2.5 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9.5px] font-black text-white shadow-sm"
                         style={{ background:"linear-gradient(135deg,#10b981,#059669)" }}>
                        {pct}% OFF
                    </div>
                )}

                {/* Featured flame (top-right, if no discount) */}
                {product.isFeatured && pct === null && !prodBadge && (
                    <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black text-white shadow-sm"
                         style={{ background:"linear-gradient(135deg,#FF5C1A,#FF8C42)" }}>
                        <Flame size={9} strokeWidth={2.5} /> Popular
                    </div>
                )}

                <MobilePrice price={product.price} compareAtPrice={product.compareAtPrice} />
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col p-3 sm:p-4">
                {/* Category + availability */}
                <div className="mb-2 flex items-center justify-between gap-1">
                    <span className="truncate rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                          style={{ background:"rgba(255,92,26,0.07)", color:"#FF5C1A", border:"1px solid rgba(255,92,26,0.15)" }}>
                        {normalize(product.category)}
                    </span>
                    <span className={`flex shrink-0 items-center gap-1 text-[9.5px] font-bold ${!unavailable ? "text-green-600" : "text-red-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${!unavailable ? "bg-green-500" : "bg-red-400"}`} />
                        {!unavailable ? "Available" : "Out"}
                    </span>
                </div>

                {/* Name */}
                <h3 className="line-clamp-2 text-[13.5px] font-black leading-snug text-stone-900 sm:text-[0.92rem] md:text-[0.95rem]"
                    style={{ fontFamily:"'Playfair Display',Georgia,serif" }}>
                    {product.name}
                </h3>

                {/* Short description — desktop only */}
                {(product.shortDescription || product.description) && (
                    <p className="mt-1 hidden line-clamp-1 text-[10.5px] leading-relaxed text-stone-400 sm:block">
                        {product.shortDescription ?? product.description}
                    </p>
                )}

                {/* Price + CTA */}
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <PriceBlock price={product.price} compareAtPrice={product.compareAtPrice} />
                    <AddBtn unavailable={unavailable} adding={adding} isCombo={false} name={product.name} onClick={handleAdd} />
                </div>
            </div>
        </Link>
    );
}