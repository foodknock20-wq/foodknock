"use client";

// src/components/products/ComboSection.tsx
// FoodKnock — Best Combos & Deals section
// Dark obsidian strip · ember accent cards · horizontal snap scroll · mobile-first

import { useRef } from "react";
import { useCartStore } from "@/store/cartStore";
import { toast } from "react-hot-toast";
import { ArrowRight, ChevronLeft, ChevronRight, Tag, Flame } from "lucide-react";
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

// Deterministic badge palette
const BADGES = [
    { label:"🔥 Best Deal",    from:"#e11d48", to:"#FF5C1A" },
    { label:"⚡ Hot Combo",    from:"#FF5C1A", to:"#FF8C42" },
    { label:"🏆 Most Popular", from:"#d97706", to:"#f59e0b" },
    { label:"💚 Save More",    from:"#059669", to:"#10b981" },
    { label:"🎯 Must Try",     from:"#7c3aed", to:"#a78bfa" },
    { label:"👑 Premium",      from:"#b45309", to:"#d97706" },
];
const getBadge = (_id: string, idx: number) => BADGES[idx % BADGES.length];

function getItemsLine(p: Product): string {
    if (p.shortDescription?.trim()) return p.shortDescription;
    if (p.tags?.length)             return p.tags.slice(0,4).join(" + ");
    return p.description.length > 62 ? p.description.slice(0,62)+"…" : p.description;
}

/* ── Individual Combo Card ── */
function ComboCard({ product, index }: { product: Product; index: number }) {
    const addItem     = useCartStore(s => s.addItem);
    const badge       = getBadge(product._id, index);
    const unavailable = !product.isAvailable || product.stock <= 0;

    const handleAdd = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (unavailable) { toast.error("This combo is currently unavailable"); return; }
        addItem({ _id:product._id, name:product.name, price:product.price,
                  image:product.image, quantity:1, stock:product.stock, category:product.category });
        toast.success(`${product.name} added! 🎉`, {
            style: { background:"#161210", color:"#fff", border:"1px solid rgba(255,92,26,0.3)", borderRadius:"14px" },
            iconTheme: { primary:"#FF5C1A", secondary:"#161210" },
        });
    };

    return (
        <Link href={`/menu/${product.slug}`}
              className={`fk-combo-card group relative flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 ${
                  unavailable
                      ? "opacity-60"
                      : "hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-200/50"
              }`}
              style={{
                  minWidth:234, maxWidth:268,
                  border:"1px solid rgba(255,92,26,0.14)",
                  boxShadow:"0 2px 12px rgba(0,0,0,0.07)",
              }}>
            {/* Accent bar */}
            <div className="h-[3px] w-full"
                 style={{ background:`linear-gradient(90deg,${badge.from},${badge.to})` }} />

            {/* Image */}
            <div className="relative h-40 w-full overflow-hidden bg-stone-100">
                <img src={product.image} alt={product.name} loading="lazy"
                     className={`h-full w-full object-cover transition-transform duration-500 ${
                         unavailable ? "grayscale-[40%]" : "group-hover:scale-[1.08]"
                     }`}
                     onError={e => {
                         (e.target as HTMLImageElement).src =
                             "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=75&auto=format&fit=crop";
                     }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                {/* Badge */}
                {!unavailable && (
                    <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-black text-white shadow-lg"
                         style={{ background:`linear-gradient(135deg,${badge.from},${badge.to})` }}>
                        {badge.label}
                    </div>
                )}

                {/* Unavailable overlay */}
                {unavailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                        <span className="rounded-full border border-stone-300 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-stone-500">
                            Unavailable
                        </span>
                    </div>
                )}

                {/* Price */}
                <div className="absolute bottom-2.5 right-2.5">
                    <div className="rounded-xl px-2.5 py-1 shadow-md"
                         style={{ background:"rgba(255,255,255,0.95)", backdropFilter:"blur(4px)" }}>
                        <span className="text-[15px] font-black" style={{ color:"#FF5C1A" }}>₹{product.price}</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col p-3.5">
                <h3 className="line-clamp-1 text-[14px] font-black leading-snug text-stone-900"
                    style={{ fontFamily:"'Playfair Display',Georgia,serif" }}>
                    {product.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-stone-400">
                    {getItemsLine(product)}
                </p>
                <div className="my-3 border-t border-dashed border-stone-100" />
                <button onClick={handleAdd} disabled={unavailable}
                        className={`w-full rounded-xl py-2.5 text-[12px] font-black transition-all duration-200 ${
                            unavailable
                                ? "cursor-not-allowed bg-stone-100 text-stone-400"
                                : "text-white active:scale-95"
                        }`}
                        style={ !unavailable ? {
                            background:`linear-gradient(135deg,${badge.from},${badge.to})`,
                            boxShadow:`0 4px 14px ${badge.from}40`,
                        } : {} }>
                    {unavailable ? "Unavailable" : "Add to Cart 🛒"}
                </button>
            </div>
        </Link>
    );
}

