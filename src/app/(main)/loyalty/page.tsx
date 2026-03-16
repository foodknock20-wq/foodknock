"use client";

export const dynamic = "force-dynamic";

// src/app/(main)/loyalty/page.tsx
// FoodKnock Rewards — Premium redesign. Full page, both guest + auth states.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import {
    Star, Gift, Users, TrendingUp, Copy, CheckCheck,
    ShoppingBag, ChevronRight, ArrowLeft, Zap, Info,
    Loader2, Share2, Lock, ShoppingCart, Sparkles,
    Trophy, BadgePercent, Coins, ArrowRight,
} from "lucide-react";

// ── Config ─────────────────────────────────────────────────────────────────
const CFG = {
    MIN_ORDER:      130,
    REF_REFERRER:   50,
    REF_REFEREE:    25,
    PT_VALUE:       0.5,
    MAX_REDEEM_PCT: 20,
    MIN_REDEEM:     50,
} as const;

// ── Types ──────────────────────────────────────────────────────────────────
type LedgerEntry = {
    id: string; type: string; points: number; balanceAfter: number;
    note: string;
    order: { id: string; orderId: string; total: number } | null;
    referredUser: { name: string } | null;
    createdAt: string;
};
type LoyaltyData = {
    balance?: number; referralCode?: string | null;
    deliveredOrderCount?: number; pointValueInr?: number;
    minRedeem?: number; maxRedemptionPct?: number; ledger?: LedgerEntry[];
};

// ── Ledger type display map ────────────────────────────────────────────────
const TYPE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    order_reward:      { label: "Order Reward",     icon: "🛍️", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
    referral_referrer: { label: "Referral Bonus",   icon: "🤝", color: "text-violet-700",  bg: "bg-violet-50 border-violet-100"   },
    referral_referee:  { label: "Welcome Bonus",    icon: "🎁", color: "text-amber-700",   bg: "bg-amber-50 border-amber-100"     },
    redemption:        { label: "Points Redeemed",  icon: "💸", color: "text-rose-700",    bg: "bg-rose-50 border-rose-100"       },
    admin_credit:      { label: "Bonus Credit",     icon: "⭐", color: "text-blue-700",    bg: "bg-blue-50 border-blue-100"       },
    admin_debit:       { label: "Admin Adjustment", icon: "📋", color: "text-stone-500",   bg: "bg-stone-50 border-stone-100"     },
    expiry:            { label: "Points Expired",   icon: "⏰", color: "text-stone-400",   bg: "bg-stone-50 border-stone-100"     },
};

const fmtDate = (iso: string) => {
    try {
        return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return ""; }
};

