"use client";

// src/components/home/HeroCarousel.tsx
//
// Pre-Phase 17 — Home/Search polish: compacted from a full-screen-feeling
// hero (280-400px tall) into a premium promotional STRIP sitting directly
// below HomeSearchEntry — same component, same real-data slide-building
// contract (src/app/(main)/page.tsx's buildPromoSlides()), just a
// restrained visual footprint. Still the single promotional carousel on
// Home (no second hero) — product slides were added to the same slide
// list rather than building a competing rail, so campaigns/offers/
// products share one compact, swipeable strip.
//
// `image: null` renders a restrained text-first slide (warm gradient, no
// photo) — used only when there is genuinely no safe matching image
// (e.g. a storewide Offer has no product/banner association). Never
// substitutes a logo or a mismatched food photo for a missing image.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cdnImage } from "@/lib/cdnImage";
import { cn } from "@/lib/utils";

export type HeroSlide = {
    id: string;
    image: string | null;
    eyebrow: string;
    title: string;
    subtitle?: string;
    badge?: string | null;
    price?: number | null;
    countdownEndAt?: string | null;
    ctaLabel: string;
    ctaHref: string;
};

const AUTOPLAY_MS = 5000;

// Premium "glass pill" treatment (spec: translucent warm-white, subtle
// border/blur/shadow) — used for the small eyebrow/badge/secondary-line
// chips over a slide image, so text never floats raw on busy food
// photography. The CTA stays a solid gradient pill (intentionally higher
// contrast — it's the one actionable element, not a label).
const GLASS_PILL =
    "inline-flex items-center gap-1 rounded-fk-pill border border-white/50 bg-white/75 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-wide text-fk-text backdrop-blur-sm shadow-sm";

function useReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return reduced;
}

function Countdown({ endAt }: { endAt: string }) {
    const [label, setLabel] = useState<string | null>(null);
    useEffect(() => {
        const update = () => {
            const diffMs = new Date(endAt).getTime() - Date.now();
            if (diffMs <= 0) {
                setLabel(null);
                return;
            }
            const hours = Math.floor(diffMs / 3_600_000);
            const mins = Math.floor((diffMs % 3_600_000) / 60_000);
            setLabel(hours > 24 ? `${Math.floor(hours / 24)}d left` : `${hours}h ${mins}m left`);
        };
        update();
        const id = setInterval(update, 60_000);
        return () => clearInterval(id);
    }, [endAt]);

    if (!label) return null;
    return (
        <span className="inline-flex items-center rounded-fk-pill bg-black/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
            ⏳ {label}
        </span>
    );
}

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
    const [current, setCurrent] = useState(0);
    const [paused, setPaused] = useState(false);
    const reducedMotion = useReducedMotion();
    const touchStartX = useRef<number | null>(null);

    const go = useCallback((idx: number) => setCurrent((idx + slides.length) % slides.length), [slides.length]);
    const next = useCallback(() => go(current + 1), [current, go]);
    const prev = useCallback(() => go(current - 1), [current, go]);

    useEffect(() => {
        if (paused || reducedMotion || slides.length <= 1) return;
        const id = setInterval(next, AUTOPLAY_MS);
        return () => clearInterval(id);
    }, [next, paused, reducedMotion, slides.length]);

    if (slides.length === 0) return null;

    return (
        <section aria-roledescription="carousel" aria-label="FoodKnock promotions" className="px-4 pb-1 pt-4 md:px-8">
            <div
                className="relative mx-auto h-[148px] max-w-7xl overflow-hidden rounded-fk-lg border border-fk-border sm:h-[168px] md:h-[190px]"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onTouchStart={(e) => {
                    setPaused(true);
                    touchStartX.current = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                    setPaused(false);
                    const start = touchStartX.current;
                    if (start === null) return;
                    const delta = e.changedTouches[0].clientX - start;
                    if (Math.abs(delta) > 40) {
                        if (delta < 0) next();
                        else prev();
                    }
                    touchStartX.current = null;
                }}
            >
                {slides.map((s, i) => (
                    <Link
                        key={s.id}
                        href={s.ctaHref}
                        tabIndex={i === current ? 0 : -1}
                        aria-hidden={i !== current}
                        className={cn(
                            "absolute inset-0 block transition-opacity duration-700 motion-reduce:transition-none",
                            i === current ? "opacity-100" : "pointer-events-none opacity-0"
                        )}
                    >
                        {s.image ? (
                            <img
                                src={cdnImage(s.image, 900)}
                                alt=""
                                loading={i === 0 ? "eager" : "lazy"}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div
                                className="h-full w-full"
                                style={{ background: "linear-gradient(135deg, var(--fk-accent) 0%, var(--fk-gold) 100%)" }}
                            />
                        )}
                        {s.image && <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />}
                        <div className="absolute inset-0 flex flex-col justify-center gap-1.5 p-4 sm:p-5">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className={GLASS_PILL}>{s.eyebrow}</span>
                                {s.badge && <span className={GLASS_PILL}>{s.badge}</span>}
                                {s.countdownEndAt && <Countdown endAt={s.countdownEndAt} />}
                            </div>
                            <h2 className="font-display line-clamp-1 max-w-[75%] text-[17px] font-black leading-tight text-white drop-shadow-sm sm:text-[21px]">
                                {s.title}
                            </h2>
                            {(s.subtitle || s.price != null) && (
                                <span className={cn(GLASS_PILL, "w-fit max-w-[85%] truncate normal-case tracking-normal text-fk-text-secondary")}>
                                    {s.subtitle && <span className="truncate">{s.subtitle}</span>}
                                    {s.subtitle && s.price != null && <span className="shrink-0">•</span>}
                                    {s.price != null && <span className="shrink-0 font-black text-[var(--fk-accent)]">₹{s.price}</span>}
                                </span>
                            )}
                            <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-3.5 py-1.5 text-[11px] font-black text-white shadow-sm">
                                {s.ctaLabel}
                            </span>
                        </div>
                    </Link>
                ))}

                {slides.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.preventDefault(); prev(); }}
                            aria-label="Previous slide"
                            className="absolute left-2 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-sm transition-transform active:scale-90 sm:flex"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.preventDefault(); next(); }}
                            aria-label="Next slide"
                            className="absolute right-2 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-sm transition-transform active:scale-90 sm:flex"
                        >
                            <ChevronRight size={14} />
                        </button>
                        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1">
                            {slides.map((s, i) => (
                                <button
                                    key={s.id}
                                    onClick={(e) => { e.preventDefault(); go(i); }}
                                    aria-label={`Go to slide ${i + 1}`}
                                    aria-current={i === current}
                                    className={cn(
                                        "h-1 rounded-fk-pill transition-all",
                                        i === current ? "w-4 bg-fk-gold" : "w-1 bg-white/40"
                                    )}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