/* ── Section ── */
export default function ComboSection({ combos, onViewAll }: { combos: Product[]; onViewAll: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const scroll = (dir: "left"|"right") =>
        ref.current?.scrollBy({ left: dir === "left" ? -280 : 280, behavior:"smooth" });

    if (!combos.length) return null;

    return (
        <section className="relative overflow-hidden border-b border-stone-100"
                 style={{ background:"linear-gradient(160deg,#161210 0%,#1e1612 60%,#201814 100%)" }}>
            {/* Warm glows */}
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-20 blur-3xl"
                 style={{ background:"radial-gradient(circle,#FF5C1A,transparent 70%)" }} />
            <div aria-hidden className="pointer-events-none absolute -bottom-16 left-0 h-56 w-56 rounded-full opacity-10 blur-3xl"
                 style={{ background:"radial-gradient(circle,#FFB347,transparent 70%)" }} />
            {/* Top shimmer line */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
                 style={{ background:"linear-gradient(90deg,transparent,#FF5C1A 40%,#FF8C42 60%,transparent)" }} />

            <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">

                {/* Header */}
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg"
                             style={{ background:"linear-gradient(135deg,#e11d48,#FF5C1A)", boxShadow:"0 4px 16px rgba(225,29,72,0.4)" }}>
                            <Tag size={18} strokeWidth={2.5} className="text-white" />
                        </div>
                        <div>
                            <div className="mb-0.5 flex items-center gap-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400/80">
                                    Today&apos;s Deals
                                </p>
                                <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black text-white"
                                      style={{ background:"linear-gradient(135deg,#e11d48,#FF5C1A)" }}>
                                    <Flame size={8} /> HOT
                                </span>
                            </div>
                            <h2 className="text-xl font-black text-white md:text-2xl"
                                style={{ fontFamily:"'Playfair Display',Georgia,serif" }}>
                                Best Combos &amp; Deals
                            </h2>
                        </div>
                    </div>

                    {/* Desktop scroll + view-all */}
                    <div className="hidden items-center gap-2 md:flex">
                        {(["left","right"] as const).map(dir => (
                            <button key={dir} onClick={() => scroll(dir)}
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-all hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400">
                                {dir === "left"
                                    ? <ChevronLeft  size={15} strokeWidth={2.5} />
                                    : <ChevronRight size={15} strokeWidth={2.5} />}
                            </button>
                        ))}
                        <button onClick={onViewAll}
                                className="group flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/60 transition-all hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-400">
                            View All
                            <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                        </button>
                    </div>
                </div>

                {/* Savings teaser */}
                <div className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/5 px-4 py-2.5">
                    <span className="text-lg">💸</span>
                    <p className="text-[12px] font-semibold text-white/50">
                        Combos save you{" "}
                        <span className="font-black text-orange-400">15–30%</span>{" "}
                        vs ordering individually
                    </p>
                </div>

                {/* Horizontal scroll strip */}
                <div ref={ref}
                     className="no-scrollbar flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                    {combos.map((combo, i) => (
                        <div key={combo._id} className="shrink-0 snap-start">
                            <ComboCard product={combo} index={i} />
                        </div>
                    ))}

                    {/* View-all tile */}
                    <div className="shrink-0 snap-start flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-center transition-all hover:border-orange-500/30 hover:bg-orange-500/8"
                         style={{ minWidth:126 }}
                         onClick={onViewAll}>
                        <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl"
                             style={{ background:"linear-gradient(135deg,#FF5C1A,#FF8C42)", boxShadow:"0 4px 16px rgba(255,92,26,0.4)" }}>
                            <ArrowRight size={20} strokeWidth={2.5} className="text-white" />
                        </div>
                        <p className="text-[12px] font-black text-white/70">View All</p>
                        <p className="text-[12px] font-black text-orange-400">Combos</p>
                        <p className="mt-1 text-[10px] text-white/30">{combos.length} deals</p>
                    </div>
                </div>

                {/* Mobile view-all button */}
                <div className="mt-5 md:hidden">
                    <button onClick={onViewAll}
                            className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white/60 transition-all hover:border-orange-500/30 hover:text-orange-400">
                        See All {combos.length} Combos
                        <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                    </button>
                </div>
            </div>

            <style jsx global>{`
                .fk-combo-card { animation: fkComboIn 0.38s ease forwards; opacity: 0; }
                @keyframes fkComboIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
            `}</style>
        </section>
    );
}