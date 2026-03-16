"use client";

// src/components/home/HeroSection.tsx
// FoodKnock — Premium 7-slide hero carousel
// Ember orange · Playfair Display · tight mobile layout
// All Sunrise references removed · FoodKnock brand voice throughout

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Zap,
    Clock,
    ShieldCheck,
    Star,
    Tag,
} from "lucide-react";
import type { SiteStats } from "@/app/(main)/page";

const slides = [
    // ── Slide 1: Burgers ──────────────────────────────────────────────────
    {
        image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400&q=85&auto=format&fit=crop",
        eyebrow: "🔥 Freshly Made",
        headline: ["Burgers That Hit", "Different Every Time"],
        sub: "Juicy smash burgers, loaded with flavour — prepared fresh the moment you order.",
        cta: "Order Burgers",
        ctaHref: "/menu",
        ctaSecondary: "See Combos 🎁",
        ctaSecondaryHref: "/menu",
        badge: null,
    },
    // ── Slide 2: Pizza ────────────────────────────────────────────────────
    {
        image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1400&q=85&auto=format&fit=crop",
        eyebrow: "🍕 Hot From the Oven",
        headline: ["Pizza Loaded With", "Every Craving"],
        sub: "Cheesy, crispy, made to order — our pizzas are a full meal in themselves.",
        cta: "Explore Pizzas",
        ctaHref: "/menu",
        ctaSecondary: "Full Menu",
        ctaSecondaryHref: "/menu",
        badge: null,
    },
    // ── Slide 3: Combo Deals (conversion) ─────────────────────────────────
    {
        image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&q=85&auto=format&fit=crop",
        eyebrow: "🎁 Limited Deals",
        headline: ["Best Combos &", "Biggest Savings Today"],
        sub: "Save 15–30% with handpicked combos — burger + fries + shake and more. Eat smarter.",
        cta: "🔥 Grab a Combo",
        ctaHref: "/menu",
        ctaSecondary: "All Deals",
        ctaSecondaryHref: "/menu",
        badge: "SAVE UP TO 30%",
    },
    // ── Slide 4: Shakes & Juice ───────────────────────────────────────────
    {
        image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=1400&q=85&auto=format&fit=crop",
        eyebrow: "🥤 Chilled & Fresh",
        headline: ["Shakes & Juices", "Made With Love"],
        sub: "Thick shakes, cold-pressed juices, iced coffees — the perfect companion to any meal.",
        cta: "See Drinks",
        ctaHref: "/menu",
        ctaSecondary: "Full Menu",
        ctaSecondaryHref: "/menu",
        badge: null,
    },
    // ── Slide 5: Ice Cream ────────────────────────────────────────────────
    {
        image: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=1400&q=85&auto=format&fit=crop",
        eyebrow: "🍦 Sweet Endings",
        headline: ["Ice Creams &", "Desserts to Crave"],
        sub: "Cool off with handcrafted ice creams and desserts — sweet, fresh, irresistible.",
        cta: "View Desserts",
        ctaHref: "/menu",
        ctaSecondary: "Full Menu",
        ctaSecondaryHref: "/menu",
        badge: null,
    },
    // ── Slide 6: Momos & Snacks ───────────────────────────────────────────
    {
        image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=1400&q=85&auto=format&fit=crop",
        eyebrow: "🥟 Street Style Cravings",
        headline: ["Momos, Fries &", "Snacks That Hit"],
        sub: "Steaming hot momos, crispy fries, loaded sandwiches — street food, perfected.",
        cta: "Order Snacks",
        ctaHref: "/menu",
        ctaSecondary: "View Combos 🎁",
        ctaSecondaryHref: "/menu",
        badge: null,
    },
    // ── Slide 7: Full Menu CTA (conversion) ───────────────────────────────
    {
        image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&q=85&auto=format&fit=crop",
        eyebrow: "⭐ Everything on FoodKnock",
        headline: ["100+ Items, Every", "Craving Sorted Here"],
        sub: "From cheesy burgers to chilled shakes, hot momos to fresh juices — your full menu is one tap away.",
        cta: "🍽️ Full Menu",
        ctaHref: "/menu",
        ctaSecondary: "🎁 Best Combos",
        ctaSecondaryHref: "/menu",
        badge: "ORDER IN 2 TAPS",
    },
];

