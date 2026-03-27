"use client";
export const dynamic = "force-dynamic";

// src/app/order-success/page.tsx
//
// ── "0 pts" root cause & fix ──────────────────────────────────────────────────
// PROBLEM: Previous code fetched `/api/orders/${orderId}` where orderId is the
// human-readable ID (e.g. "FK-ABC123") from the URL. But that API likely expects
// a MongoDB _id, or the response shape was { success, order: {...} } and parsing
// failed silently → totalAmount = undefined → calcOrderPoints(0) = 0 pts shown.
//
// FIX: Fetch `/api/loyalty` (already authenticated, returns full ledger).
// Find the matching entry by `entry.order.orderId === orderId` (human-readable
// orderId matches exactly). This gives us the exact points for this order
// without any shape mismatch. Also fetch the order total from the ledger note.
//
// If ledger entry for this order isn't found yet (order not delivered yet),
// fall back to fetching `/api/orders/by-order-id/${orderId}` which uses the
// human-readable orderId (not _id), and calculate points from totalAmount.

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link               from "next/link";
import Navbar             from "@/components/shared/Navbar";
import Footer             from "@/components/shared/Footer";
import {
    CheckCircle2, Clock, Flame, Package, Phone,
    ShoppingBag, Star, Sparkles, ArrowRight, Bike,
    ChefHat, Home, ReceiptText, Smartphone, Loader2,
    ChevronDown, Gift,
} from "lucide-react";

// ── Loyalty config — keep in sync with loyaltyService.ts ─────────────────────
const POINTS_PER_RUPEE     = 0.1;
const MIN_ORDER_FOR_POINTS = 189;

function calcOrderPoints(amount: number): number {
    if (!amount || amount < MIN_ORDER_FOR_POINTS) return 0;
    return Math.floor(amount * POINTS_PER_RUPEE);
}

// ── Ledger type meta ──────────────────────────────────────────────────────────
const TYPE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    order_reward:      { label: "Order Reward",     icon: "🛍️", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
    referral_referrer: { label: "Referral Bonus",   icon: "🤝", color: "text-violet-700",  bg: "bg-violet-50 border-violet-100"   },
    referral_referee:  { label: "Welcome Bonus",    icon: "🎁", color: "text-amber-700",   bg: "bg-amber-50 border-amber-100"     },
    redemption:        { label: "Points Redeemed",  icon: "💸", color: "text-rose-700",    bg: "bg-rose-50 border-rose-100"       },
    admin_credit:      { label: "Bonus Credit",     icon: "⭐", color: "text-blue-700",    bg: "bg-blue-50 border-blue-100"       },
    admin_debit:       { label: "Admin Adjustment", icon: "📋", color: "text-stone-500",   bg: "bg-stone-50 border-stone-100"     },
    expiry:            { label: "Points Expired",   icon: "⏰", color: "text-stone-400",   bg: "bg-stone-50 border-stone-100"     },
};

type LedgerEntry = {
    id: string; type: string; points: number; balanceAfter: number;
    note: string;
    order: { id: string; orderId: string } | null;
    createdAt: string;
};

const fmtDate = (iso: string) => {
    try {
        return new Date(iso).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
        });
    } catch { return ""; }
};

// ── Delivery steps ────────────────────────────────────────────────────────────
const DELIVERY_STEPS = [
    { icon: ReceiptText, label: "Order Confirmed",  sub: "We've received your order",       done: true  },
    { icon: ChefHat,     label: "Being Prepared",   sub: "Our kitchen is on it",            done: true  },
    { icon: Bike,        label: "Out for Delivery", sub: "Rider will call you when nearby", done: false },
    { icon: Home,        label: "Delivered",         sub: "Enjoy your meal! 🍽️",            done: false },
];

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimCounter({ to }: { to: number }) {
    const [val, setVal] = useState(0);
    const ref           = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        setVal(0);
        if (to === 0) return;
        const step = Math.max(1, Math.ceil(to / 30));
        ref.current = setInterval(() => {
            setVal((v) => {
                if (v + step >= to) { clearInterval(ref.current!); return to; }
                return v + step;
            });
        }, 30);
        return () => clearInterval(ref.current!);
    }, [to]);
    return <>{val}</>;
}

