"use client";

// src/components/products/CategorySlider.tsx
// next/image optimized — Vercel bandwidth friendly

import { useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ── Category config ──────────────────────────────────────────────────────────
// Replace any URL with your Cloudinary link later — only change here
const CAT_CONFIG: Record<string, { image: string; accent: string; label: string }> = {
    all: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773952907/foodknock/products/ko6diantlifvrv16fdal.jpg",
        accent: "#f97316",
        label:  "All",
    },
    combos: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773953355/ChatGPT_Image_Mar_20_2026_02_18_53_AM_g7hert.png",
        accent: "#e11d48",
        label:  "Combos",
    },
    pizza: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773931399/foodknock/products/xhlywcqzo0fgwwdxa8id.jpg",
        accent: "#f97316",
        label:  "Pizza",
    },
    burger: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773925722/foodknock/products/ochghfubzkruolrb4ggu.jpg",
        accent: "#d97706",
        label:  "Burger",
    },
    sandwich: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773932309/foodknock/products/ppefuhohguvfmd91lbjf.jpg",
        accent: "#16a34a",
        label:  "Sandwich",
    },
    coffee: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773931773/foodknock/products/dfpzqgcjxmnlhjuinxpo.jpg",
        accent: "#92400e",
        label:  "Coffee",
    },
    juice: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773931773/foodknock/products/dfpzqgcjxmnlhjuinxpo.jpg",
        accent: "#16a34a",
        label:  "Juice",
    },
    shake: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773931823/foodknock/products/q1m2ysvg1ia2offh5mgn.jpg",
        accent: "#2563eb",
        label:  "Shake",
    },
    "ice cream": {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773953301/Screenshot_2026-03-20_021758_ecb6v0.png",
        accent: "#a855f7",
        label:  "Ice Cream",
    },
    momos: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773930261/foodknock/products/rxrmisuiklzwyn9oldwe.jpg",
        accent: "#ea580c",
        label:  "Momos",
    },
    fries: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773929303/foodknock/products/isipjpgf7klg2vtrtzy3.jpg",
        accent: "#ca8a04",
        label:  "Fries",
    },
    pasta: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773930445/foodknock/products/criyulvvdzaqoxv57vvi.jpg",
        accent: "#ea580c",
        label:  "Pasta",
    },
    noodles: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773953447/Let_s_make_crispy_chow_mein_noodles_tossed_in_a_m1ewd8.jpg",
        accent: "#d97706",
        label:  "Noodles",
    },
    maggi: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773929812/foodknock/products/a90ubocuhw8swmjaovom.jpg",
        accent: "#b45309",
        label:  "Maggi",
    },
    tea: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773953504/Qatar_s_most_loved_tea_strong_black_tea_brewed_osouhe.jpg",
        accent: "#15803d",
        label:  "Tea",
    },
    snacks: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773930661/foodknock/products/w59zxcc0mmclexgh9upl.jpg",
        accent: "#f97316",
        label:  "Snacks",
    },
    chinese: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773928655/foodknock/products/ouvxufr7bapazmgfwdl8.jpg",
        accent: "#dc2626",
        label:  "Chinese",
    },
    pavbhaji: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773925149/foodknock/products/vgowppmw8u8awprv4sjk.jpg",
        accent: "#ea580c",
        label:  "Pav Bhaji",
    },
    patties: {
        image:  "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773925644/foodknock/products/us1vuswyw1qn65qa0zio.jpg",
        accent: "#16a34a",
        label:  "Patties",
    },
};

const FALLBACK_IMAGE = "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773953868/WhatsApp_Image_2026-03-15_at_13.17.10-removebg-preview_ksiduq.png";
const getCfg = (cat: string) =>
    CAT_CONFIG[cat.toLowerCase()] ?? { image: FALLBACK_IMAGE, accent: "#f97316", label: cat };

interface Props {
    categories:     string[];
    activeCategory: string;
    onSelect:       (cat: string) => void;
    productCounts:  Record<string, number>;
}

