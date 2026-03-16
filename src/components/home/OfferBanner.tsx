// src/components/home/OfferBanner.tsx
// FoodKnock — "Our Promise" trust section
// Asymmetric layout · large left anchor · scrollable proof wall on mobile
"use client";

import Link from "next/link";
import { ArrowRight, Flame, Leaf, Zap, Heart, Clock, Award, ShieldCheck } from "lucide-react";

const promises = [
    {
        icon: Flame,
        emoji: "🔥",
        title: "Made After You Order",
        description:
            "No pre-cooked batches sitting around. Every dish is prepared the moment your order hits our kitchen — fresh, hot, and made exactly for you.",
        accentColor: "#FF5C1A",
        lightBg: "#FFF7F4",
        lightBorder: "rgba(255,92,26,0.14)",
        highlight: "Zero reheating · ever",
    },
    {
        icon: Leaf,
        emoji: "🌿",
        title: "Fresh Ingredients Daily",
        description:
            "We source ingredients every morning. Crisp vegetables, quality proteins, fresh bread — the kind of sourcing that actually shows up in the taste.",
        accentColor: "#27ae60",
        lightBg: "#F4FFF8",
        lightBorder: "rgba(39,174,96,0.14)",
        highlight: "Sourced every morning",
    },
    {
        icon: Zap,
        emoji: "⚡",
        title: "25–35 Min Delivery",
        description:
            "Our kitchen is optimised for speed without shortcuts. Food leaves hot, travels fast, and arrives at your door still steaming — typically within 30 minutes.",
        accentColor: "#e67e22",
        lightBg: "#FFF9F0",
        lightBorder: "rgba(230,126,34,0.14)",
        highlight: "Hot on arrival · always",
    },
    {
        icon: Heart,
        emoji: "❤️",
        title: "Cooked With Real Care",
        description:
            "We treat every order like it's for family. That's not a slogan — it's why our regulars keep coming back. The care genuinely shows up in every bite.",
        accentColor: "#e74c3c",
        lightBg: "#FFF4F4",
        lightBorder: "rgba(231,76,60,0.12)",
        highlight: "Family kitchen standards",
    },
    {
        icon: Clock,
        emoji: "🕙",
        title: "Open Late, Every Day",
        description:
            "Whether it's a 1 PM lunch or a 10 PM craving — we're here. Consistent hours, consistent quality, no matter when you order.",
        accentColor: "#2980b9",
        lightBg: "#F4F8FF",
        lightBorder: "rgba(41,128,185,0.12)",
        highlight: "Open until 11 PM",
    },
    {
        icon: ShieldCheck,
        emoji: "🔒",
        title: "Secure Online Ordering",
        description:
            "Your data and payments are handled with care. Smooth, secure, frictionless checkout — so you can focus on what matters: the food.",
        accentColor: "#8e44ad",
        lightBg: "#FAF4FF",
        lightBorder: "rgba(142,68,173,0.12)",
        highlight: "Safe · private · smooth",
    },
];

const anchorStats = [
    { emoji: "⭐", value: "4.9", unit: "/5", label: "Avg. rating across 2,400+ orders" },
    { emoji: "🛵", value: "30", unit: "min", label: "Average delivery time" },
    { emoji: "🍽️", value: "100", unit: "+", label: "Menu items, made fresh daily" },
];

