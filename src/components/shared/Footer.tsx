import Link from "next/link";
import Image from "next/image";
import {
    MapPin,
    Mail,
    Clock,
    Instagram,
    Twitter,
    Facebook,
    ChevronRight,
    MessageCircle,
    Star,
    Zap,
    ShieldCheck,
    UtensilsCrossed,
} from "lucide-react";

const quickLinks = [
    { href: "/menu", label: "Browse Menu" },
    { href: "/my-orders", label: "My Orders" },
    { href: "/track-order", label: "Track Order" },
    { href: "/loyalty", label: "Rewards Programme" },
    { href: "/reviews", label: "Customer Reviews" },
    { href: "/contact", label: "Contact Us" },
    { href: "/auth", label: "Sign In / Register" },
];

const socialLinks = [
    { href: "https://instagram.com/food__knock", label: "Instagram", icon: Instagram },
    { href: "https://twitter.com", label: "Twitter / X", icon: Twitter },
    { href: "https://facebook.com", label: "Facebook", icon: Facebook },
];

const hoursData = [
    { day: "Mon – Sat", time: "10:00 AM – 8:00 PM" },
    { day: "Sunday", time: "10:00 AM – 7:00 PM" },
];

const trustBadges = [
    { icon: Zap, label: "Fast Delivery" },
    { icon: UtensilsCrossed, label: "Fresh Every Time" },
    { icon: ShieldCheck, label: "Secure Ordering" },
    { icon: Star, label: "Top Rated" },
];

