"use client";

export const dynamic = "force-dynamic";

// src/app/(main)/loyalty/page.tsx
// FoodKnock Rewards — Premium redesign. Full page, both guest + auth states.
//
// PERF PASS (Orders/Loyalty audit):
//   The ledger array was previously re-sorted with `[...data.ledger].sort()`
//   INLINE during render, after the loading/auth-error/network-error early
//   returns. That meant: (1) it re-ran on every render regardless of
//   whether `data` had actually changed — e.g. clicking "Copy referral
//   code" flips the unrelated `copied` state, which re-renders this whole
//   component and was re-sorting the full (up to 50-item) ledger array
//   again for no reason; and (2) a brand-new array reference was created
//   every render, which would also cause any child relying on referential
//   stability to treat it as "new data" even when it wasn't.
//   Fixed by computing `ledger` via `useMemo(() => ..., [data])`, moved
//   BEFORE the early returns (required — hooks must run unconditionally on
//   every render, so a memo can't live after conditional `return`s). Same
//   sorted output, same values, just skipped when `data` hasn't changed.
//   Expected CPU: removes a redundant O(n log n) sort + array copy on every
//   render that isn't triggered by a fresh /api/loyalty fetch (copy button,
//   any other local UI state toggle in this component).

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import SpinWheelSection from "@/components/loyalty/SpinWheelSection";
import RewardWalletSection from "@/components/loyalty/RewardWalletSection";
import { LOYALTY_CHANGED_EVENT } from "@/lib/clientEvents";
import {
    Star, Copy, CheckCheck, TrendingUp,
    ShoppingBag, ChevronRight, ArrowLeft, Zap, Info,
    Loader2, Share2, Lock, ShoppingCart, Sparkles,
    ChevronDown, Wallet,
} from "lucide-react";

// ── Loyalty UI 2.0 — only two primary destinations (URL-synced:
// /loyalty?tab=rewards|spin). History lives INSIDE Rewards, not as its
// own top-level tab — see §2 of the Loyalty UI 2.0 redesign spec.
const TABS = ["rewards", "spin"] as const;
type LoyaltyTab = typeof TABS[number];
function isLoyaltyTab(v: string | null): v is LoyaltyTab {
    return !!v && (TABS as readonly string[]).includes(v);
}

// ── Config ─────────────────────────────────────────────────────────────────
const CFG = {
    MIN_ORDER:      189,
    REF_REFERRER:   50,
    REF_REFEREE:    25,
    PT_VALUE:       0.5,
    MAX_REDEEM_PCT: 20,
    MIN_REDEEM:     50,
} as const;

const PAGE_SIZE = 8;

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

