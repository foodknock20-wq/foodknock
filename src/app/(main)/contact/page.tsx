export const dynamic = "force-dynamic";

// src/app/(main)/contact/page.tsx
// FoodKnock — Premium Contact & Info Page
// No forms. No phone numbers. Pure brand storytelling + map + details.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title:       "Contact Us — FoodKnock",
    description: "Get in touch with FoodKnock. We're based in Danta, Sikar, Rajasthan. Email us at foodknock20@gmail.com for support, feedback, or orders.",
    alternates:  { canonical: "https://www.foodknock.com/contact" },
    openGraph: {
        title:       "Contact FoodKnock",
        description: "Reach out to FoodKnock — fast food delivery in Danta, Sikar.",
        url:         "https://www.foodknock.com/contact",
    },
};
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import {
    MapPin, Clock3, Mail, ArrowRight,
    Navigation, Flame, Zap, ShieldCheck, Star,
    Copy, UtensilsCrossed, Sparkles, Heart, Leaf,
} from "lucide-react";

const CONTACT_EMAIL = "foodknock20@gmail.com";
const MAP_LINK      = "https://maps.app.goo.gl/Y5DEiuP4qJcHKfWAA";

// ─── What we serve ────────────────────────────────────────────────────────
const MENU_CATEGORIES = [
    { emoji: "🍔", name: "Burgers",        desc: "Stacked, saucy, satisfying" },
    { emoji: "🍟", name: "Fast Food",      desc: "Crispy fries & hot sides"   },
    { emoji: "🥤", name: "Fresh Juices",   desc: "Cold-pressed & seasonal"    },
    { emoji: "🍦", name: "Ice Cream",      desc: "Creamy scoops & sundaes"    },
    { emoji: "🌮", name: "Snacks",         desc: "Perfect bites, any time"    },
    { emoji: "☕", name: "Hot Drinks",     desc: "Tea, coffee & more"         },
];

// ─── Why FoodKnock ────────────────────────────────────────────────────────
const PROMISES = [
    {
        icon: Flame,
        emoji: "🔥",
        title: "Made Fresh Daily",
        desc: "Every dish is prepared fresh to order. No frozen food, no shortcuts — ever.",
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-100",
    },
    {
        icon: Zap,
        emoji: "⚡",
        title: "Fast Delivery",
        desc: "We aim for your door within 25 minutes. Hot food, fast — that's our promise.",
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-100",
    },
    {
        icon: Leaf,
        emoji: "🌿",
        title: "Quality Ingredients",
        desc: "Locally sourced where possible. Fresh vegetables, good oil, real flavour.",
        color: "text-green-600",
        bg: "bg-green-50",
        border: "border-green-100",
    },
    {
        icon: Heart,
        emoji: "❤️",
        title: "Made with Love",
        desc: "A family-run kitchen in Danta, Sikar. Every order gets personal attention.",
        color: "text-rose-600",
        bg: "bg-rose-50",
        border: "border-rose-100",
    },
];

// ─── Opening hours ────────────────────────────────────────────────────────
const HOURS = [
    { day: "Monday",    time: "10:00 AM – 11:00 PM", open: true  },
    { day: "Tuesday",   time: "10:00 AM – 11:00 PM", open: true  },
    { day: "Wednesday", time: "10:00 AM – 11:00 PM", open: true  },
    { day: "Thursday",  time: "10:00 AM – 11:00 PM", open: true  },
    { day: "Friday",    time: "10:00 AM – 11:30 PM", open: true  },
    { day: "Saturday",  time: "10:00 AM – 11:30 PM", open: true  },
    { day: "Sunday",    time: "10:00 AM – 11:30 PM", open: true  },
];

