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
//
// FoodKnock Phase 6 — final consistency pass. Token restyle (`--fk-*`,
// matching every other customer surface) + two real fixes found during
// the audit:
//   1. The "delivery tracker" below used to be a hardcoded, STATIC
//      4-step list (`done: true, true, false, false`) that never reflected
//      the order's actual status — it would keep showing "Confirmed +
//      Being Prepared" forever even if the order was already out for
//      delivery or delivered. This page already fetches the real
//      `orderMeta.status` (for CustomerCancelControl) but never used it to
//      drive the tracker. Replaced with the same real, status-driven
//      `OrderTimeline` component Order Detail uses (src/components/orders/
//      OrderTimeline.tsx) — one source of truth for "what does this status
//      mean visually," not two. Needed `orderMeta.orderType` added to the
//      local type/read — already returned by /api/orders/track/[orderId]
//      (src/app/api/orders/track/[orderId]/route.ts's `.select()` already
//      includes it), just wasn't being read here before.
//   2. Removed two fabricated, specific-sounding estimates that had no
//      backing data anywhere in the system (no ETA/prep-time field exists
//      on Order or Product): "Estimated time: 30–45 minutes" and the
//      "Prep time 10–15 min / Delivery 20–30 min" info strip. Real order
//      progress is now what the timeline shows instead.

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link               from "next/link";
import CustomerShell      from "@/components/shell/CustomerShell";
import Footer             from "@/components/shared/Footer";
import OrderTimeline      from "@/components/orders/OrderTimeline";
import CustomerCancelControl, { type CancellationState } from "@/components/orders/CustomerCancelControl";
import {
    CheckCircle2, Package, Phone,
    ShoppingBag, Star, Sparkles, ArrowRight, Bike,
    Smartphone, Loader2,
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
    order_reward:      { label: "Order Reward",     icon: "🛍️", color: "text-fk-success",  bg: "bg-fk-success/10 border-fk-success/20" },
    referral_referrer: { label: "Referral Bonus",   icon: "🤝", color: "text-violet-700",  bg: "bg-violet-50 border-violet-100"   },
    referral_referee:  { label: "Welcome Bonus",    icon: "🎁", color: "text-amber-700",   bg: "bg-fk-gold-soft border-amber-100"     },
    redemption:        { label: "Points Redeemed",  icon: "💸", color: "text-rose-700",    bg: "bg-rose-50 border-rose-100"       },
    admin_credit:      { label: "Bonus Credit",     icon: "⭐", color: "text-blue-700",    bg: "bg-blue-50 border-blue-100"       },
    admin_debit:       { label: "Admin Adjustment", icon: "📋", color: "text-fk-text-secondary", bg: "bg-fk-surface-interactive border-fk-border" },
    expiry:            { label: "Points Expired",   icon: "⏰", color: "text-fk-text-tertiary",  bg: "bg-fk-surface-interactive border-fk-border" },
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
        <div className="overflow-hidden rounded-fk-lg border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 shadow-sm">
            <div className="flex items-center gap-4 px-5 py-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-fk-md bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-200">
                    <Sparkles size={20} className="text-white" />
                </div>
                <div className="flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-violet-500">
                        FoodKnock Rewards
                    </p>
                    {loading ? (
                        <div className="mt-1 flex items-center gap-2">
                            <Loader2 size={13} className="animate-spin text-violet-400" />
                            <span className="text-[12px] text-fk-text-tertiary">Fetching your points…</span>
                        </div>
                    ) : belowThreshold ? (
                        <>
                            <p className="text-[13px] font-black text-fk-text">No points on this order</p>
                            <p className="text-[11px] text-fk-text-secondary">
                                Orders above ₹{MIN_ORDER_FOR_POINTS} earn points. Your order was ₹{Math.round(totalAmount)}.
                            </p>
                        </>
                    ) : pts === 0 ? (
                        <>
                            <p className="text-[13px] font-black text-fk-text">Points pending delivery</p>
                            <p className="text-[11px] text-fk-text-secondary">
                                Points will be credited once your order is marked delivered.
                            </p>
                        </>
                    ) : delivered ? (
                        <>
                            <p className="text-[13px] font-black text-fk-text">
                                <span className="text-violet-700"><AnimCounter to={pts} /> pts</span>{" "}
                                credited to your account! 🎉
                            </p>
                            <p className="text-[11px] text-fk-text-secondary">Points are now in your FoodKnock wallet.</p>
                        </>
                    ) : (
                        <>
                            <p className="text-[13px] font-black text-fk-text">
                                You&apos;ll earn{" "}
                                <span className="text-violet-700"><AnimCounter to={pts} /> pts</span>{" "}
                                on delivery
                            </p>
                            <p className="text-[11px] text-fk-text-secondary">
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
                        <p className="mt-0.5 text-right text-[10px] font-bold text-fk-text-tertiary">Loyalty</p>
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
            <div className="overflow-hidden rounded-fk-lg border border-violet-100 bg-fk-surface-elevated shadow-sm">
                <div className="border-b border-violet-50 bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-4">
                    <p className="text-sm font-black text-fk-text">Points History</p>
                </div>
                <div className="flex items-center justify-center gap-2 py-10">
                    <Loader2 size={18} className="animate-spin text-violet-400" />
                    <span className="text-[12px] text-fk-text-tertiary">Loading history…</span>
                </div>
            </div>
        );
    }

    if (ledger.length === 0) {
        return (
            <div className="overflow-hidden rounded-fk-lg border border-violet-100 bg-fk-surface-elevated shadow-sm">
                <div className="border-b border-violet-50 bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-4">
                    <p className="text-sm font-black text-fk-text">Points History</p>
                </div>
                <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                    <span className="text-3xl">🌱</span>
                    <p className="text-sm font-black text-fk-text-secondary">No transactions yet</p>
                    <p className="max-w-[220px] text-[11px] text-fk-text-tertiary">
                        Points will appear here once your order is delivered.
                    </p>
                </div>
            </div>
        );
    }

    const visible = ledger.slice(0, page * PAGE_SIZE);
    const hasMore = visible.length < ledger.length;

    return (
        <div className="overflow-hidden rounded-fk-lg border border-violet-100 bg-fk-surface-elevated shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-violet-50 bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-fk-sm bg-violet-100">
                        <Gift size={14} className="text-violet-600" />
                    </div>
                    <p className="text-sm font-black text-fk-text">Points History</p>
                </div>
                <span className="rounded-fk-pill border border-violet-200 bg-violet-50 px-3 py-0.5 text-[11px] font-black text-violet-600">
                    {ledger.length} {ledger.length === 1 ? "entry" : "entries"}
                </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-fk-border">
                {visible.map((entry) => {
                    const meta = TYPE_META[entry.type] ?? {
                        label: entry.type, icon: "📋",
                        color: "text-fk-text-secondary", bg: "bg-fk-surface-interactive border-fk-border",
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
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-fk-md border text-lg ${meta.bg}`}>
                                {meta.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <p className={`text-[12px] font-black ${meta.color}`}>{meta.label}</p>
                                    {isCurrent && (
                                        <span className="rounded-fk-pill border border-violet-200 bg-violet-100 px-1.5 py-0.5 text-[9px] font-black text-violet-600">
                                            This order
                                        </span>
                                    )}
                                </div>
                                <p className="truncate text-[11px] text-fk-text-tertiary">
                                    {entry.note || (entry.order?.orderId ? `Order #${entry.order.orderId}` : "—")}
                                </p>
                                <p className="text-[10px] text-fk-text-tertiary">{fmtDate(entry.createdAt)}</p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className={`text-sm font-black ${isCredit ? "text-fk-success" : "text-rose-500"}`}>
                                    {isCredit ? "+" : ""}{pts} pts
                                </p>
                                <p className="text-[10px] text-fk-text-tertiary">Bal: {after}</p>
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
                        className="flex w-full items-center justify-center gap-2 rounded-fk-lg border border-violet-100 bg-violet-50 py-2.5 text-[12px] font-black text-violet-600 transition-all hover:bg-violet-100 active:scale-[0.98]"
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

    // ── Phase 14: cancellation — order metadata needed by CustomerCancelControl ──
    // Reuses the existing public track-by-orderId endpoint (same one
    // /my-orders/[orderId] already uses) — no new route for this.
    // `orderType` added (Phase 6) — already returned by this same endpoint,
    // just wasn't read before; needed to drive the real OrderTimeline below.
    type OrderMeta = {
        _id: string;
        createdAt: string;
        status: string;
        orderType?: "delivery" | "pickup";
        paymentMethod?: string;
        cancellation?: CancellationState;
    };
    const [orderMeta, setOrderMeta]               = useState<OrderMeta | null>(null);
    // Lazy initializer reads `orderId` once at mount — avoids a synchronous
    // setState-in-effect for the "no orderId" case (nothing to fetch, so
    // loading is simply false from the start rather than flipped off inside
    // the effect body below).
    const [orderMetaLoading, setOrderMetaLoading] = useState<boolean>(() => !!orderId);
    const orderMetaFetchedRef = useRef(false);

    useEffect(() => {
        if (!orderId || orderMetaFetchedRef.current) return;
        orderMetaFetchedRef.current = true;

        fetch(`/api/orders/track/${encodeURIComponent(orderId)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.success && d.order) setOrderMeta(d.order); })
            .catch(() => {})
            .finally(() => setOrderMetaLoading(false));
    }, [orderId]);

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
                    <div className={`absolute inset-0 rounded-full bg-fk-success/20 transition-all duration-1000 ${ringDone ? "scale-[1.6] opacity-0" : "scale-100 opacity-100"}`} />
                    <div className={`absolute inset-0 rounded-full bg-fk-success/15 transition-all duration-700 delay-200 ${ringDone ? "scale-[1.4] opacity-0" : "scale-100 opacity-100"}`} />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-fk-success to-emerald-600 shadow-2xl shadow-emerald-300/50">
                        <CheckCircle2 size={44} className="text-white" strokeWidth={2.5} />
                    </div>
                    {ringDone && (
                        <>
                            {[0, 60, 120, 180, 240, 300].map((deg) => (
                                <div
                                    key={deg}
                                    className="absolute h-2 w-2 animate-ping motion-reduce:animate-none rounded-full bg-fk-gold shadow-sm shadow-amber-300"
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

                <h1 className="font-display text-3xl font-black tracking-tight text-fk-text md:text-4xl">
                    Order Placed! 🎉
                </h1>
                <p className="mt-2 text-base font-medium text-fk-text-secondary">
                    When Hunger Knocks,{" "}
                    <span className="font-black text-[var(--fk-accent)]">FoodKnock Delivers.</span>
                </p>

                {orderId && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-4 py-2 shadow-sm">
                        <Package size={13} className="text-[var(--fk-accent)]" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-fk-text-tertiary">Order ID</span>
                        <span className="font-mono text-[13px] font-black text-fk-text">
                            {orderId.slice(-8).toUpperCase()}
                        </span>
                    </div>
                )}
            </div>

            {/* ── Cards ── */}
            <div className={`flex flex-col gap-4 transition-all duration-700 delay-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>

                {/* 0 · Cancellation — PRIMARY location (Phase 14 §4). Shown
                    immediately after order placement, before My Orders is
                    ever needed. Disappears on its own once the order is no
                    longer in a cancellable status (handled inside the
                    component) or once orderMeta hasn't loaded yet. */}
                {!orderMetaLoading && orderMeta && orderMeta.status !== "cancelled" && (
                    <CustomerCancelControl
                        orderMongoId={orderMeta._id}
                        createdAt={orderMeta.createdAt}
                        status={orderMeta.status}
                        onCancelled={(cancellation) =>
                            setOrderMeta((prev) => prev && { ...prev, status: "cancelled", cancellation })
                        }
                    />
                )}

                {orderMeta?.status === "cancelled" && (
                    <div className="overflow-hidden rounded-fk-lg border border-fk-danger/25 bg-fk-danger/5 shadow-sm">
                        <div className="px-5 py-5">
                            <p className="text-base font-black text-fk-text">Order Cancelled</p>
                            <p className="mt-1 text-sm text-fk-text-secondary">Your order has been cancelled successfully.</p>
                            {orderMeta.cancellation?.refundStatus === "pending_manual" && (
                                <p className="mt-2 text-sm font-semibold text-fk-gold">Refund pending manual processing.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* 1 · Delivery tracker — real, status-driven (reuses the same
                    OrderTimeline Order Detail uses), not a static placeholder.
                    Shown once orderMeta has loaded and the order isn't
                    cancelled (cancelled already has its own card above). */}
                {!orderMetaLoading && orderMeta && orderMeta.status !== "cancelled" && (
                    <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
                        <div className="border-b border-fk-border bg-fk-surface-selected px-5 py-4">
                            <div className="flex items-center gap-3">
                                <Bike size={18} className="text-[var(--fk-accent)]" />
                                <div>
                                    <p className="text-[13px] font-black text-fk-text">Your Order Status</p>
                                    <p className="text-[11px] text-fk-text-secondary">We&apos;ll keep this updated as your order progresses</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-5">
                            <OrderTimeline
                                status={orderMeta.status}
                                orderType={orderMeta.orderType}
                                createdAt={orderMeta.createdAt}
                            />
                        </div>
                    </div>
                )}
                {orderMetaLoading && (
                    <div className="flex items-center justify-center gap-2 rounded-fk-lg border border-fk-border bg-fk-surface-elevated py-10 shadow-sm">
                        <Loader2 size={18} className="animate-spin text-fk-gold" />
                        <span className="text-[12px] text-fk-text-tertiary">Loading order status…</span>
                    </div>
                )}

                {/* 2 · Rider notice */}
                <div className="flex items-start gap-4 rounded-fk-lg border border-blue-100 bg-gradient-to-r from-blue-50/80 to-sky-50/60 px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-fk-md bg-blue-100">
                        <Phone size={17} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-[13px] font-black text-fk-text">Rider will call you directly</p>
                        <p className="text-[12px] leading-relaxed text-fk-text-secondary">
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

                {/* 5 · CTAs */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <Link href="/menu"
                        className="group flex flex-1 items-center justify-center gap-2.5 rounded-fk-lg bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-6 py-4 text-[14px] font-black text-white shadow-fk-lg transition-all hover:brightness-105 active:scale-[0.98]">
                        <Package size={16} strokeWidth={2.5} />
                        Order More with Us
                        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link href="/my-orders"
                        className="group flex flex-1 items-center justify-center gap-2.5 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-6 py-4 text-[14px] font-black text-fk-text-secondary shadow-sm transition-all hover:border-[var(--fk-accent)]/30 hover:bg-fk-surface-selected active:scale-[0.98]">
                        <ShoppingBag size={16} strokeWidth={2.5} />
                        My Orders
                    </Link>
                </div>

                {/* 6 · App nudge */}
                <div className="flex items-center gap-4 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-5 py-4 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-fk-md bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] shadow-fk-sm">
                        <Smartphone size={17} className="text-white" />
                    </div>
                    <div>
                        <p className="text-[13px] font-black text-fk-text">Coming soon: FoodKnock App</p>
                        <p className="text-[11px] text-fk-text-secondary">
                            Real-time tracking · faster checkout · app-only deals.{" "}
                            <span className="font-bold text-[var(--fk-accent)]">iOS & Android.</span>
                        </p>
                    </div>
                </div>

                {/* 7 · Brand note */}
                <div className="pb-4 pt-2 text-center">
                    <p className="text-[12px] font-bold text-fk-text-tertiary">
                        Thank you for choosing{" "}
                        <span className="font-black text-[var(--fk-accent)]">FoodKnock</span> 🧡
                    </p>
                    <p className="mt-0.5 text-[11px] italic text-fk-text-tertiary">
                        &quot;When Hunger Knocks, FoodKnock Delivers.&quot;
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function OrderSuccessPage() {
    return (
        <CustomerShell>
            <main className="min-h-screen bg-fk-bg">
                <div
                    className="pointer-events-none absolute left-0 right-0 top-0 h-64 opacity-30"
                    style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, var(--fk-gold-soft), transparent)" }}
                />
                <Suspense fallback={
                    <div className="flex min-h-[60vh] items-center justify-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-fk-gold-soft border-t-[var(--fk-accent)]" />
                    </div>
                }>
                    <OrderSuccessContent />
                </Suspense>
            </main>
            <Footer />
        </CustomerShell>
    );
}