// ══════════════════════════════════════════════════════════════════════════
//  GUEST PAGE
// ══════════════════════════════════════════════════════════════════════════
function LoyaltyGuestPage() {
    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FFFBF5]">

                {/* ── Hero ── */}
                <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400">
                    {/* Dot grid */}
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.08]"
                        style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
                    />
                    {/* Glow blobs */}
                    <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
                    <div className="pointer-events-none absolute -left-8 bottom-0 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300/10 blur-3xl" />

                    <div className="relative mx-auto max-w-2xl px-4 pb-14 pt-12 text-center">
                        {/* Eyebrow badge */}
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-1.5 backdrop-blur-sm">
                            <Star size={12} className="text-yellow-200" fill="currentColor" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                                FoodKnock Rewards
                            </span>
                            <Star size={12} className="text-yellow-200" fill="currentColor" />
                        </div>

                        <h1 className="text-4xl font-black leading-[1.1] text-white md:text-5xl lg:text-6xl">
                            Eat Well.<br />
                            <span className="text-yellow-200">Earn More.</span>
                        </h1>
                        <p className="mx-auto mt-5 max-w-sm text-sm font-medium leading-relaxed text-white/80">
                            Every FoodKnock order earns you points. Redeem them for real discounts, 
                            get rewarded for referring friends — all just by eating great food.
                        </p>

                        {/* CTA buttons */}
                        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                            <Link
                                href="/auth"
                                className="inline-flex items-center gap-2.5 rounded-2xl bg-white px-8 py-4 text-sm font-black text-orange-600 shadow-xl shadow-orange-900/25 transition-all hover:scale-[1.03] hover:shadow-orange-900/35 active:scale-[0.98]"
                            >
                                <Lock size={15} strokeWidth={2.5} />
                                Sign In to View Your Rewards
                            </Link>
                            <Link
                                href="/menu"
                                className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/15 px-7 py-4 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-[0.98]"
                            >
                                <ShoppingCart size={14} strokeWidth={2.5} />
                                Browse the Menu
                            </Link>
                        </div>

                        {/* Trust chips */}
                        <div className="mt-8 flex flex-wrap justify-center gap-3">
                            {[
                                { emoji: "⭐", text: "Earn on every order" },
                                { emoji: "🎁", text: "Refer & earn together" },
                                { emoji: "💰", text: "Redeem at checkout"   },
                                { emoji: "⚡", text: "Instant crediting"    },
                            ].map((t) => (
                                <div key={t.text} className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/12 px-3.5 py-1.5 backdrop-blur-sm">
                                    <span className="text-sm">{t.emoji}</span>
                                    <span className="text-[11px] font-bold text-white/90">{t.text}</span>
                                </div>
                            ))}
                        </div>

                        {/* Floating stat pills */}
                        <div className="mt-8 grid grid-cols-3 gap-3">
                            {[
                                { value: `₹${CFG.PT_VALUE}`,       label: "Per point",         color: "text-white"        },
                                { value: `${CFG.MAX_REDEEM_PCT}%`, label: "Max order discount", color: "text-yellow-200"   },
                                { value: `+${CFG.REF_REFERRER}`,   label: "Pts per referral",  color: "text-white"        },
                            ].map((s) => (
                                <div key={s.label} className="flex flex-col items-center gap-0.5 rounded-2xl border border-white/20 bg-white/12 px-3 py-3.5 backdrop-blur-sm">
                                    <span className={`text-xl font-black ${s.color}`}>{s.value}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">{s.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">

                    {/* ── Sign-in prompt card ── */}
                    <div className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
                        <div className="border-b border-orange-50 bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 shadow-md shadow-orange-200 text-2xl">
                                    🔒
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-stone-900">Your Rewards Are Waiting</h2>
                                    <p className="text-[12px] text-stone-500">Sign in to access your full dashboard</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-sm leading-relaxed text-stone-500">
                                Sign in to see your <span className="font-bold text-stone-700">points balance</span>, full transaction history, 
                                your unique referral code, and everything you've earned so far.
                            </p>
                            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                                <Link
                                    href="/auth"
                                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200 transition-all hover:brightness-110 active:scale-[0.98]"
                                >
                                    <Lock size={14} strokeWidth={2.5} />
                                    Sign In / Create Account
                                </Link>
                                <Link
                                    href="/menu"
                                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-3.5 text-sm font-bold text-orange-700 transition-all hover:bg-amber-100 active:scale-[0.98]"
                                >
                                    <ShoppingCart size={14} strokeWidth={2.5} />
                                    Browse Menu
                                </Link>
                            </div>
                            <p className="mt-4 text-center text-[11px] text-stone-400">
                                New to FoodKnock? Creating an account takes under 30 seconds — and it's completely free.
                            </p>
                        </div>
                    </div>

                    {/* ── How it works — connected steps ── */}
                    <div className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100">
                                <TrendingUp size={15} className="text-orange-600" />
                            </div>
                            <h2 className="text-base font-black text-stone-900">How FoodKnock Rewards Works</h2>
                        </div>

                        <div className="relative space-y-0">
                            {[
                                {
                                    step: "01", emoji: "🛒", title: "Order & Earn",
                                    desc: `Place any delivered order above ₹${CFG.MIN_ORDER} and earn 1 point for every ₹10 spent. Points hit your account the moment your order is delivered.`,
                                    accent: "border-orange-200 bg-orange-50",
                                    numBg: "from-orange-500 to-amber-500",
                                },
                                {
                                    step: "02", emoji: "🤝", title: "Refer Friends",
                                    desc: `Share your unique referral code. When your friend places their first delivered order, you earn +${CFG.REF_REFERRER} pts and they earn +${CFG.REF_REFEREE} pts — automatically.`,
                                    accent: "border-violet-200 bg-violet-50",
                                    numBg: "from-violet-500 to-purple-500",
                                },
                                {
                                    step: "03", emoji: "💰", title: "Redeem & Save",
                                    desc: `Use your points at checkout — 1 pt = ₹${CFG.PT_VALUE}. Cover up to ${CFG.MAX_REDEEM_PCT}% of any order total with your balance. No minimums on earning.`,
                                    accent: "border-emerald-200 bg-emerald-50",
                                    numBg: "from-emerald-500 to-teal-500",
                                },
                            ].map((s, i, arr) => (
                                <div key={s.step} className="relative flex gap-4">
                                    {/* Connector line */}
                                    {i < arr.length - 1 && (
                                        <div className="absolute left-5 top-14 h-[calc(100%-24px)] w-px bg-gradient-to-b from-amber-200 to-transparent" />
                                    )}
                                    {/* Step number */}
                                    <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${s.numBg} text-[11px] font-black text-white shadow-md mt-1`}>
                                        {s.step}
                                    </div>
                                    <div className={`mb-4 flex-1 rounded-2xl border ${s.accent} p-4`}>
                                        <div className="mb-1.5 flex items-center gap-2">
                                            <span className="text-xl">{s.emoji}</span>
                                            <p className="text-sm font-black text-stone-900">{s.title}</p>
                                        </div>
                                        <p className="text-[11px] leading-relaxed text-stone-500">{s.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Why you'll love it ── */}
                    <div className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
                                <Sparkles size={15} className="text-amber-600" />
                            </div>
                            <h2 className="text-base font-black text-stone-900">Why Customers Love FoodKnock Rewards</h2>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {[
                                {
                                    icon: "🏆",
                                    iconBg: "bg-amber-100",
                                    title: "Points that actually add up",
                                    desc: "Order regularly and watch your balance grow into real, usable savings. No tricks, no hidden catches.",
                                },
                                {
                                    icon: "⚡",
                                    iconBg: "bg-orange-100",
                                    title: "Instant crediting",
                                    desc: "Points land in your account the moment your order is delivered. No waiting, no manual claiming.",
                                },
                                {
                                    icon: "🎯",
                                    iconBg: "bg-rose-100",
                                    title: "Simple redemption",
                                    desc: "Apply your points at checkout with one tap. Got 200 points? That's ₹100 off your next order.",
                                },
                                {
                                    icon: "👥",
                                    iconBg: "bg-violet-100",
                                    title: "Earn with your friends",
                                    desc: "Share your referral code — every friend you bring in earns both of you bonus points. A genuine win-win.",
                                },
                            ].map((item) => (
                                <div key={item.title} className="flex gap-3 rounded-2xl border border-stone-100 bg-stone-50/60 p-4">
                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconBg} text-xl shadow-sm`}>
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-stone-800">{item.title}</p>
                                        <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Get started steps ── */}
                    <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-amber-50/80 to-yellow-50/60 p-6">
                        <h2 className="mb-5 text-base font-black text-stone-900">Get Started in 3 Steps</h2>
                        <div className="space-y-3">
                            {[
                                {
                                    num: "1",
                                    title: "Create your FoodKnock account",
                                    desc: "Sign up or log in — it takes under 30 seconds and it's completely free.",
                                    action: { label: "Sign In →", href: "/auth" },
                                },
                                {
                                    num: "2",
                                    title: "Browse the menu & place your first order",
                                    desc: `Explore our full menu and place a delivered order above ₹${CFG.MIN_ORDER}.`,
                                    action: { label: "View Menu →", href: "/menu" },
                                },
                                {
                                    num: "3",
                                    title: "Points credited automatically",
                                    desc: "The moment your order is delivered, points appear in your account. No steps needed.",
                                    action: null,
                                },
                            ].map((step) => (
                                <div key={step.num} className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-white/80 p-4">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-[12px] font-black text-white shadow-md shadow-orange-200">
                                        {step.num}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-stone-800">{step.title}</p>
                                        <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">{step.desc}</p>
                                    </div>
                                    {step.action && (
                                        <Link
                                            href={step.action.href}
                                            className="shrink-0 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-bold text-orange-600 transition-all hover:bg-orange-100"
                                        >
                                            {step.action.label}
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Final CTA ── */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 p-7 text-center shadow-xl shadow-orange-200/60">
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.08]"
                            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }}
                        />
                        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
                        <div className="relative">
                            <p className="mb-3 text-3xl">🍔</p>
                            <h3 className="text-xl font-black text-white">Ready to earn on your next meal?</h3>
                            <p className="mx-auto mt-2 max-w-xs text-sm text-white/80 leading-relaxed">
                                Sign in, add your favourites to the cart, and place your first order. Your points will be waiting.
                            </p>
                            <Link
                                href="/auth"
                                className="mt-6 inline-flex items-center gap-2.5 rounded-2xl bg-white px-8 py-3.5 text-sm font-black text-orange-600 shadow-xl shadow-orange-900/20 transition-all hover:scale-[1.03] active:scale-[0.98]"
                            >
                                <Lock size={14} strokeWidth={2.5} />
                                Join FoodKnock Rewards — It's Free
                            </Link>
                            <p className="mt-4 text-[11px] text-white/60">
                                Already have an account?{" "}
                                <Link href="/auth" className="font-bold text-white hover:underline">Sign in here</Link>
                            </p>
                        </div>
                    </div>

                    {/* ── Fine print ── */}
                    <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                        <p className="text-[11px] leading-relaxed text-stone-400">
                            Points are awarded only on delivered orders above ₹{CFG.MIN_ORDER}. Referral rewards are granted after your friend's first delivered order.
                            Points cannot be earned on guest checkout. Minimum {CFG.MIN_REDEEM} points required to redeem. Up to {CFG.MAX_REDEEM_PCT}% of any order
                            total can be paid with points. 1 point = ₹{CFG.PT_VALUE} value. Referral codes cannot be self-applied.
                            FoodKnock reserves the right to modify the rewards programme at any time.
                        </p>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}

// ══════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function LoyaltyPage() {
    const [data, setData]     = useState<LoyaltyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res  = await fetch("/api/loyalty", { credentials: "include" });
            const json = await res.json();
            if (!res.ok || !json.success) { setError(json.message ?? "Failed to load loyalty data"); return; }
            setData(json);
        } catch {
            setError("Something went wrong. Please refresh.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const copyCode = () => {
        if (!referralCode) return;
        navigator.clipboard.writeText(referralCode).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareViaWhatsApp = () => {
        if (!referralCode) return;
        const text = encodeURIComponent(
`🍔 You've gotta try FoodKnock!

I've been ordering from them and the food is seriously next level — super fresh, fast delivery, and great prices.

Use my referral code *${referralCode}* when you sign up 👉 https://foodknock.com

🎁 You'll get bonus loyalty points after your first delivery
🎉 I get rewards too — so we both win!

Trust me, once you try it you won't go back 😄

Order now 👉 https://foodknock.com`
        );
        window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
    };

    // ── Loading ────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <>
                <Navbar />
                <main className="min-h-screen bg-[#FFFBF5]">
                    <div className="mx-auto max-w-2xl space-y-4 px-4 py-12">
                        <div className="h-52 animate-pulse rounded-3xl bg-gradient-to-br from-amber-200/60 to-orange-200/40" />
                        {[200, 160, 180, 140].map((h, i) => (
                            <div key={i} className="animate-pulse rounded-2xl border border-amber-100 bg-amber-50/60" style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }} />
                        ))}
                        <div className="flex justify-center pt-2">
                            <Loader2 size={22} className="animate-spin text-amber-400" />
                        </div>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    // ── Auth error → guest page ────────────────────────────────────────────
    const isAuthError = !data || error === "Not authenticated" ||
        error?.toLowerCase().includes("suspended") || error?.toLowerCase().includes("session");
    if (isAuthError) return <LoyaltyGuestPage />;

    // ── Network error ─────────────────────────────────────────────────────
    if (error) {
        return (
            <>
                <Navbar />
                <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FFFBF5] px-4 text-center">
                    <div className="text-5xl">⚠️</div>
                    <h2 className="text-xl font-black text-stone-800">Couldn't Load Your Rewards</h2>
                    <p className="max-w-xs text-sm text-stone-500">{error}</p>
                    <button onClick={load} className="mt-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-6 py-2.5 text-sm font-bold text-orange-600 transition-all hover:bg-orange-100">
                        Try Again
                    </button>
                </main>
                <Footer />
            </>
        );
    }

    // ── Derive values ─────────────────────────────────────────────────────
    const balance             = Math.max(0, Number(data!.balance) || 0);
    const deliveredOrderCount = Math.max(0, Number(data!.deliveredOrderCount) || 0);
    const pointValueInr       = Number(data!.pointValueInr) || CFG.PT_VALUE;
    const minRedeem           = Number(data!.minRedeem) || CFG.MIN_REDEEM;
    const referralCode        = (data!.referralCode && data!.referralCode.length >= 4) ? data!.referralCode : null;
    const ledger              = Array.isArray(data!.ledger) ? data!.ledger : [];
    const balanceInRupees     = (balance * pointValueInr).toFixed(0);
    const canRedeem           = balance >= minRedeem;
    const ptsToRedeem         = Math.max(0, minRedeem - balance);

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FFFBF5]">

                {/* ── Hero / balance ── */}
                <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400">
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.08]"
                        style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
                    />
                    <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
                    <div className="pointer-events-none absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

                    <div className="relative mx-auto max-w-2xl px-4 pb-12 pt-8">
                        <Link
                            href="/my-orders"
                            className="mb-6 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/70 transition-colors hover:text-white"
                        >
                            <ArrowLeft size={12} /> My Orders
                        </Link>

                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur-sm">
                            <Star size={11} className="text-yellow-200" fill="currentColor" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">FoodKnock Rewards</span>
                        </div>

                        <h1 className="text-3xl font-black text-white md:text-4xl">Your Points</h1>

                        {/* Balance card */}
                        <div className="mt-5 rounded-3xl border border-white/20 bg-white/15 p-6 backdrop-blur-sm shadow-xl shadow-orange-900/10">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-white/60">Available Balance</p>
                                    <div className="mt-1.5 flex items-baseline gap-2">
                                        <span className="text-6xl font-black leading-none text-white">{balance}</span>
                                        <span className="text-xl font-bold text-white/60">pts</span>
                                    </div>
                                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1">
                                        <span className="text-sm font-black text-yellow-200">≈ ₹{balanceInRupees}</span>
                                        <span className="text-xs text-white/60">in savings</span>
                                    </div>
                                </div>
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/20 text-3xl backdrop-blur-sm shadow-inner">
                                    ⭐
                                </div>
                            </div>

                            {/* Status chips */}
                            <div className="mt-5 flex flex-wrap gap-2.5">
                                <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                                    <ShoppingBag size={12} className="text-white/80" />
                                    <span className="text-[12px] font-bold text-white">
                                        {deliveredOrderCount} order{deliveredOrderCount !== 1 ? "s" : ""} delivered
                                    </span>
                                </div>
                                {canRedeem ? (
                                    <div className="flex items-center gap-2 rounded-xl border border-yellow-300/30 bg-yellow-300/20 px-3 py-2">
                                        <Zap size={12} className="text-yellow-200" />
                                        <span className="text-[12px] font-bold text-yellow-100">Ready to redeem at checkout!</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                                        <Info size={12} className="text-white/60" />
                                        <span className="text-[12px] font-bold text-white/80">
                                            {ptsToRedeem} more pts to unlock redemption
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Progress bar to redeem */}
                            {!canRedeem && (
                                <div className="mt-4">
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                                        <div
                                            className="h-full rounded-full bg-white/70 transition-all duration-700"
                                            style={{ width: `${Math.min(100, (balance / minRedeem) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="mt-1.5 text-[10px] text-white/50">
                                        {balance} / {minRedeem} pts to redeem
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">

                    {/* ── Transaction history ── */}
                    <div className="rounded-3xl border border-amber-100 bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between border-b border-amber-50 bg-amber-50/50 px-5 py-4">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100">
                                    <Gift size={14} className="text-orange-600" />
                                </div>
                                <h2 className="text-sm font-black text-stone-900">Transaction History</h2>
                            </div>
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-0.5 text-[11px] font-black text-orange-600">
                                {ledger.length} {ledger.length === 1 ? "entry" : "entries"}
                            </span>
                        </div>

                        {ledger.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-14 text-center px-6">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 text-3xl shadow-sm border border-amber-100">
                                    🌱
                                </div>
                                <div>
                                    <p className="text-sm font-black text-stone-800">No transactions yet</p>
                                    <p className="mt-1 text-[12px] leading-relaxed text-stone-400 max-w-[200px] mx-auto">
                                        Place your first delivered order to start earning FoodKnock points!
                                    </p>
                                </div>
                                <Link
                                    href="/menu"
                                    className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-5 py-2 text-xs font-bold text-orange-600 transition-all hover:bg-orange-100"
                                >
                                    Explore the Menu <ChevronRight size={12} />
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-amber-50/80">
                                {ledger.map((entry) => {
                                    const meta     = TYPE_META[entry.type] ?? { label: entry.type, icon: "📋", color: "text-stone-500", bg: "bg-stone-50 border-stone-100" };
                                    const pts      = Number(entry.points) || 0;
                                    const after    = Number(entry.balanceAfter) || 0;
                                    const isCredit = pts > 0;
                                    return (
                                        <div key={entry.id} className="flex items-center gap-3 px-5 py-4">
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xl ${meta.bg}`}>
                                                {meta.icon}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-[12px] font-black ${meta.color}`}>{meta.label}</p>
                                                <p className="truncate text-[11px] text-stone-400">
                                                    {entry.note || (entry.order ? `Order #${entry.order.orderId}` : "")}
                                                </p>
                                                <p className="text-[10px] text-stone-300">{fmtDate(entry.createdAt)}</p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className={`text-sm font-black ${isCredit ? "text-emerald-600" : "text-rose-500"}`}>
                                                    {isCredit ? "+" : ""}{pts} pts
                                                </p>
                                                <p className="text-[10px] text-stone-400">Bal: {after}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── How it works (compact) ── */}
                    <div className="rounded-3xl border border-amber-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
                                <TrendingUp size={14} className="text-amber-600" />
                            </div>
                            <h2 className="text-sm font-black text-stone-900">How It Works</h2>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {[
                                {
                                    icon: "🛒", iconBg: "bg-orange-100",
                                    title: "Order & Earn",
                                    desc: `1 pt per ₹10 on delivered orders above ₹${CFG.MIN_ORDER}`,
                                },
                                {
                                    icon: "🤝", iconBg: "bg-violet-100",
                                    title: "Refer Friends",
                                    desc: `You earn ${CFG.REF_REFERRER} pts · friend earns ${CFG.REF_REFEREE} pts after first delivery`,
                                },
                                {
                                    icon: "💰", iconBg: "bg-emerald-100",
                                    title: "Redeem & Save",
                                    desc: `1 pt = ₹${pointValueInr} at checkout · up to ${CFG.MAX_REDEEM_PCT}% off any order`,
                                },
                            ].map((s) => (
                                <div key={s.title} className="flex flex-col gap-2.5 rounded-2xl border border-amber-50 bg-gradient-to-br from-amber-50/80 to-orange-50/50 p-4">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg} text-xl shadow-sm`}>
                                        {s.icon}
                                    </div>
                                    <p className="text-sm font-black text-stone-800">{s.title}</p>
                                    <p className="text-[11px] leading-relaxed text-stone-500">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Referral code card ── */}
                    {referralCode && (
                        <div className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm">
                            <div className="border-b border-amber-50 bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">
                                        <Users size={14} className="text-violet-600" />
                                    </div>
                                    <h2 className="text-sm font-black text-stone-900">Your Referral Code</h2>
                                </div>
                            </div>
                            <div className="p-5">
                                <p className="mb-5 text-[12px] leading-relaxed text-stone-500">
                                    Share your code when friends sign up on FoodKnock. Once they place their first delivered order —
                                    you earn <span className="font-bold text-violet-600">+{CFG.REF_REFERRER} pts</span> and
                                    they earn <span className="font-bold text-amber-600">+{CFG.REF_REFEREE} pts</span> automatically.
                                </p>

                                {/* Code display + actions */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 rounded-2xl border-2 border-dashed border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-4 text-center shadow-inner">
                                        <span className="font-mono text-2xl font-black tracking-[0.3em] text-orange-600">
                                            {referralCode}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={copyCode}
                                            title="Copy code"
                                            aria-label="Copy referral code"
                                            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all active:scale-95 ${
                                                copied
                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                                    : "border-amber-200 bg-amber-50 text-orange-600 hover:bg-amber-100"
                                            }`}
                                        >
                                            {copied ? <CheckCheck size={18} /> : <Copy size={18} />}
                                        </button>
                                        <button
                                            onClick={shareViaWhatsApp}
                                            title="Share"
                                            aria-label="Share referral code"
                                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-green-200 bg-green-50 text-green-600 transition-all hover:bg-green-100 active:scale-95"
                                        >
                                            <Share2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 p-3 text-center">
                                        <p className="text-xl font-black text-violet-700">+{CFG.REF_REFERRER} pts</p>
                                        <p className="text-[10px] font-semibold text-violet-400">You earn per referral</p>
                                    </div>
                                    <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 text-center">
                                        <p className="text-xl font-black text-amber-700">+{CFG.REF_REFEREE} pts</p>
                                        <p className="text-[10px] font-semibold text-amber-400">Your friend earns</p>
                                    </div>
                                </div>
                                <p className="mt-3 text-center text-[10px] text-stone-400">
                                    Credited after your friend's first delivered order · Codes can't be self-applied
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Quick actions ── */}
                    <div className="grid grid-cols-2 gap-3">
                        <Link
                            href="/menu"
                            className="group flex flex-col items-center gap-2.5 rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-5 text-center shadow-sm transition-all hover:border-orange-200 hover:shadow-md hover:shadow-orange-100/50 hover:-translate-y-0.5"
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm border border-orange-100">
                                🍔
                            </div>
                            <div>
                                <span className="block text-sm font-black text-stone-800">Order &amp; Earn</span>
                                <span className="block text-[10px] font-medium text-stone-500">1 pt per ₹10 spent</span>
                            </div>
                        </Link>
                        <Link
                            href="/checkout"
                            className="group flex flex-col items-center gap-2.5 rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 text-center shadow-sm transition-all hover:border-amber-200 hover:shadow-md hover:shadow-amber-100/50 hover:-translate-y-0.5"
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm border border-amber-100">
                                💰
                            </div>
                            <div>
                                <span className="block text-sm font-black text-stone-800">Redeem at Checkout</span>
                                <span className={`block text-[10px] font-medium ${canRedeem ? "text-emerald-600" : "text-stone-500"}`}>
                                    {canRedeem ? "✓ You're ready to save!" : `Need ${minRedeem} pts min`}
                                </span>
                            </div>
                        </Link>
                    </div>

                    {/* ── Fine print ── */}
                    <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                        <p className="text-[11px] leading-relaxed text-stone-400">
                            Points are awarded only on delivered orders above ₹{CFG.MIN_ORDER}. Referral rewards are granted after your friend's first delivered order.
                            Points cannot be earned on guest checkout. Minimum {minRedeem} points required to redeem. Up to {CFG.MAX_REDEEM_PCT}% of any order total
                            can be paid with points. 1 point = ₹{pointValueInr} value. Referral codes cannot be self-applied.
                            FoodKnock reserves the right to modify the rewards programme at any time.
                        </p>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}