export default function Footer() {
    return (
        <footer className="relative overflow-hidden bg-[#0D0A08] text-white">

            {/* ── Warm ambient glow ── */}
            <div
                className="pointer-events-none absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/3 -translate-y-1/3 rounded-full opacity-20 blur-3xl"
                style={{ background: "radial-gradient(circle, #FF5C1A 0%, transparent 70%)" }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/3 translate-y-1/3 rounded-full opacity-10 blur-3xl"
                style={{ background: "radial-gradient(circle, #FFB347 0%, transparent 70%)" }}
                aria-hidden="true"
            />

            {/* ── CTA Banner ── */}
            <div
                className="relative mx-4 mt-0 overflow-hidden rounded-b-3xl md:mx-8"
                style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 60%, #FFB347 100%)" }}
            >
                {/* Decorative rings */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/10" aria-hidden="true" />
                <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full border border-white/10" aria-hidden="true" />
                <div className="pointer-events-none absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-black/10 blur-2xl" aria-hidden="true" />

                <div className="relative px-6 py-10 md:px-12 md:py-12">
                    <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-amber-100/70">
                                Freshly Prepared After Your Order
                            </p>
                            <h2
                                className="mt-2 text-2xl font-black leading-tight text-white md:text-3xl"
                                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                            >
                                Craving something?<br />
                                <span className="text-amber-100">We deliver fast.</span>
                            </h2>
                            <p className="mt-2 text-sm text-white/70">
                                Real food, real fast — right at your doorstep.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/menu"
                                className="group flex items-center gap-2 rounded-2xl bg-orange-300 px-7 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:bg-orange-400 hover:shadow-xl"
                            >
                                Order Now
                                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                            </Link>
                            <a
                                href="mailto:foodknock20@gmail.com"
                                className="flex items-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20"
                            >
                                <MessageCircle size={15} />
                                Get Help
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Trust badges ── */}
            <div className="flex flex-wrap items-center justify-center gap-3 py-8 md:gap-5">
                {trustBadges.map(({ icon: Icon, label }) => (
                    <div
                        key={label}
                        className="flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-4 py-2 backdrop-blur-sm"
                    >
                        <span
                            className="flex h-6 w-6 items-center justify-center rounded-full"
                            style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FFB347 100%)" }}
                        >
                            <Icon size={11} className="text-white" strokeWidth={2.5} />
                        </span>
                        <span className="text-[11px] font-semibold text-white/60">{label}</span>
                    </div>
                ))}
            </div>

            {/* ── Divider ── */}
            <div
                className="mx-4 mb-12 h-px md:mx-8"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,92,26,0.3) 40%, rgba(255,179,71,0.3) 60%, transparent)" }}
            />

            {/* ── Main grid ── */}
            <div className="mx-auto max-w-7xl px-4 pb-12 md:px-8">
                <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">

                    {/* Brand */}
                    <div className="sm:col-span-2 lg:col-span-1">
                        <div className="mb-5 flex items-center gap-3">
                            <div
                                className="relative h-12 w-12 overflow-hidden rounded-2xl"
                                style={{ boxShadow: "0 4px 20px rgba(255,92,26,0.4)" }}
                            >
                                <Image
                                    src="/logo/logo.jpg"
                                    alt="FoodKnock"
                                    fill
                                    sizes="(max-width: 768px) 100vw, 300px"
                                    className="object-cover"
                                />
                            </div>
                            <div>
                                <p
                                    className="font-extrabold leading-none text-white"
                                    style={{ fontSize: "1.15rem", fontFamily: "'Playfair Display', Georgia, serif" }}
                                >
                                    FoodKnock
                                </p>
                                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-orange-400">
                                    Fresh · Fast · Delicious
                                </p>
                            </div>
                        </div>

                        <p className="text-[13px] leading-7 text-white/40">
                            Freshly prepared food, delivered with care. FoodKnock brings your favourite meals to your door — fast, honest, and satisfying.
                        </p>

                        {/* Social */}
                        <div className="mt-6 flex items-center gap-2">
                            {socialLinks.map(({ href, label, icon: Icon }) => (
                                <a
                                    key={label}
                                    href={href}
                                    aria-label={label}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 transition-all hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400"
                                >
                                    <Icon size={14} strokeWidth={2} />
                                </a>
                            ))}
                        </div>

                        {/* Website badge */}
                        <a
                            href="https://foodknock.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold text-white/40 transition-all hover:border-orange-500/30 hover:text-orange-400"
                        >
                            🌐 foodknock.com
                        </a>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="mb-6 text-[10px] font-extrabold uppercase tracking-[0.25em] text-orange-500">
                            Quick Links
                        </h3>
                        <ul className="space-y-2.5">
                            {quickLinks.map(({ href, label }) => (
                                <li key={href}>
                                    <Link
                                        href={href}
                                        className="group flex items-center gap-2.5 text-[13px] text-white/40 transition-colors hover:text-orange-400"
                                    >
                                        <span className="h-px w-3 rounded-full bg-white/20 transition-all duration-300 group-hover:w-5 group-hover:bg-orange-500" />
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="mb-6 text-[10px] font-extrabold uppercase tracking-[0.25em] text-orange-500">
                            Get In Touch
                        </h3>
                        <ul className="space-y-4">
                            <li>
                                <a
                                    href="https://maps.google.com/?q=FoodKnock"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-start gap-3 text-[13px] text-white/40 transition-colors hover:text-orange-400"
                                >
                                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 transition-colors group-hover:border-orange-500/30 group-hover:bg-orange-500/10">
                                        <MapPin size={13} className="text-orange-500/60" />
                                    </span>
                                    <span className="leading-relaxed">
                                        FoodKnock Kitchen<br />
                                        <span className="text-[11px] text-white/25 transition-colors group-hover:text-orange-400/60">
                                            Get directions →
                                        </span>
                                    </span>
                                </a>
                            </li>
                            <li>
                                <a
                                    href="mailto:foodknock20@gmail.com"
                                    className="group flex items-center gap-3 text-[13px] text-white/40 transition-colors hover:text-orange-400"
                                >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 transition-colors group-hover:border-orange-500/30 group-hover:bg-orange-500/10">
                                        <Mail size={13} className="text-orange-500/60" />
                                    </span>
                                    foodknock20@gmail.com
                                </a>
                            </li>
                            <li>
    <a
        href="tel:7307728292"
        class="group flex items-center gap-3 text-[13px] text-white/40 transition-colors hover:text-orange-400"
    >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 transition-colors group-hover:border-orange-500/30 group-hover:bg-orange-500/10">
            📞
        </span>
        7307728292
    </a>
</li>
                            <li>
                                <div className="mt-2 rounded-2xl border border-white/8 bg-white/4 p-4">
                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/25">Support Hours</p>
                                    <p className="text-[13px] font-semibold text-white/50">Mon–Sat · 10 AM – 8 PM</p>
                                    <p className="mt-1 text-[11px] text-white/25">We typically reply within 12-24 hours</p>
                                </div>
                            </li>
                        </ul>
                    </div>

                    {/* Hours */}
                    <div>
                        <h3 className="mb-6 text-[10px] font-extrabold uppercase tracking-[0.25em] text-orange-500">
                            We&apos;re Open
                        </h3>
                        <ul className="space-y-2">
                            {hoursData.map(({ day, time }) => (
                                <li
                                    key={day}
                                    className="flex flex-col gap-1 rounded-2xl border border-white/6 bg-white/4 px-4 py-3"
                                >
                                    <span className="text-[12px] font-bold text-white/60">{day}</span>
                                    <span className="flex items-center gap-1.5 text-[11px] text-white/30">
                                        <Clock size={10} className="text-orange-500/50" />
                                        {time}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {/* Live badge */}
                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                            </span>
                            <span className="text-[11px] font-bold text-emerald-400">Open Now · Taking Orders</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Bottom bar ── */}
            <div className="border-t border-white/5">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-[11px] text-white/25 sm:flex-row md:px-8">
                    <p>© 2026 FoodKnock. All rights reserved.</p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <Link href="/privacy" className="transition-colors hover:text-orange-400">Privacy Policy</Link>
                        <span className="text-white/15">·</span>
                        <Link href="/terms" className="transition-colors hover:text-orange-400">Terms of Service</Link>
                        <span className="text-white/15">·</span>
                        <a
                            href="https://foodknock.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-orange-400"
                        >
                            foodknock.com
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