export default function OfferBanner() {
    return (
        <section className="bg-[#FFFBF5] py-20 md:py-28">
            <div className="mx-auto max-w-7xl px-4 md:px-8">

                {/* ── Section header ── */}
                <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-lg">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5">
                            <Leaf size={11} className="text-green-600" />
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-green-700">
                                Our Promise
                            </span>
                        </div>
                        <h2
                            className="text-3xl font-black leading-tight tracking-tight text-stone-900 md:text-4xl"
                            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                        >
                            Why FoodKnock regulars{" "}
                            <span
                                className="bg-clip-text text-transparent"
                                style={{ backgroundImage: "linear-gradient(135deg, #FF5C1A, #e67e22)" }}
                            >
                                never switch.
                            </span>
                        </h2>
                        <p className="mt-3 text-[14px] leading-relaxed text-stone-500">
                            Fresh ingredients, genuine care, and fast delivery — not as a tagline, but as the actual standard we hold ourselves to.
                        </p>
                    </div>
                    <Link
                        href="/reviews"
                        className="group hidden shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-bold text-stone-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 md:inline-flex"
                    >
                        Read Real Reviews
                        <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>

                {/* ── Asymmetric layout ── */}
                {/* Left: large anchor stats panel | Right: promise cards grid */}
                <div className="grid gap-5 lg:grid-cols-[300px_1fr]">

                    {/* ── Left anchor panel ── */}
                    <div
                        className="relative overflow-hidden rounded-[24px] p-6 lg:p-8"
                        style={{
                            background: "linear-gradient(160deg, #FF5C1A 0%, #FF8C42 60%, #FFB347 100%)",
                            boxShadow: "0 8px 32px rgba(255,92,26,0.35)",
                        }}
                    >
                        {/* Decorative rings */}
                        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/15" aria-hidden="true" />
                        <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full border border-white/10" aria-hidden="true" />
                        <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-black/10 blur-2xl" aria-hidden="true" />

                        <div className="relative">
                            <p
                                className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60"
                            >
                                Numbers that matter
                            </p>
                            <h3
                                className="mt-2 text-xl font-black leading-snug text-white"
                                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                            >
                                Our track record speaks for itself.
                            </h3>

                            {/* Stats */}
                            <div className="mt-6 space-y-4">
                                {anchorStats.map(({ emoji, value, unit, label }) => (
                                    <div
                                        key={label}
                                        className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 backdrop-blur-sm"
                                    >
                                        <span className="text-2xl">{emoji}</span>
                                        <div>
                                            <p className="text-2xl font-black leading-none text-white">
                                                {value}<span className="text-lg text-white/70">{unit}</span>
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-white/60">{label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Award badge */}
                            <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3">
                                <Award size={18} className="shrink-0 text-amber-200" />
                                <div>
                                    <p className="text-[13px] font-black text-white">Top Rated Local Kitchen</p>
                                    <p className="text-[11px] text-white/55">Loved by the community</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Right promise cards grid ── */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                        {promises.map((p) => {
                            const Icon = p.icon;
                            return (
                                <div
                                    key={p.title}
                                    className="group flex flex-col rounded-[20px] border p-5 transition-all duration-200"
                                    style={{
                                        background: p.lightBg,
                                        borderColor: p.lightBorder,
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLDivElement).style.boxShadow =
                                            `0 12px 32px rgba(0,0,0,0.09)`;
                                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                                    }}
                                >
                                    {/* Icon + emoji */}
                                    <div
                                        className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-2xl text-xl"
                                        style={{
                                            background: `${p.accentColor}15`,
                                            border: `1.5px solid ${p.accentColor}22`,
                                        }}
                                    >
                                        {p.emoji}
                                    </div>

                                    {/* Title */}
                                    <h3
                                        className="text-[14.5px] font-black leading-snug text-stone-900"
                                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                                    >
                                        {p.title}
                                    </h3>

                                    {/* Description */}
                                    <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-stone-500">
                                        {p.description}
                                    </p>

                                    {/* Highlight chip */}
                                    <div
                                        className="mt-3.5 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5"
                                        style={{
                                            background: `${p.accentColor}10`,
                                            border: `1px solid ${p.accentColor}22`,
                                        }}
                                    >
                                        <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ background: p.accentColor }}
                                        />
                                        <span
                                            className="text-[10.5px] font-bold"
                                            style={{ color: p.accentColor }}
                                        >
                                            {p.highlight}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Bottom CTA row ── */}
                <div className="mt-10 flex flex-col items-center gap-4 text-center">
                    <p className="text-[13px] text-stone-400">
                        Experience the FoodKnock difference yourself —
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Link
                            href="/menu"
                            className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-black text-white shadow-lg transition-all hover:brightness-105 active:scale-95"
                            style={{
                                background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)",
                                boxShadow: "0 8px 24px rgba(255,92,26,0.35)",
                            }}
                        >
                            Order Fresh Now
                            <ArrowRight size={14} />
                        </Link>
                        <Link
                            href="/reviews"
                            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-8 py-3.5 text-sm font-bold text-stone-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 md:hidden"
                        >
                            Read Reviews
                        </Link>
                    </div>
                </div>

            </div>
        </section>
    );
}