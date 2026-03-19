export const dynamic = "force-dynamic";

// src/app/(main)/auth/page.tsx
// Premium light warm food-brand auth page for FoodKnock — split layout with visual story

import AuthTabs from "@/components/auth/AuthTabs";
import Link from "next/link";
import { Star, Zap, Clock, ShieldCheck, ArrowLeft, Gift, Flame } from "lucide-react";

const BRAND_BENEFITS = [
    {
        icon: Zap,
        title: "Order in under 60 seconds",
        sub: "Cart saves, details remembered — ultra-fast checkout every time",
        bg: "bg-amber-50",
        border: "border-amber-200",
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
        emoji: "⚡",
    },
    {
        icon: Gift,
        title: "Exclusive member deals",
        sub: "Weekly offers, birthday surprises & early access to new items",
        bg: "bg-orange-50",
        border: "border-orange-200",
        iconColor: "text-orange-600",
        iconBg: "bg-orange-100",
        emoji: "🎁",
    },
    {
        icon: Clock,
        title: "Fresh food in 25 minutes",
        sub: "Hot, made-to-order delivery right to your doorstep",
        bg: "bg-red-50",
        border: "border-red-100",
        iconColor: "text-red-500",
        iconBg: "bg-red-100",
        emoji: "🛵",
    },
    {
        icon: ShieldCheck,
        title: "Earn loyalty points",
        sub: "Every order adds points. Redeem for free food & discounts.",
        bg: "bg-green-50",
        border: "border-green-200",
        iconColor: "text-green-600",
        iconBg: "bg-green-100",
        emoji: "💎",
    },
];

const TESTIMONIALS = [
    { name: "Priya S.",  text: "Best cold coffee & fastest delivery!",       avatar: "P", grad: "from-amber-400 to-orange-500" },
    { name: "Rahul M.",  text: "Smash burger every weekend, no complaints.",  avatar: "R", grad: "from-orange-400 to-red-500"   },
    { name: "Ananya K.", text: "Love the member deals every week 🔥",         avatar: "A", grad: "from-yellow-400 to-amber-500" },
];

type AuthPageProps = { searchParams?: Promise<{ redirect?: string }> };