const trustPills = [
    { icon: Zap,         label: "Fast Delivery"   },
    { icon: Clock,       label: "Open Late"        },
    { icon: ShieldCheck, label: "Fresh Daily"      },
    { icon: Star,        label: "4.9★ Rated"       },
];

const AUTOPLAY_MS = 5000;

interface HeroSectionProps { stats: SiteStats; }

export default function HeroSection({ stats }: HeroSectionProps) {
    const [current,   setCurrent]   = useState(0);
    const [animating, setAnimating] = useState(false);
    const [paused,    setPaused]    = useState(false);

    const go = useCallback((idx: number) => {
        if (animating) return;
        setAnimating(true);
        setCurrent((idx + slides.length) % slides.length);
        setTimeout(() => setAnimating(false), 500);
    }, [animating]);

    const next = useCallback(() => go(current + 1), [current, go]);
    const prev = useCallback(() => go(current - 1), [current, go]);

    useEffect(() => {
        if (paused) return;
        const id = setInterval(next, AUTOPLAY_MS);
        return () => clearInterval(id);
    }, [next, paused]);

    const slide = slides[current];

    const statsStrip = [
        { emoji: "🌿", stat: "100%", label: "Fresh Ingredients" },
        {
            emoji: "⭐",
            stat: stats.totalReviews > 0 ? `${stats.avgRating}/5` : "4.9/5",
            label: "Customer Rating",
        },
        { emoji: "🛵", stat: "~30 min", label: "Avg Delivery" },
        {
            emoji: "🎉",
            stat:
                stats.happyCustomers >= 1000
                    ? `${(stats.happyCustomers / 1000).toFixed(1)}k+`
                    : `${stats.happyCustomers}+`,
            label: "Happy Customers",
        },
    ];

    return (
        <section className="fk-hs-root" aria-label="FoodKnock featured highlights">

            {/* ── Hero carousel ── */}
            <div className="fk-hs-wrap">
                <div
                    className="fk-hs-stage"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    onTouchStart={() => setPaused(true)}
                    onTouchEnd={() => setPaused(false)}
                >
                    {/* Slide images */}
                    {slides.map((s, i) => (
                        <div
                            key={i}
                            className="fk-hs-slide"
                            style={{ opacity: i === current ? 1 : 0 }}
                            aria-hidden={i !== current}
                        >
                            <img
                                src={s.image}
                                alt=""
                                className="fk-hs-img"
                                loading={i === 0 ? "eager" : "lazy"}
                            />
                        </div>
                    ))}

                    {/* Overlays */}
                    <div className="fk-hs-overlay-left"   />
                    <div className="fk-hs-overlay-bottom" />

                    {/* Content shell */}
                    <div className="fk-hs-content-shell">
                        {/* Left arrow */}
                        <button onClick={prev} aria-label="Previous slide" className="fk-hs-arrow fk-hs-arrow--left">
                            <ChevronLeft size={18} strokeWidth={2.5} />
                        </button>

                        {/* Text */}
                        <div className="fk-hs-content">

                            {slide.badge && (
                                <div key={`b-${current}`} className="fk-hs-badge">
                                    <Tag size={10} strokeWidth={2.5} />
                                    {slide.badge}
                                </div>
                            )}

                            <span className="fk-hs-eyebrow">{slide.eyebrow}</span>

                            <h1 key={`h-${current}`} className="fk-hs-headline">
                                <span className="fk-hs-line-plain">{slide.headline[0]}</span>
                                <span className="fk-hs-line-accent">{slide.headline[1]}</span>
                            </h1>

                            <p key={`s-${current}`} className="fk-hs-sub">{slide.sub}</p>

                            <div className="fk-hs-ctas">
                                <Link href={slide.ctaHref} className="fk-hs-cta-primary">
                                    {slide.cta}
                                    <ArrowRight size={13} className="fk-hs-cta-arrow" />
                                </Link>
                                <Link href={slide.ctaSecondaryHref} className="fk-hs-cta-ghost">
                                    {slide.ctaSecondary}
                                </Link>
                            </div>

                            <div className="fk-hs-pills">
                                {trustPills.map(({ icon: Icon, label }) => (
                                    <span key={label} className="fk-hs-pill">
                                        <Icon size={9} className="fk-hs-pill-icon" strokeWidth={2.5} />
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Right arrow */}
                        <button onClick={next} aria-label="Next slide" className="fk-hs-arrow fk-hs-arrow--right">
                            <ChevronRight size={18} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Slide counter */}
                    <div className="fk-hs-counter">
                        <span className="fk-hs-counter-cur">{String(current + 1).padStart(2, "0")}</span>
                        <span className="fk-hs-counter-sep">/</span>
                        <span className="fk-hs-counter-tot">{String(slides.length).padStart(2, "0")}</span>
                    </div>

                    {/* Dots */}
                    <div className="fk-hs-dots">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => go(i)}
                                aria-label={`Slide ${i + 1}`}
                                className={`fk-hs-dot${i === current ? " fk-hs-dot--active" : ""}${
                                    (i === 2 || i === 6) ? " fk-hs-dot--special" : ""
                                }`}
                            />
                        ))}
                    </div>

                    {/* Progress bar */}
                    {!paused && (
                        <div className="fk-hs-progress-track">
                            <div key={`p-${current}`} className="fk-hs-progress-bar" />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Stats strip ── */}
            <div className="fk-hs-stats">
                <div className="fk-hs-stats-grid">
                    {statsStrip.map(({ emoji, stat, label }) => (
                        <div key={label} className="fk-hs-stat">
                            <span className="fk-hs-stat-emoji">{emoji}</span>
                            <div>
                                <p className="fk-hs-stat-value">{stat}</p>
                                <p className="fk-hs-stat-label">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx global>{`

                /* ════════════════════════
                   ROOT / LAYOUT
                ════════════════════════ */
                .fk-hs-root { width: 100%; background: #FFFBF5; }

                .fk-hs-wrap {
                    width: 100%;
                    max-width: 1600px;
                    margin: 0 auto;
                    padding: 8px 8px 0;
                }
                @media (min-width: 480px) { .fk-hs-wrap { padding: 10px 10px 0; } }
                @media (min-width: 768px) { .fk-hs-wrap { padding: 16px 16px 0; } }

                .fk-hs-stage {
                    position: relative;
                    overflow: hidden;
                    border-radius: 16px;
                    height: 264px;
                }
                @media (min-width: 360px)  { .fk-hs-stage { height: 282px; } }
                @media (min-width: 480px)  { .fk-hs-stage { height: 324px; border-radius: 18px; } }
                @media (min-width: 640px)  { .fk-hs-stage { height: clamp(300px, 46vw, 400px); border-radius: 20px; } }
                @media (min-width: 1024px) { .fk-hs-stage { height: clamp(380px, 38vw, 500px); border-radius: 24px; } }
                @media (min-width: 1280px) { .fk-hs-stage { height: clamp(420px, 34vw, 520px); } }

                /* ════════════════════════
                   SLIDE / IMAGE
                ════════════════════════ */
                .fk-hs-slide {
                    position: absolute;
                    inset: 0;
                    transition: opacity 0.65s ease;
                }
                .fk-hs-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center 30%;
                    display: block;
                }
                @media (min-width: 640px) { .fk-hs-img { object-position: center; } }

                /* ════════════════════════
                   OVERLAYS
                ════════════════════════ */
                .fk-hs-overlay-left {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        108deg,
                        rgba(0,0,0,0.84) 0%,
                        rgba(0,0,0,0.52) 44%,
                        rgba(0,0,0,0.12) 72%,
                        transparent 100%
                    );
                    z-index: 1;
                }
                @media (min-width: 640px) {
                    .fk-hs-overlay-left {
                        background: linear-gradient(
                            108deg,
                            rgba(0,0,0,0.80) 0%,
                            rgba(0,0,0,0.46) 46%,
                            rgba(0,0,0,0.08) 74%,
                            transparent 100%
                        );
                    }
                }
                .fk-hs-overlay-bottom {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.38) 0%, transparent 48%);
                    z-index: 1;
                }

                /* ════════════════════════
                   CONTENT SHELL
                ════════════════════════ */
                .fk-hs-content-shell {
                    position: absolute;
                    inset: 0;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    padding: 0;
                }

                /* ════════════════════════
                   ARROWS
                ════════════════════════ */
                .fk-hs-arrow {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 1.5px solid rgba(255,255,255,0.22);
                    background: rgba(0,0,0,0.32);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    color: #fff;
                    cursor: pointer;
                    transition: background 0.2s, border-color 0.2s, transform 0.15s;
                    margin: 0 7px;
                    padding: 0;
                    touch-action: manipulation;
                }
                .fk-hs-arrow:hover {
                    background: rgba(255,92,26,0.6);
                    border-color: rgba(255,140,66,0.7);
                    transform: scale(1.08);
                }
                @media (min-width: 480px)  { .fk-hs-arrow { width: 36px; height: 36px; margin: 0 9px; } }
                @media (min-width: 640px)  { .fk-hs-arrow { width: 42px; height: 42px; margin: 0 14px; } }
                @media (min-width: 1024px) { .fk-hs-arrow { width: 48px; height: 48px; margin: 0 20px; } }

                /* ════════════════════════
                   TEXT CONTENT
                ════════════════════════ */
                .fk-hs-content {
                    flex: 1;
                    min-width: 0;
                    padding-bottom: 30px;
                }
                @media (min-width: 640px) { .fk-hs-content { margin-top: -8px; padding-bottom: 0; } }

                /* Conversion badge */
                .fk-hs-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 10px;
                    border-radius: 999px;
                    background: linear-gradient(135deg, #FF5C1A, #FFB347);
                    font-size: 9px;
                    font-weight: 900;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    color: #fff;
                    margin-bottom: 6px;
                    box-shadow: 0 2px 10px rgba(255,92,26,0.5);
                    animation: fk-badge-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
                    width: fit-content;
                }
                @media (min-width: 480px) { .fk-hs-badge { font-size: 10px; padding: 5px 12px; margin-bottom: 7px; } }
                @media (min-width: 640px) { .fk-hs-badge { font-size: 11px; margin-bottom: 10px; } }

                /* Eyebrow */
                .fk-hs-eyebrow {
                    display: inline-flex;
                    align-items: center;
                    padding: 3px 9px;
                    border-radius: 999px;
                    border: 1px solid rgba(255,255,255,0.22);
                    background: rgba(255,255,255,0.12);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    font-size: 9px;
                    font-weight: 800;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: #fff;
                    margin-bottom: 6px;
                    max-width: 100%;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                @media (min-width: 480px) { .fk-hs-eyebrow { font-size: 10px; padding: 4px 11px; margin-bottom: 7px; } }
                @media (min-width: 640px) { .fk-hs-eyebrow { font-size: 11px; margin-bottom: 10px; padding: 5px 13px; } }

                /* Headline */
                .fk-hs-headline {
                    display: flex;
                    flex-direction: column;
                    font-weight: 900;
                    font-family: 'Playfair Display', Georgia, serif;
                    line-height: 1.07;
                    letter-spacing: -0.025em;
                    font-size: 1.4rem;
                    animation: fk-slide-up 0.42s ease forwards;
                    margin: 0;
                }
                @media (min-width: 360px)  { .fk-hs-headline { font-size: 1.55rem; } }
                @media (min-width: 480px)  { .fk-hs-headline { font-size: clamp(1.55rem, 4vw, 2.2rem); } }
                @media (min-width: 640px)  { .fk-hs-headline { font-size: clamp(1.85rem, 4.5vw, 3.2rem); } }

                .fk-hs-line-plain  { color: #fff; }
                .fk-hs-line-accent {
                    background: linear-gradient(135deg, #FFB347, #FF8C42);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    color: transparent;
                }

                /* Sub */
                .fk-hs-sub {
                    margin-top: 7px;
                    font-size: 0.73rem;
                    line-height: 1.55;
                    color: rgba(255,255,255,0.80);
                    max-width: 480px;
                    animation: fk-slide-up 0.5s ease 0.06s both;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                @media (min-width: 480px) { .fk-hs-sub { font-size: 0.78rem; margin-top: 8px; -webkit-line-clamp: 3; } }
                @media (min-width: 640px) {
                    .fk-hs-sub {
                        font-size: clamp(0.78rem, 1.6vw, 1rem);
                        margin-top: 10px;
                        -webkit-line-clamp: unset;
                        overflow: visible;
                        display: block;
                    }
                }

                /* CTAs */
                .fk-hs-ctas {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 7px;
                    margin-top: 11px;
                }
                @media (min-width: 480px) { .fk-hs-ctas { margin-top: 13px; gap: 9px; } }
                @media (min-width: 640px) { .fk-hs-ctas { margin-top: 18px; gap: 11px; } }

                .fk-hs-cta-primary {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 8px 16px;
                    border-radius: 999px;
                    background: linear-gradient(135deg, #FF5C1A, #FF8C42);
                    font-size: 0.73rem;
                    font-weight: 800;
                    color: #fff;
                    text-decoration: none;
                    box-shadow: 0 4px 14px rgba(255,92,26,0.40);
                    transition: transform 0.2s, box-shadow 0.2s, filter 0.2s;
                    white-space: nowrap;
                    touch-action: manipulation;
                    min-height: 36px;
                }
                @media (min-width: 480px) { .fk-hs-cta-primary { padding: 9px 18px; font-size: 0.78rem; } }
                @media (min-width: 640px) {
                    .fk-hs-cta-primary {
                        padding: 10px 20px;
                        font-size: clamp(0.78rem, 1.5vw, 0.9rem);
                        box-shadow: 0 5px 18px rgba(255,92,26,0.42);
                    }
                }
                .fk-hs-cta-primary:hover {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow: 0 8px 24px rgba(255,92,26,0.52);
                    filter: brightness(1.07);
                }
                .fk-hs-cta-primary:active { transform: scale(0.97); }
                .fk-hs-cta-arrow { transition: transform 0.2s; }
                .fk-hs-cta-primary:hover .fk-hs-cta-arrow { transform: translateX(3px); }

                .fk-hs-cta-ghost {
                    display: inline-flex;
                    align-items: center;
                    padding: 8px 15px;
                    border-radius: 999px;
                    border: 1.5px solid rgba(255,255,255,0.28);
                    background: rgba(255,255,255,0.10);
                    font-size: 0.73rem;
                    font-weight: 700;
                    color: #fff;
                    text-decoration: none;
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    transition: background 0.2s, border-color 0.2s;
                    white-space: nowrap;
                    touch-action: manipulation;
                    min-height: 36px;
                }
                @media (min-width: 480px) { .fk-hs-cta-ghost { padding: 9px 18px; font-size: 0.78rem; } }
                @media (min-width: 640px) { .fk-hs-cta-ghost { padding: 10px 20px; font-size: clamp(0.78rem, 1.5vw, 0.9rem); } }
                .fk-hs-cta-ghost:hover { background: rgba(255,255,255,0.20); border-color: rgba(255,255,255,0.50); }

                /* Trust pills */
                .fk-hs-pills { display: none; }
                @media (min-width: 360px) {
                    .fk-hs-pills {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 5px;
                        margin-top: 9px;
                    }
                    .fk-hs-pill:nth-child(n+3) { display: none; }
                }
                @media (min-width: 480px) {
                    .fk-hs-pills { margin-top: 11px; gap: 6px; }
                    .fk-hs-pill:nth-child(n+3) { display: inline-flex; }
                }
                @media (min-width: 640px) { .fk-hs-pills { margin-top: 15px; } }

                .fk-hs-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 9px;
                    border-radius: 999px;
                    border: 1px solid rgba(255,255,255,0.18);
                    background: rgba(255,255,255,0.10);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                    font-size: 9.5px;
                    font-weight: 700;
                    color: rgba(255,255,255,0.90);
                    white-space: nowrap;
                }
                @media (min-width: 480px) { .fk-hs-pill { padding: 4px 10px; font-size: 10px; } }
                @media (min-width: 640px) { .fk-hs-pill { font-size: clamp(9px, 1.2vw, 11px); padding: 4px 11px; } }
                .fk-hs-pill-icon { color: #FFB347; flex-shrink: 0; }

                /* ════════════════════════
                   SLIDE COUNTER
                ════════════════════════ */
                .fk-hs-counter {
                    position: absolute;
                    top: 12px;
                    right: 14px;
                    z-index: 20;
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    background: rgba(0,0,0,0.35);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 999px;
                    padding: 3px 9px;
                }
                @media (min-width: 640px) { .fk-hs-counter { top: 16px; right: 18px; padding: 4px 11px; } }
                .fk-hs-counter-cur  { font-size: 11px; font-weight: 900; color: #FFB347; line-height: 1; }
                .fk-hs-counter-sep  { font-size: 9px; color: rgba(255,255,255,0.35); margin: 0 1px; }
                .fk-hs-counter-tot  { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.50); line-height: 1; }

                /* ════════════════════════
                   DOTS
                ════════════════════════ */
                .fk-hs-dots {
                    position: absolute;
                    bottom: 11px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 20;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                @media (min-width: 640px) { .fk-hs-dots { bottom: 15px; gap: 6px; } }

                .fk-hs-dot {
                    height: 6px;
                    width: 6px;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.38);
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    transition: width 0.3s ease, background 0.3s ease;
                    touch-action: manipulation;
                }
                .fk-hs-dot--active { width: 22px; background: #FFB347; }
                .fk-hs-dot--special:not(.fk-hs-dot--active) { background: rgba(255,92,26,0.5); }
                @media (min-width: 640px) {
                    .fk-hs-dot { height: 8px; width: 8px; }
                    .fk-hs-dot--active { width: 30px; }
                }

                /* ════════════════════════
                   PROGRESS BAR
                ════════════════════════ */
                .fk-hs-progress-track {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: rgba(255,255,255,0.10);
                    z-index: 20;
                }
                .fk-hs-progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #FF5C1A, #FFB347);
                    transform-origin: left;
                    animation: fk-progress ${AUTOPLAY_MS}ms linear forwards;
                }

                /* ════════════════════════
                   STATS STRIP
                ════════════════════════ */
                .fk-hs-stats {
                    margin-top: 10px;
                    border-top: 1px solid #FDE68A;
                    border-bottom: 1px solid #FDE68A;
                    background: #fff;
                }
                @media (min-width: 768px) { .fk-hs-stats { margin-top: 12px; } }

                .fk-hs-stats-grid {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: 10px 12px;
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px 8px;
                }
                @media (min-width: 480px) {
                    .fk-hs-stats-grid {
                        grid-template-columns: repeat(4, 1fr);
                        padding: 12px 16px;
                        gap: 8px;
                    }
                }
                @media (min-width: 768px) { .fk-hs-stats-grid { padding: 16px 32px; } }

                .fk-hs-stat {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                @media (min-width: 480px) {
                    .fk-hs-stat:not(:last-child) {
                        border-right: 1px solid #FEF3C7;
                        padding-right: 10px;
                    }
                }
                @media (min-width: 768px) {
                    .fk-hs-stat:not(:last-child) { padding-right: 14px; }
                }

                .fk-hs-stat-emoji { font-size: 1.25rem; line-height: 1; flex-shrink: 0; }
                @media (min-width: 480px) { .fk-hs-stat-emoji { font-size: 1.5rem; } }
                @media (min-width: 768px) { .fk-hs-stat-emoji { font-size: 1.75rem; } }

                .fk-hs-stat-value {
                    font-size: clamp(0.82rem, 2vw, 1.15rem);
                    font-weight: 900;
                    font-family: 'Playfair Display', Georgia, serif;
                    line-height: 1;
                    color: #1C1917;
                    margin: 0;
                }
                .fk-hs-stat-label {
                    font-size: clamp(8px, 1.1vw, 11px);
                    font-weight: 600;
                    color: #A8A29E;
                    margin-top: 3px;
                    white-space: nowrap;
                }

                /* ════════════════════════
                   KEYFRAMES
                ════════════════════════ */
                @keyframes fk-slide-up {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes fk-progress {
                    from { transform: scaleX(0); }
                    to   { transform: scaleX(1); }
                }
                @keyframes fk-badge-pop {
                    from { opacity: 0; transform: scale(0.8) translateY(4px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </section>
    );
}