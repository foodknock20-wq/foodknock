"use client";

// src/components/products/CategorySlider.tsx
// PERF:
//   - Next/Image replaced with native <img> + cdnImage() — zero Vercel transformations
//   - React.memo, useCallback
//   - scroll-snap preserved, touch-action preserved
//   - will-change: auto (reduced GPU memory pressure)

import { useRef, useCallback, memo } from "react";
import { cdnImage } from "@/lib/cdnImage";
// FoodKnock UI 2.0 — Phase 2 bug fix: this static config + getCfg() used to
// be defined inline here and exported from this "use client" module. Server
// Components (CategoryRail.tsx, (main)/page.tsx) can't import a plain
// value/function from a client-boundary module — only render it as JSX —
// which caused a runtime "Attempted to call getCfg() from the server"
// error. Moved to the neutral, server-safe src/lib/categoryConfig.ts;
// imported here unchanged, not duplicated.
import { getCfg } from "@/lib/categoryConfig";

interface Props {
    categories: string[];
    activeCategory: string;
    onSelect: (cat: string) => void;
    productCounts: Record<string, number>;
}

interface ItemProps {
    cat: string;
    idx: number;
    active: boolean;
    count: number;
    onSelect: (cat: string) => void;
}

const CategoryItem = memo(function CategoryItem({ cat, idx, active, count, onSelect }: ItemProps) {
    const cfg = getCfg(cat);
    const label = cfg.label || cat;

    // PERF: cdnImage at 80px for tiny category thumbnails
    const imgSrc = cdnImage(cfg.image, 80);

    const handleClick = useCallback(() => onSelect(cat), [cat, onSelect]);

    return (
        <button
            onClick={handleClick}
            aria-pressed={active}
            style={{
                scrollSnapAlign: "start",
                animationDelay: `${idx * 30}ms`,
                touchAction: "auto",
                ...(active
                    ? {
                        background: "#ffffff",
                        boxShadow: `0 4px 20px ${cfg.accent}28, 0 1px 4px rgba(0,0,0,0.07)`,
                        outline: `2px solid ${cfg.accent}45`,
                    }
                    : {}),
            }}
            className={`fk-cat-btn group relative flex shrink-0 flex-col items-center gap-2 rounded-2xl p-2 transition-all duration-200 focus:outline-none active:scale-[0.94] ${active
                ? "bg-fk-surface-elevated shadow-lg"
                : "bg-fk-surface-elevated/60 hover:bg-fk-surface-elevated hover:shadow-md"
                }`}
        >
            {/* Food image — PERF: native img + cdnImage at 80px */}
            <div
                className="relative h-16 w-16 overflow-hidden rounded-[18px] md:h-[72px] md:w-[72px]"
                style={{
                    boxShadow: active
                        ? `0 4px 12px ${cfg.accent}35`
                        : "0 2px 6px rgba(0,0,0,0.08)",
                    transform: active ? "scale(1.06)" : "scale(1)",
                    transition: "transform 0.25s ease, box-shadow 0.25s ease",
                    pointerEvents: "none",
                }}
            >
                <img
                    src={imgSrc}
                    alt={label}
                    loading={idx < 6 ? "eager" : "lazy"}
                    className={`h-full w-full object-cover transition-transform duration-500 ${active ? "" : "group-hover:scale-[1.1]"
                        }`}
                />
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: active
                            ? `linear-gradient(160deg,${cfg.accent}22 0%,transparent 60%)`
                            : "linear-gradient(160deg,rgba(255,255,255,0.06) 0%,transparent 60%)",
                    }}
                />
                {active && (
                    <div
                        className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full border-2 border-white shadow-sm"
                        style={{ background: cfg.accent }}
                    />
                )}
            </div>

            {/* Label + count */}
            <div className="flex flex-col items-center gap-0.5" style={{ pointerEvents: "none" }}>
                <span
                    className="max-w-[72px] text-center text-[10.5px] font-black leading-tight"
                    style={{ color: active ? cfg.accent : "var(--fk-text)" }}
                >
                    {label}
                </span>
                {count > 0 && (
                    <span
                        className="rounded-full px-1.5 py-[1.5px] text-[8.5px] font-black leading-none transition-colors"
                        style={{
                            background: active ? cfg.accent : "var(--fk-surface-interactive)",
                            color: active ? "#fff" : "var(--fk-text-secondary)",
                        }}
                    >
                        {count}
                    </span>
                )}
            </div>
        </button>
    );
});

const CategorySlider = memo(function CategorySlider({
    categories,
    activeCategory,
    onSelect,
    productCounts,
}: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);

    return (
        <section className="relative border-b border-fk-border bg-fk-surface-elevated py-5 shadow-sm md:py-6">
            <div className="mx-auto max-w-7xl px-4 md:px-8">

                <div className="mb-3.5 flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-fk-text-tertiary">
                        Browse Categories
                    </p>
                </div>

                <div
                    ref={scrollRef}
                    className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1"
                    style={{
                        scrollSnapType: "x mandatory",
                        touchAction: "pan-x pan-y",
                        WebkitOverflowScrolling: "touch",
                        willChange: "auto",
                    }}
                >
                    {categories.map((cat, idx) => (
                        <CategoryItem
                            key={cat}
                            cat={cat}
                            idx={idx}
                            active={cat === activeCategory}
                            count={productCounts[cat] ?? 0}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            </div>

            <style jsx global>{`
                .fk-cat-btn {
                    animation: fkCatBtnIn 0.35s ease both;
                }
                @keyframes fkCatBtnIn {
                    from { opacity: 0; transform: translateY(8px) scale(0.95); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </section>
    );
});

export default CategorySlider;
