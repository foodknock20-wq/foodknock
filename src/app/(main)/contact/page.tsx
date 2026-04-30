export const dynamic = "force-dynamic";

// src/app/(main)/contact/page.tsx
// FoodKnock — Premium Support & Contact Hub

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Contact & Support — FoodKnock",
    description: "Need help with your order, rewards or delivery? FoodKnock customer care is always ready. Reach us via WhatsApp, call or email for fast, personal support.",
    alternates: { canonical: "https://www.foodknock.com/contact" },
    openGraph: {
        title: "FoodKnock Support Center",
        description: "Get in touch with FoodKnock customer care — orders, payments, rewards, partnerships and feedback.",
        url: "https://www.foodknock.com/contact",
    },
};

import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import {
    Mail, ArrowRight, Flame, Zap, ShieldCheck, Star,
    UtensilsCrossed, Heart, MessageCircle, Phone,
    Clock3, BadgeCheck, Headphones, Package,
    Building2, ChevronRight, Sparkles, ThumbsUp,
} from "lucide-react";

const CONTACT_EMAIL = "foodknock20@gmail.com";
const WHATSAPP_NUMBER = "918764821399";
const DISPLAY_NUMBER = "8764821399";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}`;
const TEL_LINK = `tel:+${WHATSAPP_NUMBER}`;

// ─── Support channels ─────────────────────────────────────────────────────
const CHANNELS = [
    {
        id: "whatsapp",
        icon: MessageCircle,
        emoji: "💬",
        label: "WhatsApp Support",
        headline: "Chat with us instantly",
        desc: "The fastest way to reach us. Send a message and get a reply within minutes — for orders, issues, or any question.",
        action: "Start Chat",
        href: WHATSAPP_LINK,
        target: "_blank",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        badgeBg: "bg-emerald-500",
        badgeText: "Fastest",
        gradient: "from-emerald-50 to-green-50",
    },
    {
        id: "call",
        icon: Phone,
        emoji: "📞",
        label: "Call Support",
        headline: "Speak to someone now",
        desc: "Prefer to talk? Call us directly during support hours and we'll sort out your order or query right away.",
        action: DISPLAY_NUMBER,
        href: TEL_LINK,
        target: "_self",
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        badgeBg: "bg-blue-500",
        badgeText: "Direct",
        gradient: "from-blue-50 to-sky-50",
    },
    {
        id: "email",
        icon: Mail,
        emoji: "✉️",
        label: "Email Support",
        headline: "Write to us anytime",
        desc: "For detailed queries, feedback, complaints, or anything that needs a thorough response — email is always open.",
        action: CONTACT_EMAIL,
        href: `mailto:${CONTACT_EMAIL}`,
        target: "_self",
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        badgeBg: "bg-amber-500",
        badgeText: "24h Reply",
        gradient: "from-amber-50 to-yellow-50",
    },
    {
        id: "business",
        icon: Building2,
        emoji: "🤝",
        label: "Business & Bulk Orders",
        headline: "Partner with FoodKnock",
        desc: "Planning a bulk order for an event, office, or partnership opportunity? Get in touch — we'd love to work together.",
        action: "Email Us",
        href: `mailto:${CONTACT_EMAIL}?subject=Business%20Enquiry%20—%20FoodKnock`,
        target: "_self",
        color: "text-violet-600",
        bg: "bg-violet-50",
        border: "border-violet-200",
        badgeBg: "bg-violet-500",
        badgeText: "Partnerships",
        gradient: "from-violet-50 to-purple-50",
    },
];

// ─── Support promises ─────────────────────────────────────────────────────
const PROMISES = [
    {
        icon: Zap,
        emoji: "⚡",
        title: "Rapid Response",
        desc: "WhatsApp queries answered in minutes. Email replies within 24 hours — usually much faster.",
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-100",
    },
    {
        icon: BadgeCheck,
        emoji: "✅",
        title: "Order Guaranteed",
        desc: "If something goes wrong with your order, we make it right. No arguments, no runaround.",
        color: "text-green-600",
        bg: "bg-green-50",
        border: "border-green-100",
    },
    {
        icon: Heart,
        emoji: "❤️",
        title: "Personal Care",
        desc: "Real people, not bots. Every message is handled personally by the FoodKnock team.",
        color: "text-rose-600",
        bg: "bg-rose-50",
        border: "border-rose-100",
    },
    {
        icon: ShieldCheck,
        emoji: "🔒",
        title: "Secure & Private",
        desc: "Your order details and personal information are always safe with us. We never share your data.",
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-100",
    },
];

// ─── Support hours ─────────────────────────────────────────────────────────
const SUPPORT_HOURS = [
    { channel: "WhatsApp", hours: "9:00 AM – 9:00 PM", days: "Every day", note: "Fastest replies" },
    { channel: "Phone / Call", hours: "10:00 AM – 8:00 PM", days: "Every day", note: "During kitchen hours" },
    { channel: "Email", hours: "Any time", days: "24 / 7", note: "Reply within 24 hrs" },
    { channel: "Business Enquiries", hours: "10:00 AM – 6:00 PM", days: "Mon – Sat", note: "Partnerships & bulk" },
];

// ─── Common support topics ─────────────────────────────────────────────────
const TOPICS = [
    { emoji: "🛵", text: "Order not delivered" },
    { emoji: "💳", text: "Payment issue" },
    { emoji: "🍔", text: "Wrong item received" },
    { emoji: "⭐", text: "Loyalty points query" },
    { emoji: "🔁", text: "Refund request" },
    { emoji: "📦", text: "Bulk / catering order" },
    { emoji: "🎁", text: "Promo code not working" },
    { emoji: "💬", text: "General feedback" },
];

export default function ContactPage() {
    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FFFBF5]">

                {/* ══════════════════════════════════════════
                    HERO
                ══════════════════════════════════════════ */}
                <div className="relative overflow-hidden border-b border-amber-100 bg-white">
                    {/* Warm background blobs */}
                    <div
                        className="pointer-events-none absolute -top-28 left-1/2 h-72 w-3/4 -translate-x-1/2 rounded-full opacity-50 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #fed7aa, transparent 70%)" }}
                        aria-hidden="true"
                    />
                    <div
                        className="pointer-events-none absolute right-0 top-0 h-64 w-64 opacity-20 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }}
                        aria-hidden="true"
                    />
                    <div
                        className="pointer-events-none absolute -bottom-10 left-0 h-48 w-48 opacity-15 blur-3xl"
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
                            <Headphones size={12} className="text-orange-500" strokeWidth={2.5} />
                            <span className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-600">
                                Support Center
                            </span>
                        </div>

                        <h1 className="max-w-4xl text-4xl font-black leading-[1.08] text-stone-900 md:text-5xl lg:text-6xl">
                            Need help with your{" "}
                            <span
                                className="bg-clip-text text-transparent"
                                style={{ backgroundImage: "linear-gradient(135deg, #ea580c 0%, #d97706 60%, #f59e0b 100%)" }}
                            >
                                order or rewards?
                            </span>
                        </h1>

                        <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-500 md:text-lg">
                            FoodKnock customer care is always ready to help with orders, payments, loyalty rewards, partnerships and feedback. Real people, real answers — fast.
                        </p>

                        {/* Quick action row */}
                        <div className="mt-7 flex flex-wrap gap-3">
                            <a
                                href={WHATSAPP_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-7 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-200 transition-all hover:brightness-110 active:scale-95"
                            >
                                <MessageCircle size={15} strokeWidth={2.5} />
                                Chat on WhatsApp
                            </a>
                            <a
                                href={TEL_LINK}
                                className="inline-flex items-center gap-2 rounded-full border-2 border-amber-200 bg-amber-50 px-6 py-3.5 text-sm font-black text-amber-800 transition-all hover:border-amber-300 hover:bg-amber-100 active:scale-95"
                            >
                                <Phone size={15} strokeWidth={2.5} />
                                Call Us Now
                            </a>
                        </div>

                        {/* Trust chips */}
                        <div className="mt-8 flex flex-wrap items-center gap-5">
                            {[
                                { icon: Zap, text: "Instant WhatsApp Reply" },
                                { icon: BadgeCheck, text: "Order Guaranteed" },
                                { icon: Heart, text: "Human Support, No Bots" },
                                { icon: Star, text: "4.9★ Customer Rating" },
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
                    CONTACT CHANNELS
                ══════════════════════════════════════════ */}
                <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
                    <div className="mb-8 text-center">
                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-orange-400">Get in Touch</p>
                        <h2 className="text-2xl font-black text-stone-900 md:text-3xl">Choose how you'd like to reach us</h2>
                        <p className="mt-2 text-sm text-stone-500">No waiting rooms, no hold music. Pick what works for you.</p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {CHANNELS.map((ch) => {
                            const Icon = ch.icon;
                            return (
                                <a
                                    key={ch.id}
                                    href={ch.href}
                                    target={ch.target}
                                    rel={ch.target === "_blank" ? "noopener noreferrer" : undefined}
                                    className={`group flex flex-col rounded-3xl border-2 bg-gradient-to-br ${ch.gradient} ${ch.border} p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl`}
                                >
                                    {/* Badge */}
                                    <div className="mb-4 flex items-start justify-between">
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${ch.bg} border ${ch.border}`}>
                                            <Icon size={21} className={ch.color} strokeWidth={2} />
                                        </div>
                                        <span className={`rounded-full ${ch.badgeBg} px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-sm`}>
                                            {ch.badgeText}
                                        </span>
                                    </div>

                                    <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">{ch.label}</p>
                                    <h3 className="text-base font-black text-stone-900">{ch.headline}</h3>
                                    <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-stone-500">{ch.desc}</p>

                                    <div className={`mt-5 inline-flex items-center gap-1.5 text-sm font-black ${ch.color} transition-all group-hover:gap-2.5`}>
                                        {ch.action}
                                        <ArrowRight size={13} strokeWidth={2.5} />
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </section>

                {/* ══════════════════════════════════════════
                    COMMON TOPICS
                ══════════════════════════════════════════ */}
                <section className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
                    <div className="rounded-3xl border border-amber-100 bg-white px-6 py-8 shadow-sm md:px-10 md:py-10">
                        <div className="mb-6 flex items-center gap-4">
                            <div>
                                <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.22em] text-orange-400">Common Topics</p>
                                <h2 className="text-xl font-black text-stone-900 md:text-2xl">What can we help you with?</h2>
                            </div>
                            <div className="h-px flex-1 bg-gradient-to-r from-amber-200 to-transparent" />
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {TOPICS.map(({ emoji, text }) => (
                                <a
                                    key={text}
                                    href={WHATSAPP_LINK}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3.5 text-[13px] font-semibold text-stone-700 transition-all hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                                >
                                    <span className="shrink-0 text-xl">{emoji}</span>
                                    <span className="leading-tight">{text}</span>
                                </a>
                            ))}
                        </div>

                        <p className="mt-5 text-center text-[11px] font-medium text-stone-400">
                            Tap any topic to start a WhatsApp conversation instantly
                        </p>
                    </div>
                </section>

                {/* ══════════════════════════════════════════
                    SUPPORT HOURS
                ══════════════════════════════════════════ */}
                <section className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
                    <div className="grid gap-5 lg:grid-cols-2">

                        {/* Hours table */}
                        <div className="flex flex-col rounded-3xl border-2 border-green-100 bg-white p-6 shadow-sm md:p-8">
                            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100">
                                <Clock3 size={20} className="text-green-600" strokeWidth={2} />
                            </div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-500">Availability</p>
                            <h3 className="text-xl font-black text-stone-900">Support Hours</h3>
                            <p className="mt-1.5 text-sm text-stone-500">We're here every day. Here's the best time to reach each channel.</p>

                            <div className="mt-5 space-y-0 overflow-hidden rounded-2xl border border-stone-100">
                                {SUPPORT_HOURS.map(({ channel, hours, days, note }, i) => (
                                    <div
                                        key={channel}
                                        className={`flex items-center justify-between gap-4 px-4 py-3.5 ${i !== SUPPORT_HOURS.length - 1 ? "border-b border-stone-100" : ""} ${i % 2 === 0 ? "bg-stone-50/50" : "bg-white"}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-black text-stone-800">{channel}</p>
                                            <p className="text-[10px] font-medium text-stone-400">{note}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-[12px] font-bold text-stone-700">{hours}</p>
                                            <p className="text-[10px] text-stone-400">{days}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 px-3 py-2.5">
                                <p className="text-center text-[11px] font-bold text-green-700">
                                    🟢 Support available every single day — no holidays
                                </p>
                            </div>
                        </div>

                        {/* Why trust us */}
                        <div className="flex flex-col rounded-3xl border-2 border-orange-100 bg-white p-6 shadow-sm md:p-8">
                            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100">
                                <ThumbsUp size={20} className="text-orange-600" strokeWidth={2} />
                            </div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Our Promise</p>
                            <h3 className="text-xl font-black text-stone-900">Why customers trust us</h3>
                            <p className="mt-1.5 text-sm text-stone-500">Support isn't just a feature — it's a core part of how FoodKnock works.</p>

                            <div className="mt-5 flex-1 space-y-3">
                                {[
                                    { emoji: "⚡", title: "WhatsApp replies in minutes", sub: "During support hours — usually under 5 minutes." },
                                    { emoji: "✅", title: "Order issues always resolved", sub: "Wrong item, late delivery, missing food — we fix it, guaranteed." },
                                    { emoji: "👤", title: "Real humans, never bots", sub: "Every message is read and replied to by a real person." },
                                    { emoji: "🔁", title: "Refunds processed promptly", sub: "Eligible refunds are issued quickly without hassle." },
                                    { emoji: "📊", title: "4.9★ average rating", sub: "Rated by thousands of satisfied customers across our network." },
                                ].map(({ emoji, title, sub }) => (
                                    <div key={title} className="flex items-start gap-3 rounded-2xl border border-stone-100 bg-stone-50/60 px-4 py-3">
                                        <span className="mt-0.5 shrink-0 text-xl leading-none">{emoji}</span>
                                        <div>
                                            <p className="text-[13px] font-black text-stone-800">{title}</p>
                                            <p className="text-[11px] leading-snug text-stone-500">{sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════
                    PROMISE CARDS
                ══════════════════════════════════════════ */}
                <section className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
                    <div className="mb-7 text-center">
                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-orange-400">Our Commitment</p>
                        <h2 className="text-2xl font-black text-stone-900 md:text-3xl">What you can always expect</h2>
                        <p className="mt-2 text-sm text-stone-500">Every interaction with FoodKnock support is built around these four principles.</p>
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
                    <div className="flex flex-col items-center gap-5 rounded-3xl border border-amber-100 bg-white px-6 py-10 text-center shadow-sm md:flex-row md:justify-between md:px-10 md:text-left">
                        <div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-500">Prefer Email?</p>
                            <h3 className="text-xl font-black text-stone-900 md:text-2xl">Write to us anytime</h3>
                            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-500">
                                For detailed queries, bulk orders, press, or partnership opportunities — email is open 24/7. Every message gets a personal reply within 24 hours.
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-3 md:items-end">
                            <a
                                href={`mailto:${CONTACT_EMAIL}`}
                                className="inline-flex items-center gap-2.5 rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-3.5 text-sm font-black text-amber-800 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-100 active:scale-95"
                            >
                                <Mail size={16} strokeWidth={2.5} />
                                {CONTACT_EMAIL}
                            </a>
                            <p className="text-[11px] font-medium text-stone-400">Replies within 24 hours · No spam, ever</p>
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
                                    💬 Always here for you
                                </p>
                                <h2 className="text-2xl font-black text-white md:text-4xl lg:text-5xl">
                                    We're just a message away.
                                </h2>
                                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 md:text-base">
                                    Whether it's a question about your order, a reward point query, or you just want to leave feedback — FoodKnock support has you covered, every single day.
                                </p>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    {[
                                        "💬 WhatsApp in Minutes",
                                        "📞 Call Anytime",
                                        "✅ Orders Guaranteed",
                                        "❤️ Human Support",
                                    ].map((chip) => (
                                        <span key={chip} className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm">
                                            {chip}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col">
                                <a
                                    href={WHATSAPP_LINK}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-black text-emerald-600 shadow-xl shadow-orange-700/20 transition-all hover:bg-emerald-50 hover:scale-[1.03] active:scale-[0.98]"
                                >
                                    <MessageCircle size={16} strokeWidth={2.5} />
                                    Chat on WhatsApp
                                </a>
                                <Link
                                    href="/menu"
                                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/40 bg-white/10 px-8 py-4 text-sm font-black text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/60 active:scale-[0.98]"
                                >
                                    <UtensilsCrossed size={15} strokeWidth={2.5} />
                                    Order Now
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