// ── Points earned card ────────────────────────────────────────────────────────
function PointsCard({
    pts, totalAmount, delivered, loading,
}: {
    pts: number; totalAmount: number; delivered: boolean; loading: boolean;
}) {
    const belowThreshold = !loading && pts === 0 && totalAmount > 0 && totalAmount < MIN_ORDER_FOR_POINTS;

    return (
        <div className="overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 shadow-sm">
            <div className="flex items-center gap-4 px-5 py-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-200">
                    <Sparkles size={20} className="text-white" />
                </div>
                <div className="flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-violet-500">
                        FoodKnock Rewards
                    </p>
                    {loading ? (
                        <div className="mt-1 flex items-center gap-2">
                            <Loader2 size={13} className="animate-spin text-violet-400" />
                            <span className="text-[12px] text-stone-400">Fetching your points…</span>
                        </div>
                    ) : belowThreshold ? (
                        <>
                            <p className="text-[13px] font-black text-stone-900">No points on this order</p>
                            <p className="text-[11px] text-stone-500">
                                Orders above ₹{MIN_ORDER_FOR_POINTS} earn points. Your order was ₹{Math.round(totalAmount)}.
                            </p>
                        </>
                    ) : pts === 0 ? (
                        <>
                            <p className="text-[13px] font-black text-stone-900">Points pending delivery</p>
                            <p className="text-[11px] text-stone-500">
                                Points will be credited once your order is marked delivered.
                            </p>
                        </>
                    ) : delivered ? (
                        <>
                            <p className="text-[13px] font-black text-stone-900">
                                <span className="text-violet-700"><AnimCounter to={pts} /> pts</span>{" "}
                                credited to your account! 🎉
                            </p>
                            <p className="text-[11px] text-stone-500">Points are now in your FoodKnock wallet.</p>
                        </>
                    ) : (
                        <>
                            <p className="text-[13px] font-black text-stone-900">
                                You'll earn{" "}
                                <span className="text-violet-700"><AnimCounter to={pts} /> pts</span>{" "}
                                on delivery
                            </p>
                            <p className="text-[11px] text-stone-500">
                                Points credited once your order is marked delivered.
                            </p>
                        </>
                    )}
                </div>
                {!loading && pts > 0 && (
                    <div className="shrink-0">
                        <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map((i) => (
                                <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                            ))}
                        </div>
                        <p className="mt-0.5 text-right text-[10px] font-bold text-stone-400">Loyalty</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Paginated ledger ──────────────────────────────────────────────────────────
const PAGE_SIZE = 5;

function LedgerSection({
    ledger, currentOrderId, loading,
}: {
    ledger: LedgerEntry[]; currentOrderId: string; loading: boolean;
}) {
    const [page, setPage] = useState(1);

    if (loading) {
        return (
            <div className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
                <div className="border-b border-violet-50 bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-4">
                    <p className="text-sm font-black text-stone-900">Points History</p>
                </div>
                <div className="flex items-center justify-center gap-2 py-10">
                    <Loader2 size={18} className="animate-spin text-violet-400" />
                    <span className="text-[12px] text-stone-400">Loading history…</span>
                </div>
            </div>
        );
    }

    if (ledger.length === 0) {
        return (
            <div className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
                <div className="border-b border-violet-50 bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-4">
                    <p className="text-sm font-black text-stone-900">Points History</p>
                </div>
                <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                    <span className="text-3xl">🌱</span>
                    <p className="text-sm font-black text-stone-700">No transactions yet</p>
                    <p className="max-w-[220px] text-[11px] text-stone-400">
                        Points will appear here once your order is delivered.
                    </p>
                </div>
            </div>
        );
    }

    const visible = ledger.slice(0, page * PAGE_SIZE);
    const hasMore = visible.length < ledger.length;

    return (
        <div className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-violet-50 bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">
                        <Gift size={14} className="text-violet-600" />
                    </div>
                    <p className="text-sm font-black text-stone-900">Points History</p>
                </div>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-0.5 text-[11px] font-black text-violet-600">
                    {ledger.length} {ledger.length === 1 ? "entry" : "entries"}
                </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-stone-50">
                {visible.map((entry) => {
                    const meta = TYPE_META[entry.type] ?? {
                        label: entry.type, icon: "📋",
                        color: "text-stone-500", bg: "bg-stone-50 border-stone-100",
                    };
                    const pts      = Number(entry.points) || 0;
                    const after    = Number(entry.balanceAfter) || 0;
                    const isCredit = pts > 0;
                    const isCurrent = entry.order?.orderId === currentOrderId;

                    return (
                        <div
                            key={entry.id}
                            className={`flex items-center gap-3 px-5 py-4 transition-colors ${
                                isCurrent ? "bg-violet-50/60" : ""
                            }`}
                        >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg ${meta.bg}`}>
                                {meta.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <p className={`text-[12px] font-black ${meta.color}`}>{meta.label}</p>
                                    {isCurrent && (
                                        <span className="rounded-full border border-violet-200 bg-violet-100 px-1.5 py-0.5 text-[9px] font-black text-violet-600">
                                            This order
                                        </span>
                                    )}
                                </div>
                                <p className="truncate text-[11px] text-stone-400">
                                    {entry.note || (entry.order?.orderId ? `Order #${entry.order.orderId}` : "—")}
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
                <div className="border-t border-violet-50 px-5 py-3">
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-100 bg-violet-50 py-2.5 text-[12px] font-black text-violet-600 transition-all hover:bg-violet-100 active:scale-[0.98]"
                    >
                        <ChevronDown size={14} strokeWidth={2.5} />
                        Load more ({ledger.length - visible.length} remaining)
                    </button>
                </div>
            )}

            {/* Footer */}
            <div className="border-t border-violet-50 px-5 py-3 text-center">
                <Link
                    href="/loyalty"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-500 transition-colors hover:text-violet-700"
                >
                    View full rewards dashboard <ArrowRight size={11} />
                </Link>
            </div>
        </div>
    );
}

// ── Main content ──────────────────────────────────────────────────────────────
function OrderSuccessContent() {
    const params  = useSearchParams();
    const orderId = params.get("orderId") ?? ""; // human-readable e.g. "FK-ABC123"

    const [visible,  setVisible]  = useState(false);
    const [ringDone, setRingDone] = useState(false);

    // Loyalty data
    const [ledger,       setLedger]       = useState<LedgerEntry[]>([]);
    const [pointsEarned, setPointsEarned] = useState(0);
    const [totalAmount,  setTotalAmount]  = useState(0);
    const [isDelivered,  setIsDelivered]  = useState(false);
    const [loyaltyLoading, setLoyaltyLoading] = useState(true);
    const [isLoggedIn,   setIsLoggedIn]   = useState(true);
    const fetchedRef = useRef(false);

    useEffect(() => {
        const t1 = setTimeout(() => setVisible(true),  100);
        const t2 = setTimeout(() => setRingDone(true), 900);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, []);

    // ── Single fetch: /api/loyalty gives us ledger + current order match ──────
    useEffect(() => {
        if (!orderId || fetchedRef.current) return;
        fetchedRef.current = true;

        fetch("/api/loyalty", { credentials: "include" })
            .then((r) => {
                if (r.status === 401 || r.status === 403) { setIsLoggedIn(false); return null; }
                return r.ok ? r.json() : null;
            })
            .then((d) => {
                if (!d?.success) { setIsLoggedIn(false); return; }

                const entries: LedgerEntry[] = Array.isArray(d.ledger) ? d.ledger : [];
                // Newest first
                entries.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setLedger(entries);

                // ── Find the order_reward entry for THIS order ────────────────
                // The ledger entry has entry.order.orderId = human-readable orderId
                const matchingReward = entries.find(
                    (e) => e.type === "order_reward" && e.order?.orderId === orderId
                );

                if (matchingReward) {
                    // Order already delivered — points credited, show actual amount
                    setPointsEarned(Math.abs(Number(matchingReward.points) || 0));
                    setIsDelivered(true);
                } else {
                    // Order not yet delivered — calculate expected points
                    // Try to get totalAmount from the order API as a fallback
                    fetch(`/api/orders/by-order-id/${orderId}`, { credentials: "include" })
                        .then((r) => r.ok ? r.json() : null)
                        .then((od) => {
                            const order = od?.order ?? od;
                            const total = Number(order?.totalAmount) || 0;
                            if (total > 0) {
                                setTotalAmount(total);
                                setPointsEarned(calcOrderPoints(total));
                            }
                        })
                        .catch(() => {
                            // If that route also 404s, try the generic orders route
                            fetch(`/api/orders/${orderId}`, { credentials: "include" })
                                .then((r) => r.ok ? r.json() : null)
                                .then((od) => {
                                    const order = od?.order ?? od;
                                    const total = Number(order?.totalAmount) || 0;
                                    setTotalAmount(total);
                                    setPointsEarned(calcOrderPoints(total));
                                })
                                .catch(() => {}); // non-fatal
                        });
                }
            })
            .catch(() => {})
            .finally(() => setLoyaltyLoading(false));
    }, [orderId]);

    return (
        <div className="relative mx-auto max-w-2xl px-4 py-12 md:py-16">

            {/* ── Success badge ── */}
            <div className={`mb-8 flex flex-col items-center text-center transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
                <div className="relative mb-6">
                    <div className={`absolute inset-0 rounded-full bg-emerald-400/20 transition-all duration-1000 ${ringDone ? "scale-[1.6] opacity-0" : "scale-100 opacity-100"}`} />
                    <div className={`absolute inset-0 rounded-full bg-emerald-400/15 transition-all duration-700 delay-200 ${ringDone ? "scale-[1.4] opacity-0" : "scale-100 opacity-100"}`} />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-2xl shadow-emerald-300/50">
                        <CheckCircle2 size={44} className="text-white" strokeWidth={2.5} />
                    </div>
                    {ringDone && (
                        <>
                            {[0, 60, 120, 180, 240, 300].map((deg) => (
                                <div
                                    key={deg}
                                    className="absolute h-2 w-2 animate-ping rounded-full bg-amber-400 shadow-sm shadow-amber-300"
                                    style={{
                                        top:               `${50 + 54 * Math.sin((deg * Math.PI) / 180)}%`,
                                        left:              `${50 + 54 * Math.cos((deg * Math.PI) / 180)}%`,
                                        animationDelay:    `${deg / 300}s`,
                                        animationDuration: "1.4s",
                                    }}
                                />
                            ))}
                        </>
                    )}
                </div>

                <h1 className="text-3xl font-black tracking-tight text-stone-900 md:text-4xl">
                    Order Placed! 🎉
                </h1>
                <p className="mt-2 text-base font-medium text-stone-500">
                    When Hunger Knocks,{" "}
                    <span className="font-black text-orange-500">FoodKnock Delivers.</span>
                </p>

                {orderId && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 shadow-sm">
                        <Package size={13} className="text-orange-500" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-stone-500">Order ID</span>
                        <span className="font-mono text-[13px] font-black text-stone-900">
                            {orderId.slice(-8).toUpperCase()}
                        </span>
                    </div>
                )}
            </div>

            {/* ── Cards ── */}
            <div className={`flex flex-col gap-4 transition-all duration-700 delay-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>

                {/* 1 · Delivery tracker */}
                <div className="overflow-hidden rounded-3xl border border-stone-100 bg-white shadow-sm">
                    <div className="border-b border-stone-100 bg-gradient-to-r from-orange-50/70 to-red-50/40 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <Bike size={18} className="text-orange-500" />
                            <div>
                                <p className="text-[13px] font-black text-stone-900">Your Order is on its way</p>
                                <p className="text-[11px] text-stone-500">Estimated time: 30–45 minutes</p>
                            </div>
                        </div>
                    </div>
                    <div className="px-5 py-5">
                        <div className="relative">
                            {DELIVERY_STEPS.map((step, i) => {
                                const Icon   = step.icon;
                                const last   = i === DELIVERY_STEPS.length - 1;
                                const active = !step.done && (i === 0 || DELIVERY_STEPS[i - 1]?.done);
                                return (
                                    <div key={step.label} className="relative flex gap-4">
                                        {!last && (
                                            <div className={`absolute left-[18px] top-10 h-full w-0.5 ${step.done ? "bg-emerald-200" : "bg-stone-100"}`} />
                                        )}
                                        <div className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                                            step.done   ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                                            : active    ? "border-orange-400 bg-orange-50 text-orange-500 shadow-md shadow-orange-100"
                                                        : "border-stone-200 bg-stone-50 text-stone-400"
                                        }`}>
                                            {step.done
                                                ? <CheckCircle2 size={16} className="text-emerald-500" strokeWidth={2.5} />
                                                : <Icon size={15} strokeWidth={1.8} />
                                            }
                                            {active && (
                                                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-orange-500" />
                                            )}
                                        </div>
                                        <div className={`pb-6 ${last ? "pb-0" : ""}`}>
                                            <p className={`text-[13px] font-black ${
                                                step.done ? "text-emerald-700" : active ? "text-orange-600" : "text-stone-400"
                                            }`}>
                                                {step.label}
                                                {active && (
                                                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-400">· In progress</span>
                                                )}
                                            </p>
                                            <p className={`text-[11px] ${step.done ? "text-stone-500" : "text-stone-400"}`}>
                                                {step.sub}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 2 · Rider notice */}
                <div className="flex items-start gap-4 rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-sky-50/60 px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100">
                        <Phone size={17} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-[13px] font-black text-stone-900">Rider will call you directly</p>
                        <p className="text-[12px] leading-relaxed text-stone-500">
                            When your order is out for delivery, our rider will call the mobile number you provided. Please keep your phone reachable!
                        </p>
                    </div>
                </div>

                {/* 3 · Points card */}
                <PointsCard
                    pts={pointsEarned}
                    totalAmount={totalAmount}
                    delivered={isDelivered}
                    loading={loyaltyLoading}
                />

                {/* 4 · Ledger (only for logged-in users) */}
                {isLoggedIn && (
                    <LedgerSection
                        ledger={ledger}
                        currentOrderId={orderId}
                        loading={loyaltyLoading}
                    />
                )}

                {/* 5 · Info strip */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { icon: Clock, label: "Prep time",  val: "10–15 min",  color: "text-amber-600 bg-amber-50 border-amber-100"   },
                        { icon: Bike,  label: "Delivery",   val: "20–30 min",  color: "text-orange-600 bg-orange-50 border-orange-100" },
                        { icon: Flame, label: "Made fresh", val: "Every time", color: "text-red-600 bg-red-50 border-red-100"          },
                    ].map(({ icon: Icon, label, val, color }) => (
                        <div key={label} className={`flex flex-col items-center rounded-2xl border px-3 py-3.5 text-center ${color}`}>
                            <Icon size={18} strokeWidth={1.8} />
                            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
                            <p className="text-[12px] font-black">{val}</p>
                        </div>
                    ))}
                </div>

                {/* 6 · CTAs */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <Link href="/menu"
                        className="group flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 text-[14px] font-black text-white shadow-lg shadow-orange-200/60 transition-all hover:brightness-105 active:scale-[0.98]">
                        <Package size={16} strokeWidth={2.5} />
                        Order More with Us
                        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link href="/my-orders"
                        className="group flex flex-1 items-center justify-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-6 py-4 text-[14px] font-black text-stone-700 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 active:scale-[0.98]">
                        <ShoppingBag size={16} strokeWidth={2.5} />
                        My Orders
                    </Link>
                </div>

                {/* 7 · App nudge */}
                <div className="flex items-center gap-4 rounded-3xl border border-stone-100 bg-white px-5 py-4 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-md shadow-orange-100">
                        <Smartphone size={17} className="text-white" />
                    </div>
                    <div>
                        <p className="text-[13px] font-black text-stone-900">Coming soon: FoodKnock App</p>
                        <p className="text-[11px] text-stone-500">
                            Real-time tracking · faster checkout · app-only deals.{" "}
                            <span className="font-bold text-orange-500">iOS & Android.</span>
                        </p>
                    </div>
                </div>

                {/* 8 · Brand note */}
                <div className="pb-4 pt-2 text-center">
                    <p className="text-[12px] font-bold text-stone-400">
                        Thank you for choosing{" "}
                        <span className="font-black text-orange-500">FoodKnock</span> 🧡
                    </p>
                    <p className="mt-0.5 text-[11px] italic text-stone-300">
                        "When Hunger Knocks, FoodKnock Delivers."
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function OrderSuccessPage() {
    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FAFAF9]">
                <div
                    className="pointer-events-none absolute left-0 right-0 top-0 h-64 opacity-30"
                    style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #fed7aa, transparent)" }}
                />
                <Suspense fallback={
                    <div className="flex min-h-[60vh] items-center justify-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
                    </div>
                }>
                    <OrderSuccessContent />
                </Suspense>
            </main>
            <Footer />
        </>
    );
}