// ── Transaction History with Filter + Pagination ──────────────────────────
function TransactionHistory({ ledger }: { ledger: LedgerEntry[] }) {
    const [page,   setPage]   = useState(1);
    const [filter, setFilter] = useState<string>("all");

    const availableTypes = Array.from(new Set(ledger.map((e) => e.type)));
    const filtered       = filter === "all" ? ledger : ledger.filter((e) => e.type === filter);
    const visible        = filtered.slice(0, page * PAGE_SIZE);
    const hasMore        = visible.length < filtered.length;

    const applyFilter = (f: string) => { setFilter(f); setPage(1); };

    if (ledger.length === 0) {
        return (
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
        );
    }

    return (
        <>
            {/* Filter chips */}
            {availableTypes.length > 1 && (
                <div className="flex flex-wrap gap-2 border-b border-amber-50 px-5 py-3">
                    <button
                        onClick={() => applyFilter("all")}
                        className={`rounded-full border px-3 py-1 text-[11px] font-black transition-all ${filter === "all" ? "border-orange-300 bg-orange-100 text-orange-700" : "border-amber-100 bg-amber-50 text-stone-500 hover:border-orange-200"}`}
                    >
                        All ({ledger.length})
                    </button>
                    {availableTypes.map((type) => {
                        const meta  = TYPE_META[type];
                        const count = ledger.filter((e) => e.type === type).length;
                        if (!meta) return null;
                        return (
                            <button
                                key={type}
                                onClick={() => applyFilter(type)}
                                className={`rounded-full border px-3 py-1 text-[11px] font-black transition-all ${filter === type ? "border-orange-300 bg-orange-100 text-orange-700" : "border-amber-100 bg-amber-50 text-stone-500 hover:border-orange-200"}`}
                            >
                                {meta.icon} {meta.label} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Rows */}
            <div className="divide-y divide-amber-50/80">
                {visible.map((entry) => {
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
                                    {entry.note || (entry.order ? `Order #${entry.order.orderId}` : "") || (entry.referredUser?.name ? `Friend: ${entry.referredUser.name}` : "")}
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

            {/* Load more */}
            {hasMore && (
                <div className="border-t border-amber-50 px-5 py-3">
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 py-2.5 text-[12px] font-black text-orange-600 transition-all hover:bg-amber-100 active:scale-[0.98]"
                    >
                        <ChevronDown size={14} strokeWidth={2.5} />
                        Load more ({filtered.length - visible.length} remaining)
                    </button>
                </div>
            )}

            {filtered.length > PAGE_SIZE && (
                <p className="border-t border-amber-50 px-5 py-2 text-center text-[10px] text-stone-300">
                    Showing {Math.min(visible.length, filtered.length)} of {filtered.length} entries
                </p>
            )}
        </>
    );
}

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
                                href="/auth?mode=login"
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
                                    action: { label: "Sign In →", href: "/auth?mode=login" },
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
                                <Link href="/auth?mode=login" className="font-bold text-white hover:underline">Sign in here</Link>
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

    // ── Tab state — URL-synced, mirrors the ?mode= convention already
    // used by /auth (AuthTabs). Direct links, refresh, and browser
    // back/forward all work because the tab lives in the URL, not just
    // local state. An unknown/invalid ?tab= value safely falls back to
    // "overview" rather than rendering nothing.
    const router      = useRouter();
    const pathname    = usePathname();
    const searchParams = useSearchParams();
    const rawTab       = searchParams.get("tab");
    const activeTab: LoyaltyTab = isLoyaltyTab(rawTab) ? rawTab : "rewards";

    // push() (not replace()) deliberately — browser back/forward must
    // navigate between loyalty tabs (spec requirement), which replace()
    // cannot do since it never adds a history entry.
    const setTab = useCallback((tab: LoyaltyTab) => {
        const qs = new URLSearchParams(searchParams.toString());
        if (tab === "rewards") qs.delete("tab"); else qs.set("tab", tab);
        const suffix = qs.toString();
        router.push(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
    }, [router, pathname, searchParams]);

    // History lives inside Rewards as a collapsible section, not its own
    // tab — local UI state only, no new data source.
    const [showFullHistory, setShowFullHistory] = useState(false);

    // `background: true` (used by the Spin-refresh listener below) updates
    // `data` WITHOUT touching `loading` — the full-page skeleton below
    // (`if (loading) return ...`) unmounts everything under it, including
    // SpinWheelSection. That unmount was silently resetting the wheel's
    // in-progress rotation/result state back to its initial values right
    // as a spin's reveal animation was settling — a real bug found via
    // browser automation (the wheel's rendered rotation read back as 0
    // immediately after every spin). The skeleton must only ever appear
    // for the TRUE first load, never for a background balance refresh.
    const load = useCallback(async (opts: { background?: boolean } = {}) => {
        if (!opts.background) setLoading(true);
        setError(null);
        try {
            const res  = await fetch("/api/loyalty", { credentials: "include" });
            const json = await res.json();
            if (!res.ok || !json.success) { setError(json.message ?? "Failed to load loyalty data"); return; }
            setData(json);
        } catch {
            setError("Something went wrong. Please refresh.");
        } finally {
            if (!opts.background) setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Phase 12 finalization — re-fetch the hero balance after a successful
    // Spin (SpinWheelSection dispatches this once the result settles) so
    // it doesn't keep showing the pre-spin number until a full reload.
    // Background refresh — must NOT flip `loading` (see load()'s comment).
    useEffect(() => {
        const handler = () => load({ background: true });
        window.addEventListener(LOYALTY_CHANGED_EVENT, handler);
        return () => window.removeEventListener(LOYALTY_CHANGED_EVENT, handler);
    }, [load]);

    // PERF PASS: moved before the early returns below (Rules of Hooks —
    // hooks must run unconditionally on every render) and wrapped in
    // useMemo keyed on `data`. Previously this sort ran inline during
    // render on every re-render of this component (including unrelated
    // local state changes like `copied`), producing a brand-new sorted
    // array every time even when the underlying data hadn't changed.
    const ledger = useMemo(() => {
        return Array.isArray(data?.ledger)
            ? [...data!.ledger].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            : [];
    }, [data]);

    const copyCode = () => {
        if (!referralCode) return;
        navigator.clipboard.writeText(referralCode).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareViaWhatsApp = () => {
        if (!referralCode) return;
        // REFERRAL EXPERIENCE 2.0: this used to drop a bare domain link
        // into the message — the referral code existed but there was no
        // actual deep link that auto-applied it. /auth?ref=CODE opens
        // Create Account with the code pre-filled (see auth/page.tsx +
        // RegisterForm.tsx) — same hardcoded-domain convention already
        // used site-wide for canonical/share URLs (sitemap.ts, layout.tsx).
        const referralLink = `https://www.foodknock.com/auth?ref=${referralCode}`;
        const text = encodeURIComponent(
`🍔 You've gotta try FoodKnock!

I've been ordering from them and the food is seriously next level — super fresh, fast delivery, and great prices.

Sign up with my link and your referral code is applied automatically 👉 ${referralLink}

🎁 You'll get bonus loyalty points after your first delivery
🎉 I get rewards too — so we both win!

Trust me, once you try it you won't go back 😄`
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
                    <button onClick={() => load()} className="mt-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-6 py-2.5 text-sm font-bold text-orange-600 transition-all hover:bg-orange-100">
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
    const balanceInRupees     = (balance * pointValueInr).toFixed(0);
    const canRedeem           = balance >= minRedeem;
    const ptsToRedeem         = Math.max(0, minRedeem - balance);

    // ── Render ─────────────────────────────────────────────────────────────
    // Compact dashboard, not a landing page: neutral cream canvas, no
    // full-width orange hero. Orange is reserved for CTAs/active states.
    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FFFDF8]">
                <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-6">

                    {/* ── Compact header ── */}
                    <div className="flex items-center justify-between">
                        <div>
                            <Link
                                href="/my-orders"
                                className="mb-1 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-widest text-stone-400 transition-colors hover:text-orange-600"
                            >
                                <ArrowLeft size={11} /> My Orders
                            </Link>
                            <h1 className="text-[26px] font-black leading-tight text-stone-900 md:text-[30px]">
                                FoodKnock Rewards
                            </h1>
                            <p className="text-[12px] text-stone-500">Earn points. Redeem rewards. Spin &amp; win.</p>
                        </div>
                        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-xl sm:flex">
                            ⭐
                        </div>
                    </div>

                    {/* ── Compact balance card — horizontal on desktop, stacks on mobile ── */}
                    <div className="rounded-2xl border border-orange-100 bg-white px-5 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-baseline gap-3">
                                <span className="text-4xl font-black leading-none text-stone-900">{balance}</span>
                                <span className="text-sm font-bold text-stone-400">pts</span>
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-black text-amber-700">
                                    ≈ ₹{balanceInRupees} savings
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-stone-600">
                                    <ShoppingBag size={11} /> {deliveredOrderCount} order{deliveredOrderCount !== 1 ? "s" : ""}
                                </span>
                                {canRedeem ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                                        <Zap size={11} /> Ready to redeem
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-stone-500">
                                        <Info size={11} /> {ptsToRedeem} more to redeem
                                    </span>
                                )}
                            </div>
                        </div>
                        {!canRedeem && (
                            <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-stone-100">
                                <div
                                    className="h-full rounded-full bg-orange-400 transition-all duration-700"
                                    style={{ width: `${Math.min(100, (balance / minRedeem) * 100)}%` }}
                                />
                            </div>
                        )}
                    </div>

                    {/* ── Primary tabs — REWARDS / SPIN only, high on the page ── */}
                    <div
                        role="tablist"
                        aria-label="Loyalty sections"
                        className="mx-auto flex w-full gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm sm:w-auto sm:min-w-[320px]"
                    >
                        {([
                            { key: "rewards", label: "Rewards", icon: Wallet },
                            { key: "spin",    label: "Spin",    icon: Sparkles },
                        ] as const).map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                role="tab"
                                aria-selected={activeTab === key}
                                onClick={() => setTab(key)}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-black transition-colors ${
                                    activeTab === key
                                        ? "bg-orange-500 text-white shadow-sm"
                                        : "text-stone-400 hover:bg-stone-50 hover:text-stone-600"
                                }`}
                            >
                                <Icon size={14} />
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* ── Refer & Earn — compact promo strip, not a giant card ── */}
                    {referralCode && (
                        <div className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="text-lg">🎁</span>
                                <div>
                                    <p className="text-[12.5px] font-black text-stone-800">
                                        Refer &amp; Earn — give <span className="text-amber-700">+{CFG.REF_REFEREE} pts</span>, earn <span className="text-orange-600">+{CFG.REF_REFERRER} pts</span>
                                    </p>
                                    <p className="text-[10.5px] text-stone-400">Credited after their first delivered order</p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <div className="rounded-lg border border-dashed border-amber-300 bg-white px-3 py-1.5">
                                    <span className="font-mono text-[13px] font-black tracking-[0.2em] text-orange-600">{referralCode}</span>
                                </div>
                                <button
                                    onClick={copyCode}
                                    title="Copy code"
                                    aria-label="Copy referral code"
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                                        copied
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                            : "border-stone-200 bg-white text-stone-500 hover:border-orange-200 hover:text-orange-600"
                                    }`}
                                >
                                    {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
                                </button>
                                <button
                                    onClick={shareViaWhatsApp}
                                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-orange-500 px-3 text-[12px] font-black text-white transition-all hover:bg-orange-600 active:scale-95"
                                >
                                    <Share2 size={13} strokeWidth={2.5} /> Share
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Tab content ── */}
                    {activeTab === "rewards" && (
                        <div className="space-y-4">
                            {/* Reward Wallet — existing component, unmodified */}
                            <RewardWalletSection />

                            {/* Recent Activity — compact rows, no nested card chrome */}
                            <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                                    <h2 className="text-[13px] font-black text-stone-800">Recent Activity</h2>
                                    {ledger.length > 0 && (
                                        <button
                                            onClick={() => setShowFullHistory((v) => !v)}
                                            className="text-[11px] font-black text-orange-600 hover:underline"
                                        >
                                            {showFullHistory ? "Show less" : "View Full History"}
                                        </button>
                                    )}
                                </div>

                                {!showFullHistory ? (
                                    ledger.length === 0 ? (
                                        <p className="px-4 py-8 text-center text-[12px] text-stone-400">
                                            No activity yet — place your first order to start earning!
                                        </p>
                                    ) : (
                                        <div className="divide-y divide-stone-50">
                                            {ledger.slice(0, 5).map((entry) => {
                                                const meta = TYPE_META[entry.type] ?? { label: entry.type, icon: "📋", color: "text-stone-500", bg: "bg-stone-50 border-stone-100" };
                                                const pts = Number(entry.points) || 0;
                                                const isCredit = pts > 0;
                                                return (
                                                    <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm ${meta.bg}`}>
                                                            {meta.icon}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className={`text-[12px] font-black ${meta.color}`}>{meta.label}</p>
                                                            <p className="text-[10px] text-stone-300">{fmtDate(entry.createdAt)}</p>
                                                        </div>
                                                        <p className={`shrink-0 text-[13px] font-black ${isCredit ? "text-emerald-600" : "text-rose-500"}`}>
                                                            {isCredit ? "+" : ""}{pts} pts
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    // Existing TransactionHistory component, unmodified — reused
                                    // in place rather than duplicated/rebuilt.
                                    <TransactionHistory ledger={ledger} />
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "spin" && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                                <div>
                                    <h2 className="text-[13px] font-black text-stone-800">FoodKnock Spin</h2>
                                    <p className="text-[11px] text-stone-400">50 pts per spin</p>
                                </div>
                                <span className="rounded-full bg-amber-50 px-3 py-1 text-[12px] font-black text-amber-700">
                                    Balance: {balance} pts
                                </span>
                            </div>
                            {/* Existing Phase 12 Spin engine — unmodified */}
                            <SpinWheelSection />
                        </div>
                    )}

                    {/* ── Fine print — always visible regardless of tab ── */}
                    <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                        <p className="text-[10.5px] leading-relaxed text-stone-400">
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