export default async function AuthPage({ searchParams }: AuthPageProps) {
    const params     = await searchParams;
    const redirectTo = params?.redirect || "/";

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#FFFBF5]">

            {/* ── Ambient glow orbs ── */}
            <div
                className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full opacity-40 blur-3xl"
                style={{ background: "radial-gradient(ellipse, #fed7aa, transparent 70%)" }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute -right-40 bottom-10 h-[480px] w-[480px] rounded-full opacity-25 blur-3xl"
                style={{ background: "radial-gradient(ellipse, #fde68a, transparent 70%)" }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full opacity-10 blur-3xl"
                style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }}
                aria-hidden="true"
            />

            {/* Dot grid texture */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.022]"
                style={{
                    backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                }}
                aria-hidden="true"
            />

            <div className="relative mx-auto grid min-h-screen max-w-7xl px-4 py-10 md:grid-cols-[1fr_1fr] md:items-center md:gap-12 md:px-10 lg:gap-20 lg:py-14">

                {/* ════════════════════════════════════════════
                    LEFT — Visual story (desktop only)
                ════════════════════════════════════════════ */}
                <div className="hidden flex-col justify-center md:flex">

                    {/* Back link */}
                    <Link
                        href="/"
                        className="group mb-10 inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-xs font-black text-stone-500 shadow-sm backdrop-blur-sm transition-all hover:border-orange-300 hover:bg-white hover:text-orange-600"
                    >
                        <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
                        Back to FoodKnock
                    </Link>

                    {/* Brand identity */}
                    <div className="mb-7 flex items-center gap-4">
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-xl shadow-orange-200/60">
                            <span className="text-3xl">🍔</span>
                            <div className="absolute inset-0 rounded-2xl border-2 border-white/30" />
                            {/* Shine dot */}
                            <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-white/50" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500/70">Est. Sikar</p>
                            <p className="text-2xl font-black leading-tight tracking-tight text-stone-900">FoodKnock</p>
                            <p className="text-xs font-bold text-stone-400">Fresh. Fast. Flavourful.</p>
                        </div>
                    </div>

                    {/* Headline */}
                    <h1 className="text-[2.6rem] font-black leading-[1.12] tracking-tight text-stone-900 lg:text-[3.1rem]">
                        Your favourite café,{" "}
                        <span
                            className="bg-clip-text text-transparent"
                            style={{ backgroundImage: "linear-gradient(135deg, #ea580c 20%, #d97706 80%)" }}
                        >
                            now smarter.
                        </span>
                    </h1>
                    <p className="mt-5 max-w-[420px] text-[15px] leading-relaxed text-stone-500">
                        Sign in to unlock faster ordering, saved addresses, exclusive member deals, and a seamless checkout experience.
                    </p>

                    {/* Benefit cards */}
                    <div className="mt-8 flex flex-col gap-2.5">
                        {BRAND_BENEFITS.map(({ icon: Icon, emoji, title, sub, bg, border, iconBg, iconColor }) => (
                            <div
                                key={title}
                                className={`group flex items-start gap-4 rounded-2xl border ${border} ${bg} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-orange-100/60`}
                            >
                                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${border} ${iconBg} transition-transform duration-200 group-hover:scale-105`}>
                                    <Icon size={18} className={iconColor} strokeWidth={2} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-stone-900">{title}</p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{sub}</p>
                                </div>
                                <span className="ml-auto shrink-0 text-lg opacity-60">{emoji}</span>
                            </div>
                        ))}
                    </div>

                    {/* Social proof */}
                    <div className="mt-7 flex items-center gap-4 rounded-2xl border border-amber-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
                        <div className="flex -space-x-2.5">
                            {TESTIMONIALS.map(({ avatar, grad }) => (
                                <div
                                    key={avatar}
                                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br ${grad} text-[11px] font-black text-white shadow`}
                                >
                                    {avatar}
                                </div>
                            ))}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <div className="flex gap-0.5">
                                    {[1,2,3,4,5].map((i) => <Star key={i} size={12} className="fill-amber-400 text-amber-400" />)}
                                </div>
                                <span className="text-xs font-black text-stone-700">4.9 / 5</span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-stone-500">
                                Loved by <span className="font-black text-orange-600">2,450+</span> customers in Sikar & Danta
                            </p>
                        </div>
                    </div>

                    {/* Mini testimonials */}
                    <div className="mt-3 flex flex-col gap-2">
                        {TESTIMONIALS.map(({ name, text, avatar, grad }) => (
                            <div key={name} className="flex items-center gap-3 rounded-xl border border-stone-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${grad} text-[10px] font-black text-white shadow-sm`}>
                                    {avatar}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-stone-700">"{text}"</p>
                                    <p className="text-[10px] text-stone-400">— {name}</p>
                                </div>
                                <div className="flex gap-0.5 shrink-0">
                                    {[1,2,3,4,5].map((i) => <Star key={i} size={9} className="fill-amber-400 text-amber-400" />)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ════════════════════════════════════════════
                    RIGHT — Auth card
                ════════════════════════════════════════════ */}
                <div className="flex w-full flex-col items-center justify-center">

                    {/* Mobile back link */}
                    <Link
                        href="/"
                        className="group mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-stone-500 transition-colors hover:text-orange-600 md:hidden"
                    >
                        <ArrowLeft size={13} />
                        Back to FoodKnock
                    </Link>

                    <AuthTabs redirectTo={redirectTo} />

                    <p className="mt-5 text-center text-[11px] text-stone-400">
                        Need help?{" "}
                        <a href="mailto:foodknock20@gmail.com" className="font-bold text-orange-500 hover:underline">
                            foodknock20@gmail.com
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}