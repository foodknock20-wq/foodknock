"use client";

// src/components/home/FeaturesSection.tsx
// FoodKnock — "How It Works" section
// Editorial 2-col rows on mobile · 4-column grid on desktop
// Ember orange · warm cream · Playfair Display headlines

import Link from "next/link";
import {
    Search, ChefHat, Bike, Repeat2,
    ArrowRight, CheckCircle2, Sparkles, Download,
} from "lucide-react";

const steps = [
    {
        step: "01",
        icon: Search,
        emoji: "🔍",
        title: "Browse & Pick",
        description:
            "Explore our full menu of freshly prepared meals — burgers, pizzas, shakes, momos and more. Filter by category, see prices, and add to cart in one tap.",
        highlight: "100+ menu items",
        perks: ["Easy category navigation", "Clear pricing", "Instant add-to-cart"],
        accentColor: "#FF5C1A",
        lightBg: "#FFF7F4",
        lightBorder: "rgba(255,92,26,0.15)",
    },
    {
        step: "02",
        icon: ChefHat,
        emoji: "👨‍🍳",
        title: "We Prepare Fresh",
        description:
            "The moment your order is confirmed, our kitchen gets to work. Everything is made fresh — no pre-packaged, no reheated. Real food, made for you.",
        highlight: "Freshly made every time",
        perks: ["Prepared after ordering", "No pre-made batches", "Consistent quality"],
        accentColor: "#e67e22",
        lightBg: "#FFF9F0",
        lightBorder: "rgba(230,126,34,0.15)",
    },
    {
        step: "03",
        icon: Bike,
        emoji: "🛵",
        title: "Fast Local Delivery",
        description:
            "Hot food leaves our kitchen in minutes and reaches your door fast. Local delivery that's genuinely quick — typically 25–35 minutes from order to doorstep.",
        highlight: "~25–35 min avg.",
        perks: ["Hot & fresh on arrival", "Real-time tracking", "Pickup available too"],
        accentColor: "#c0392b",
        lightBg: "#FFF5F4",
        lightBorder: "rgba(192,57,43,0.12)",
    },
    {
        step: "04",
        icon: Repeat2,
        emoji: "📲",
        title: "Reorder in One Tap",
        description:
            "Install FoodKnock on your home screen for a native app-like experience. Repeat your favourite order in seconds — no app store, no friction.",
        highlight: "One-tap reorders",
        perks: ["Works like a native app", "No App Store needed", "Faster every time"],
        accentColor: "#27ae60",
        lightBg: "#F4FFF8",
        lightBorder: "rgba(39,174,96,0.15)",
        isPwa: true,
    },
];