export default function CategorySlider({ categories, activeCategory, onSelect, productCounts }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const nudge = (dir: "l" | "r") =>
        scrollRef.current?.scrollBy({ left: dir === "l" ? -220 : 220, behavior: "smooth" });

    return (
        // NOT sticky — scrolls with the page
        <section className="relative border-b border-stone-100 bg-white py-5 shadow-sm md:py-6">
            <div className="mx-auto max-w-7xl px-4 md:px-8">

                {/* Header row */}
                <div className="mb-3.5 flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-stone-400">
                        Browse Categories
                    </p>
                    <div className="hidden items-center gap-1.5 md:flex">
                        {(["l", "r"] as const).map(dir => (
                            <button key={dir} onClick={() => nudge(dir)}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500 active:scale-90">
                                {dir === "l"
                                    ? <ChevronLeft  size={13} strokeWidth={2.5} />
                                    : <ChevronRight size={13} strokeWidth={2.5} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Scroll track */}
                <div ref={scrollRef}
                    className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1"
                    style={{ scrollSnapType: "x mandatory" }}>

                    {categories.map((cat, idx) => {
                        const cfg    = getCfg(cat);
                        const active = cat === activeCategory;
                        const count  = productCounts[cat] ?? 0;
                        const label  = cfg.label || cat;

                        return (
                            <button
                                key={cat}
                                onClick={() => onSelect(cat)}
                                aria-pressed={active}
                                style={{
                                    scrollSnapAlign: "start",
                                    animationDelay:  `${idx * 30}ms`,
                                    ...(active ? {
                                        background: "#ffffff",
                                        boxShadow:  `0 4px 20px ${cfg.accent}28, 0 1px 4px rgba(0,0,0,0.07)`,
                                        outline:    `2px solid ${cfg.accent}45`,
                                    } : {}),
                                }}
                                className={`fk-cat-btn group relative flex shrink-0 flex-col items-center gap-2 rounded-2xl p-2 transition-all duration-200 focus:outline-none active:scale-[0.94] ${
                                    active
                                        ? "bg-white shadow-lg"
                                        : "bg-white/60 hover:bg-white hover:shadow-md"
                                }`}>

                                {/* Food image — next/image with fixed size */}
                                <div
                                    className="relative h-16 w-16 overflow-hidden rounded-[18px] md:h-[72px] md:w-[72px]"
                                    style={{
                                        boxShadow:  active ? `0 6px 20px ${cfg.accent}40` : "0 2px 8px rgba(0,0,0,0.10)",
                                        transform:  active ? "scale(1.06)" : "scale(1)",
                                        transition: "transform 0.25s ease, box-shadow 0.25s ease",
                                    }}>
                                    <Image
                                        src={cfg.image}
                                        alt={label}
                                        fill
                                        // Category images are small & many — lazy load all except first 6
                                        loading={idx < 6 ? "eager" : "lazy"}
                                        // Small rounded squares — no need for high quality
                                        quality={65}
                                        sizes="72px"
                                        className={`object-cover transition-transform duration-500 ${
                                            active ? "" : "group-hover:scale-[1.1]"
                                        }`}
                                    />
                                    {/* Overlay */}
                                    <div
                                        className="absolute inset-0 pointer-events-none"
                                        style={{
                                            background: active
                                                ? `linear-gradient(160deg,${cfg.accent}22 0%,transparent 60%)`
                                                : "linear-gradient(160deg,rgba(255,255,255,0.06) 0%,transparent 60%)",
                                        }}
                                    />
                                    {/* Active dot */}
                                    {active && (
                                        <div
                                            className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full border-2 border-white shadow-sm"
                                            style={{ background: cfg.accent }}
                                        />
                                    )}
                                </div>

                                {/* Label + count */}
                                <div className="flex flex-col items-center gap-0.5">
                                    <span
                                        className="max-w-[72px] text-center text-[10.5px] font-black leading-tight"
                                        style={{ color: active ? cfg.accent : "#44403c" }}>
                                        {label}
                                    </span>
                                    {count > 0 && (
                                        <span
                                            className="rounded-full px-1.5 py-[1.5px] text-[8.5px] font-black leading-none transition-colors"
                                            style={{
                                                background: active ? cfg.accent : "#f5f5f4",
                                                color:      active ? "#fff"      : "#78716c",
                                            }}>
                                            {count}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <style jsx global>{`
                .fk-cat-btn { animation: fkCatBtnIn 0.35s ease both; }
                @keyframes fkCatBtnIn {
                    from { opacity: 0; transform: translateY(8px) scale(0.95); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </section>
    );
}