// ─── Tiny helper: current day highlight ───────────────────────────────────
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function ContactPage() {
    const todayIndex = new Date().getDay();
    const todayName  = DAY_NAMES[todayIndex];

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FFFBF5]">

                {/* ══════════════════════════════════════════
                    HERO
                ══════════════════════════════════════════ */}
                <div className="relative overflow-hidden border-b border-amber-100 bg-white">
                    {/* Warm radial blobs */}
                    <div
                        className="pointer-events-none absolute -top-28 left-1/2 h-72 w-3/4 -translate-x-1/2 rounded-full opacity-55 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #fed7aa, transparent 70%)" }}
                        aria-hidden="true"
                    />
                    <div
                        className="pointer-events-none absolute right-0 top-0 h-64 w-64 opacity-25 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }}
                        aria-hidden="true"
                    />
                    <div
                        className="pointer-events-none absolute -bottom-10 left-0 h-48 w-48 opacity-20 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #fbbf24, transparent 70%)" }}
                        aria-hidden="true"
                    />
                    {/* Dot grid */}
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.022]"
                        style={{
                            backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)",
                            backgroundSize: "28px 28px",
                        }}
                        aria-hidden="true"
                    />

                    <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-12 md:px-8 md:pb-18 md:pt-16">
                        {/* Eyebrow */}
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5">
                            <span className="flex h-2 w-2 animate-pulse rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                            <span className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-600">
                                Find Us
                            </span>
                        </div>

                        <h1 className="max-w-4xl text-4xl font-black leading-[1.08] text-stone-900 md:text-5xl lg:text-6xl">
                            Great food,{" "}
                            <span
                                className="bg-clip-text text-transparent"
                                style={{ backgroundImage: "linear-gradient(135deg, #ea580c 0%, #d97706 60%, #f59e0b 100%)" }}
                            >
                                right at your door.
                            </span>
                        </h1>

                        <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-500 md:text-lg">
                            FoodKnock is a premium food delivery experience rooted in Danta, Sikar.
                            Fresh ingredients, fast delivery, and a menu built to make every meal memorable.
                        </p>

                        {/* Quick action row */}
                        <div className="mt-7 flex flex-wrap gap-3">
                            <Link
                                href="/menu"
                                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-7 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200 transition-all hover:brightness-110 active:scale-95"
                            >
                                <UtensilsCrossed size={15} strokeWidth={2.5} />
                                Order Now
                            </Link>
                            <Link
                                href={MAP_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border-2 border-amber-200 bg-amber-50 px-6 py-3.5 text-sm font-black text-amber-800 transition-all hover:border-amber-300 hover:bg-amber-100 active:scale-95"
                            >
                                <Navigation size={15} strokeWidth={2.5} />
                                Get Directions
                            </Link>
                        </div>

                        {/* Trust chips */}
                        <div className="mt-8 flex flex-wrap items-center gap-5">
                            {[
                                { icon: Flame,       text: "Made Fresh Daily"   },
                                { icon: Zap,         text: "25 Min Delivery"    },
                                { icon: ShieldCheck, text: "Trusted by 2,500+"  },
                                { icon: Star,        text: "4.9★ Customer Rating"},
                            ].map(({ icon: Icon, text }) => (
                                <div key={text} className="flex items-center gap-1.5 text-[12px] font-bold text-stone-400">
                                    <Icon size={12} className="text-amber-500" strokeWidth={2.5} />
                                    {text}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════
                    MAIN INFO GRID
                ══════════════════════════════════════════ */}
                <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                        {/* 1 — Location */}
                        <div className="group flex flex-col rounded-3xl border-2 border-orange-100 bg-white p-6 shadow-sm transition-all duration-200 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-100/40">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100">
                                <MapPin size={20} className="text-orange-600" strokeWidth={2} />
                            </div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Our Location</p>
                            <h3 className="text-base font-black text-stone-900">Find Us Here</h3>
                            <div className="mt-3 flex-1 space-y-1.5">
                                <p className="text-sm font-bold text-stone-700">Ramgarh Bas Stand Circle</p>
                                <p className="text-sm text-stone-500">Danta, Sikar</p>
                                <p className="text-sm text-stone-500">Rajasthan — 332 XXX</p>
                                <p className="text-sm text-stone-500">India</p>
                            </div>
                            <Link
                                href={MAP_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-orange-600 transition-all hover:gap-2.5"
                            >
                                Open in Maps
                                <ArrowRight size={13} strokeWidth={2.5} />
                            </Link>
                        </div>

                        {/* 2 — Email */}
                        <div className="group flex flex-col rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm transition-all duration-200 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-100/40">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-100">
                                <Mail size={20} className="text-amber-600" strokeWidth={2} />
                            </div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Write to Us</p>
                            <h3 className="text-base font-black text-stone-900">Email</h3>
                            <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-500">
                                For order issues, partnerships, menu feedback, or any questions — we read every email personally and respond within 24 hours.
                            </p>
                            
                                <a href={`mailto:${CONTACT_EMAIL}`}
                                className="mt-5 inline-flex items-center gap-1.5 break-all text-sm font-black text-amber-600 transition-all hover:gap-2.5"
                            >
                                {CONTACT_EMAIL}
                                <ArrowRight size={13} strokeWidth={2.5} className="shrink-0" />
                            </a>
                        </div>

                        {/* 3 — Hours (spans 2 cols on sm+) */}
                        <div className="group flex flex-col rounded-3xl border-2 border-green-100 bg-white p-6 shadow-sm transition-all duration-200 hover:border-green-200 hover:shadow-lg hover:shadow-green-100/40 sm:col-span-2 lg:col-span-1">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100">
                                <Clock3 size={20} className="text-green-600" strokeWidth={2} />
                            </div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-500">Always Open</p>
                            <h3 className="text-base font-black text-stone-900">Opening Hours</h3>
                            <div className="mt-3 flex-1 space-y-0">
                                {HOURS.map(({ day, time }) => {
                                    const isToday = day === todayName;
                                    return (
                                        <div
                                            key={day}
                                            className={`flex items-center justify-between border-b border-stone-50 py-2 last:border-0 ${isToday ? "rounded-xl bg-green-50 px-2 -mx-2" : ""}`}
                                        >
                                            <span className={`text-[12px] font-${isToday ? "black" : "semibold"} ${isToday ? "text-green-700" : "text-stone-600"}`}>
                                                {day}
                                                {isToday && <span className="ml-1.5 rounded-full bg-green-200 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-green-800">Today</span>}
                                            </span>
                                            <span className={`text-[11px] font-${isToday ? "black" : "medium"} ${isToday ? "text-green-700" : "text-stone-500"}`}>
                                                {time}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 px-3 py-2">
                                <p className="text-center text-[11px] font-bold text-green-700">
                                    🟢 Open 7 days a week · No holidays
                                </p>
                            </div>
                        </div>

                        {/* 4 — About / Story */}
                        <div className="group flex flex-col rounded-3xl border-2 border-violet-100 bg-white p-6 shadow-sm transition-all duration-200 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/40">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100">
                                <Sparkles size={20} className="text-violet-600" strokeWidth={2} />
                            </div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-500">Our Story</p>
                            <h3 className="text-base font-black text-stone-900">About FoodKnock</h3>
                            <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-500">
                                Born in Danta, Sikar — FoodKnock started with one mission: serve food that actually tastes like it was made with care. From crispy fast food to fresh cold juices, everything on our menu is made in-house, fresh every single day.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2">
                                {["🏡 Family-run", "🌿 Fresh Daily", "💛 Made with Love"].map((tag) => (
                                    <span key={tag} className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-600">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════
                    WHAT WE SERVE
                ══════════════════════════════════════════ */}
                <section className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
                    {/* Section header */}
                    <div className="mb-6 flex items-center gap-4">
                        <div>
                            <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.22em] text-orange-400">The Menu</p>
                            <h2 className="text-2xl font-black text-stone-900 md:text-3xl">What We Serve</h2>
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-amber-200 to-transparent" />
                        <Link
                            href="/menu"
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-black text-orange-600 transition-all hover:bg-orange-100"
                        >
                            Full Menu →
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                        {MENU_CATEGORIES.map(({ emoji, name, desc }) => (
                            <Link
                                key={name}
                                href="/menu"
                                className="group flex flex-col items-center gap-2.5 rounded-2xl border border-amber-100 bg-white p-4 text-center shadow-sm transition-all duration-200 hover:border-orange-200 hover:shadow-md hover:shadow-orange-100/50 hover:-translate-y-0.5"
                            >
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 text-3xl shadow-sm transition-transform duration-300 group-hover:scale-110">
                                    {emoji}
                                </div>
                                <div>
                                    <p className="text-[13px] font-black text-stone-800">{name}</p>
                                    <p className="mt-0.5 text-[10px] leading-tight text-stone-400">{desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* ══════════════════════════════════════════
                    GOOGLE MAP — FULL WIDTH CARD
                ══════════════════════════════════════════ */}
                <section className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
                    <div className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-xl shadow-amber-100/40">

                        {/* Map header */}
                        <div className="relative overflow-hidden border-b border-amber-100 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-6 py-5 md:px-8 md:py-6">
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                                style={{ backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)", backgroundSize: "20px 20px" }}
                                aria-hidden="true"
                            />
                            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-orange-600 shadow-sm">
                                        <Navigation size={11} strokeWidth={2.5} />
                                        Live Location
                                    </div>
                                    <h3 className="text-xl font-black text-stone-900 md:text-2xl">FoodKnock Kitchen 🗺️</h3>
                                    <p className="mt-1 text-sm text-stone-500">
                                        Ramgarh Bas Stand Circle, Danta, Sikar, Rajasthan
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Link
                                        href={MAP_LINK}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-orange-200 transition-all hover:brightness-110 active:scale-95"
                                    >
                                        <Navigation size={13} />
                                        Open in Google Maps
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Embedded map — full width, tall */}
                        <div className="h-[320px] w-full md:h-[460px] lg:h-[520px]">
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d221.6644903203102!2d75.17707504587761!3d27.26207348965363!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x396c8f003bb2017f%3A0x2c8717f3bf912831!2sRamgardh%20bas%20stand%20circle!5e0!3m2!1sen!2sin!4v1772790882554!5m2!1sen!2sin"
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="FoodKnock location — Ramgarh Bas Stand Circle, Danta, Sikar"
                                className="h-full w-full"
                            />
                        </div>

                        {/* Map footer */}
                        <div className="border-t border-amber-100 bg-white px-6 py-5 md:px-8">
                            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                                {/* Address block */}
                                <div className="flex items-start gap-3.5">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100">
                                        <MapPin size={18} className="text-orange-600" strokeWidth={2} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">Address</p>
                                        <p className="text-sm font-black text-stone-900">FoodKnock</p>
                                        <p className="text-sm text-stone-500">Ramgarh Bas Stand Circle, Danta</p>
                                        <p className="text-sm text-stone-500">Sikar, Rajasthan, India</p>
                                    </div>
                                </div>

                                {/* Landmark + Delivery zone */}
                                <div className="flex flex-wrap gap-3">
                                    <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">Landmark</p>
                                        <p className="text-sm font-bold text-stone-700">Near Bus Stand, Danta</p>
                                    </div>
                                    <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-green-500">Delivery Zone</p>
                                        <p className="text-sm font-bold text-stone-700">Danta & Nearby Areas</p>
                                    </div>
                                    <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-orange-500">Pickup</p>
                                        <p className="text-sm font-bold text-stone-700">Always Available</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════
                    WHY FOODKNOCK — PROMISE CARDS
                ══════════════════════════════════════════ */}
                <section className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
                    <div className="mb-7 text-center">
                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-orange-400">Our Commitment</p>
                        <h2 className="text-2xl font-black text-stone-900 md:text-3xl">Why FoodKnock?</h2>
                        <p className="mt-2 text-sm text-stone-500">Everything we do is built around one thing — making your meal genuinely great.</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {PROMISES.map(({ icon: Icon, emoji, title, desc, color, bg, border }) => (
                            <div
                                key={title}
                                className={`flex flex-col rounded-3xl border-2 ${border} ${bg} p-6 transition-all duration-200 hover:shadow-lg`}
                            >
                                <div className="mb-4 flex items-center gap-3">
                                    <span className="text-3xl">{emoji}</span>
                                    <Icon size={18} className={color} strokeWidth={2} />
                                </div>
                                <h3 className="text-sm font-black text-stone-900">{title}</h3>
                                <p className="mt-2 text-[12px] leading-relaxed text-stone-500">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ══════════════════════════════════════════
                    EMAIL HIGHLIGHT BAND
                ══════════════════════════════════════════ */}
                <section className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
                    <div className="flex flex-col items-center gap-4 rounded-3xl border border-amber-100 bg-white px-6 py-10 text-center shadow-sm md:flex-row md:justify-between md:px-10 md:text-left">
                        <div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-500">Reach Us</p>
                            <h3 className="text-xl font-black text-stone-900 md:text-2xl">Have a question?</h3>
                            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-500">
                                Order issues, partnerships, bulk orders, feedback — just drop us an email. We reply personally within 24 hours.
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-3 md:items-end">
                            
                                <a href={`mailto:${CONTACT_EMAIL}`}
                                className="inline-flex items-center gap-2.5 rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-3.5 text-sm font-black text-amber-800 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-100 active:scale-95"
                            >
                                <Mail size={16} strokeWidth={2.5} />
                                {CONTACT_EMAIL}
                            </a>
                            <p className="text-[11px] font-medium text-stone-400">Replies within 24 hours · No spam</p>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════
                    BOTTOM CTA GRADIENT
                ══════════════════════════════════════════ */}

                <section className="mx-auto max-w-7xl px-4 pb-16 md:px-8 md:pb-20">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 p-8 shadow-xl shadow-orange-200/60 md:p-12">
                        {/* Dot texture */}
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.07]"
                            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }}
                            aria-hidden="true"
                        />
                        {/* Glow blobs */}
                        <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
                        <div className="pointer-events-none absolute -bottom-12 left-1/4 h-40 w-40 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
                        <div className="pointer-events-none absolute left-0 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

                        <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-white/70">
                                    🍔 Always Hot. Always Fresh.
                                </p>
                                <h2 className="text-2xl font-black text-white md:text-4xl lg:text-5xl">
                                    Ready to eat?
                                </h2>
                                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 md:text-base">
                                    From crispy burgers to cold fresh juices — every item on the FoodKnock menu is made to order, delivered fast to your door in Danta & nearby areas.
                                </p>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    {[
                                        "🛵 25 Min Delivery",
                                        "🔥 Made Fresh",
                                        "⭐ 4.9 Rated",
                                        "💛 Family Kitchen",
                                    ].map((chip) => (
                                        <span key={chip} className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm">
                                            {chip}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col">
                                <Link
                                    href="/menu"
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-black text-orange-600 shadow-xl shadow-orange-700/20 transition-all hover:bg-orange-50 hover:scale-[1.03] active:scale-[0.98]"
                                >
                                    <UtensilsCrossed size={16} strokeWidth={2.5} />
                                    Order Now
                                </Link>
                                <Link
                                    href="/loyalty"
                                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/40 bg-white/10 px-8 py-4 text-sm font-black text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/60 active:scale-[0.98]"
                                >
                                    <Star size={15} strokeWidth={2.5} />
                                    Earn Rewards
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

            </main>
            <Footer />
        </>
    );
}