export default function FeaturesSection() {
    return (
        <section className="relative overflow-hidden bg-[#FFFBF5] py-20 md:py-28">

            {/* Subtle dot texture */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.025]"
                style={{
                    backgroundImage: "radial-gradient(circle, #78350f 1px, transparent 1px)",
                    backgroundSize: "30px 30px",
                }}
                aria-hidden="true"
            />

            {/* Warm ambient blob */}
            <div
                className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-10 blur-3xl"
                style={{ background: "radial-gradient(circle, #FF5C1A, transparent 70%)" }}
                aria-hidden="true"
            />

            <div className="relative mx-auto max-w-7xl px-4 md:px-8">

                {/* ── Section Header ── */}
                <div className="mb-14 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-lg">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5">
                            <Sparkles size={11} className="text-orange-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-600">
                                How FoodKnock Works
                            </span>
                        </div>
                        <h2
                            className="text-3xl font-black leading-tight tracking-tight text-stone-900 md:text-4xl"
                            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                        >
                            From craving to doorstep —{" "}
                            <span
                                className="bg-clip-text text-transparent"
                                style={{ backgroundImage: "linear-gradient(135deg, #FF5C1A, #e67e22)" }}
                            >
                                made simple.
                            </span>
                        </h2>
                        <p className="mt-3 text-[14px] leading-relaxed text-stone-500">
                            Four steps. Real food. No hassle. FoodKnock is built for people who want great meals without the wait.
                        </p>
                    </div>
                    <Link
                        href="/menu"
                        className="group hidden shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-bold text-stone-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 md:inline-flex"
                    >
                        Browse Menu
                        <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>

                {/* ── Steps grid ── */}
                {/* Mobile: editorial list rows | Desktop: 4-col grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {steps.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <div
                                key={s.step}
                                className="group relative flex flex-col overflow-hidden rounded-[20px] border bg-white p-5 transition-all duration-300 hover:shadow-xl"
                                style={{
                                    borderColor: s.lightBorder,
                                    background: s.lightBg,
                                    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                                        `0 16px 48px rgba(0,0,0,0.10)`;
                                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)";
                                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                                }}
                            >
                                {/* Step number watermark */}
                                <span
                                    className="pointer-events-none absolute -right-2 -top-4 select-none font-black leading-none opacity-[0.06]"
                                    style={{ fontSize: "6rem", color: s.accentColor }}
                                    aria-hidden="true"
                                >
                                    {s.step}
                                </span>

                                {/* PWA badge */}
                                {s.isPwa && (
                                    <span
                                        className="absolute right-4 top-4 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black text-white"
                                        style={{ background: "linear-gradient(135deg, #27ae60, #2ecc71)", boxShadow: "0 2px 8px rgba(39,174,96,0.4)" }}
                                    >
                                        <Download size={9} strokeWidth={2.5} />
                                        Install Free
                                    </span>
                                )}

                                {/* Icon */}
                                <div
                                    className="relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                                    style={{
                                        background: `${s.accentColor}15`,
                                        border: `1.5px solid ${s.accentColor}25`,
                                    }}
                                >
                                    {s.emoji}
                                </div>

                                {/* Step label */}
                                <p
                                    className="mb-1 text-[10px] font-black uppercase tracking-[0.22em]"
                                    style={{ color: s.accentColor }}
                                >
                                    Step {i + 1}
                                </p>

                                {/* Title */}
                                <h3
                                    className="text-[16px] font-black leading-snug text-stone-900"
                                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                                >
                                    {s.title}
                                </h3>

                                {/* Description */}
                                <p className="mt-2 text-[12.5px] leading-relaxed text-stone-500">
                                    {s.description}
                                </p>

                                {/* Highlight pill */}
                                <div
                                    className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5"
                                    style={{
                                        background: `${s.accentColor}12`,
                                        border: `1px solid ${s.accentColor}25`,
                                    }}
                                >
                                    <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{ background: s.accentColor }}
                                    />
                                    <span
                                        className="text-[10.5px] font-bold"
                                        style={{ color: s.accentColor }}
                                    >
                                        {s.highlight}
                                    </span>
                                </div>

                                {/* Perks */}
                                <ul className="mt-4 space-y-2 border-t border-black/5 pt-4">
                                    {s.perks.map((perk) => (
                                        <li key={perk} className="flex items-center gap-2 text-[11.5px] text-stone-500">
                                            <CheckCircle2
                                                size={12}
                                                strokeWidth={2.5}
                                                style={{ color: s.accentColor, flexShrink: 0 }}
                                            />
                                            {perk}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>

                {/* ── Social proof strip ── */}
                <div className="mt-6 grid grid-cols-3 gap-3">
                    {[
                        { emoji: "⭐", stat: "4.9 / 5", label: "Customer Rating" },
                        { emoji: "🛵", stat: "25 min", label: "Avg. Delivery" },
                        { emoji: "🍽️", stat: "100+", label: "Menu Items" },
                    ].map(({ emoji, stat, label }) => (
                        <div
                            key={label}
                            className="flex flex-col items-center rounded-2xl border border-stone-100 bg-white p-4 text-center"
                        >
                            <span className="text-xl">{emoji}</span>
                            <p className="mt-1.5 text-lg font-black text-stone-900">{stat}</p>
                            <p className="text-[11px] text-stone-400">{label}</p>
                        </div>
                    ))}
                </div>

                {/* ── Bottom CTA ── */}
                <div
                    className="relative mt-6 overflow-hidden rounded-3xl p-8 md:p-10"
                    style={{
                        background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 60%, #FFB347 100%)",
                    }}
                >
                    {/* Decorative rings */}
                    <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full border border-white/15" aria-hidden="true" />
                    <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full border border-white/10" aria-hidden="true" />

                    <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">
                                Ready to eat well?
                            </p>
                            <h3
                                className="mt-1 text-2xl font-black text-white md:text-3xl"
                                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                            >
                                Your next great meal<br />is 4 steps away.
                            </h3>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-3">
                            <Link
                                href="/menu"
                                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-black text-orange-600 shadow-lg transition-all hover:bg-orange-50 active:scale-95"
                            >
                                Start Ordering
                                <ArrowRight size={14} />
                            </Link>
                            <Link
                                href="/contact"
                                className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                            >
                                Get Help
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu link */}
                <div className="mt-6 flex justify-center md:hidden">
                    <Link
                        href="/menu"
                        className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-bold text-stone-600 shadow-sm"
                    >
                        Browse Full Menu <ArrowRight size={13} />
                    </Link>
                </div>

            </div>
        </section>
    );
}