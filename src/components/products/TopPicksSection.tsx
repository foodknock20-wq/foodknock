"use client";

// src/components/products/TopPicksSection.tsx
// next/image optimized — priority first 3, lazy rest

import { useRef } from "react";
import Image from "next/image";
import { useCartStore } from "@/store/cartStore";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight, Flame, ShoppingCart, Star } from "lucide-react";
import Link from "next/link";

type Product = {
    _id: string; name: string; slug: string; description: string;
    shortDescription?: string; price: number; compareAtPrice?: number | null;
    category: string; image: string; stock: number; isAvailable: boolean;
    isFeatured?: boolean; tags?: string[];
};

const FALLBACK = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=75&auto=format&fit=crop";

function TopPickCard({ product, index }: { product: Product; index: number }) {
    const addItem     = useCartStore(s => s.addItem);
    const unavailable = !product.isAvailable || product.stock <= 0;

    const saving = product.compareAtPrice && product.compareAtPrice > product.price
        ? Math.round(product.compareAtPrice - product.price)
        : null;

    const handleAdd = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (unavailable) return;
        addItem({
            _id: product._id, name: product.name, price: product.price,
            image: product.image, quantity: 1, stock: product.stock, category: product.category,
        });
        toast.success(`${product.name} added!`, {
            style: { background: "#fff7ed", color: "#7c2d12", border: "1px solid #fed7aa", borderRadius: "14px" },
        });
    };

    return (
        <Link
            href={`/menu/${product.slug}`}
            style={{ animationDelay: `${index * 60}ms`, minWidth: 220, maxWidth: 240 }}
            className={`fk-tp-card group relative flex shrink-0 flex-col overflow-hidden rounded-3xl bg-white transition-all duration-300 snap-start ${
                unavailable ? "opacity-60" : "hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-200/60"
            }`}>

            {/* Gradient accent bar */}
            <div className="h-1 w-full flex-shrink-0" style={{ background: "linear-gradient(90deg,#f97316,#ef4444,#f59e0b)" }} />

            {/* Image — fixed 176px height */}
            <div className="relative h-44 w-full flex-shrink-0 overflow-hidden bg-stone-50">
                <Image
                    src={product.image || FALLBACK}
                    alt={product.name}
                    fill
                    // First 3 are above fold in the slider — prioritize them
                    priority={index < 3}
                    loading={index < 3 ? "eager" : "lazy"}
                    // Good quality for hero-ish cards but not excessive
                    quality={75}
                    // Card is 220–240px wide — 240w is enough, 2x for retina = 480w
                    sizes="(max-width: 640px) 220px, 240px"
                    className={`object-cover transition-transform duration-500 ${
                        unavailable ? "grayscale-[40%]" : "group-hover:scale-[1.06]"
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
                    className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-black transition-all duration-200 ${
                        unavailable
                            ? "cursor-not-allowed bg-stone-100 text-stone-400"
                            : "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-200 hover:brightness-110 active:scale-[0.97]"
                    }`}>
                    <ShoppingCart size={12} strokeWidth={2.5} />
                    {unavailable ? "Unavailable" : "Add to Cart"}
                </button>
            </div>
        </Link>
    );
}

export default function TopPicksSection({ products }: { products: Product[] }) {
    const ref = useRef<HTMLDivElement>(null);

    const topPicks = products
        .filter(p =>
            p.tags?.some(t => ["top-picks", "top picks"].includes(t.toLowerCase().trim())) ||
            p.isFeatured
        )
        .slice(0, 12);

    if (topPicks.length === 0) return null;

    const scroll = (dir: "left" | "right") =>
        ref.current?.scrollBy({ left: dir === "left" ? -260 : 260, behavior: "smooth" });

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
                                Editor's Choice
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
                        {(["left", "right"] as const).map(dir => (
                            <button key={dir} onClick={() => scroll(dir)}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 bg-white text-stone-400 shadow-sm transition-all hover:border-orange-400 hover:bg-orange-50 hover:text-orange-500">
                                {dir === "left"
                                    ? <ChevronLeft  size={15} strokeWidth={2.5} />
                                    : <ChevronRight size={15} strokeWidth={2.5} />}
                            </button>
                        ))}
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

            <style jsx global>{`
                .fk-tp-card { animation: fkTPIn 0.4s ease both; }
                @keyframes fkTPIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </section>
    );
}