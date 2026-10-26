"use client";

// src/components/admin/orders/OrderTable.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 15C — Orders 2.0 live order list (server pagination/filtering,
// status-advance/cancel actions, 5s new-order polling — all unchanged).
//
// Phase 15E.6 — Admin UI 2.0 structural redesign. The previous layout was
// a 1/2/3-column grid of large cards — each one nesting a customer box, an
// address box, an items box, a promo-badge row, and a note box inside a
// single card, with "VIEW FULL DETAILS" as a near-invisible low-contrast
// link at the bottom. On a 1440px viewport that showed only 3 of 833
// orders without scrolling. Replaced with a dense operations table on
// desktop (one row per order: Order / Customer / Items / Total / Payment /
// Status / Time / Actions) and a compact single-card-per-order list on
// mobile — full detail (address, item breakdown, notes, promo/loyalty,
// refund state) now lives exclusively on the existing order detail page
// (/admin/orders/[id]), which this list already links to. No business
// logic changed: same status-advance/cancel handlers, same API calls, same
// polling, same quick-filter query params.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import {
    Bell, Package, Ban, AlertTriangle,
    Tag, Gift, ArrowRight, Eye, Loader2,
} from "lucide-react";
import Link from "next/link";
import {
    STATUS_CONFIG, FILTER_STATUSES, nextStatus, isCancellable, OrderStatusBadge,
} from "./OrderStatusBadge";
import CancelOrderModal from "./CancelOrderModal";
import type { OrderFiltersValue } from "./OrderFiltersBar";
import { formatINR } from "@/lib/analyticsFormat";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderItem = {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    image: string;
};

export type OrderRow = {
    _id: string;
    orderId: string;
    customerName: string;
    phone: string;
    address: string;
    landmark: string;
    orderType: string;
    items: OrderItem[];
    totalAmount: number;
    status: string;
    note: string;
    whatsappSent: boolean;
    createdAt: string;
    paymentMethod?: string;
    cancellationRefundStatus?: "not_applicable" | "pending_manual" | "completed";
    hasCoupon?: boolean;
    hasOffer?: boolean;
    hasLoyaltyRedemption?: boolean;
};

type Props = {
    orders: OrderRow[];
    statusCountMap: Record<string, number>;
    attentionCount: number;
    filtersValue: OrderFiltersValue;
};

type RowActionProps = {
    order: OrderRow;
    isNew: boolean;
    onStatusChange: (id: string, status: string) => Promise<void>;
    onRequestCancel: (id: string) => void;
};

// ─── Shared bits ──────────────────────────────────────────────────────────────

function shortTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
        ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
        : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function itemsSummary(items: OrderItem[]): string {
    if (items.length === 0) return "—";
    const first = items[0];
    const extra = items.length - 1;
    return extra > 0 ? `${first.name} +${extra} more` : first.name;
}

/** Advance/Cancel/View — the three real actions, as compact icon+label controls with clear contrast. */
function RowActions({ order, onStatusChange, onRequestCancel }: RowActionProps) {
    const [updating, setUpdating] = useState(false);
    const next = nextStatus(order.status);
    const cancellable = isCancellable(order.status);

    const handleAdvance = async () => {
        if (!next) return;
        setUpdating(true);
        await onStatusChange(order._id, next);
        setUpdating(false);
    };

    return (
        <div className="flex items-center gap-1.5">
            {next && (
                <button
                    onClick={handleAdvance}
                    disabled={updating}
                    title={`Mark as ${STATUS_CONFIG[next]?.label}`}
                    className="flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/12 px-2.5 py-1.5 text-[11px] font-bold text-orange-300 transition-all hover:border-orange-400/50 hover:bg-orange-500/20 disabled:cursor-wait disabled:opacity-50"
                >
                    {updating ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} strokeWidth={2.5} />}
                    <span className="hidden lg:inline">{STATUS_CONFIG[next]?.label}</span>
                </button>
            )}
            {cancellable && (
                <button
                    onClick={() => onRequestCancel(order._id)}
                    disabled={updating}
                    title="Cancel order"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-400 transition-all hover:border-rose-400/45 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Ban size={12} strokeWidth={2.5} />
                </button>
            )}
            <Link
                href={`/admin/orders/${order._id}`}
                title="View full details"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-stone-300 transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
            >
                <Eye size={12} strokeWidth={2} />
            </Link>
        </div>
    );
}

function IndicatorIcons({ order }: { order: OrderRow }) {
    if (!order.hasCoupon && !order.hasOffer && !order.hasLoyaltyRedemption && order.cancellationRefundStatus !== "pending_manual") return null;
    return (
        <div className="mt-1 flex items-center gap-1">
            {order.hasCoupon && <Tag size={10} className="text-emerald-400" aria-label="Coupon used" />}
            {order.hasOffer && <Tag size={10} className="text-emerald-400" aria-label="Offer used" />}
            {order.hasLoyaltyRedemption && <Gift size={10} className="text-amber-400" aria-label="Loyalty redeemed" />}
            {order.cancellationRefundStatus === "pending_manual" && <AlertTriangle size={10} className="text-rose-400" aria-label="Refund pending" />}
        </div>
    );
}

// ─── Desktop row ──────────────────────────────────────────────────────────────

function OrderDesktopRow(props: RowActionProps) {
    const { order, isNew } = props;
    return (
        <tr className={`group transition-colors ${isNew ? "bg-amber-500/[0.06]" : "hover:bg-white/[0.02]"}`}>
            <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-bold text-stone-100 max-w-[160px]">{order.customerName}</p>
                    {isNew && <Bell size={10} className="text-amber-400" />}
                </div>
                <p className="text-[11px] text-stone-500">{order.phone}</p>
                {order.orderType === "pickup" && (
                    <span className="mt-0.5 inline-block rounded-full border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-300">
                        Pickup
                    </span>
                )}
            </td>
            <td className="px-4 py-3">
                {/* Order ID — secondary/muted, but always the FULL id, never
                    truncated: still the operational reference for payment
                    reconciliation and support lookups, just not the lead
                    visual element (see Phase 2 Orders UX brief). */}
                <span className="font-mono text-[11px] text-stone-500">{order.orderId}</span>
            </td>
            <td className="px-4 py-3">
                <p className="truncate text-[12px] text-stone-400 max-w-[200px]">{itemsSummary(order.items)}</p>
                <IndicatorIcons order={order} />
            </td>
            <td className="px-4 py-3">
                <span className="font-mono text-[13px] font-bold text-stone-100">{formatINR(order.totalAmount)}</span>
            </td>
            <td className="px-4 py-3">
                <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-bold uppercase text-stone-300">
                    {order.paymentMethod ?? "cod"}
                </span>
            </td>
            <td className="px-4 py-3">
                <OrderStatusBadge status={order.status} />
            </td>
            <td className="px-4 py-3">
                <span className="text-[11.5px] text-stone-400">{shortTime(order.createdAt)}</span>
            </td>
            <td className="px-4 py-3">
                <RowActions {...props} />
            </td>
        </tr>
    );
}

// ─── Mobile card — compact, single level (no nested boxes) ───────────────────

function OrderMobileCard(props: RowActionProps) {
    const { order, isNew } = props;
    return (
        <div
            className={`rounded-xl border p-3.5 transition-colors ${isNew ? "border-amber-400/40 bg-amber-500/[0.05]" : "border-white/[0.06] bg-[#0f0f16]"
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="truncate text-[13px] font-bold text-stone-100">{order.customerName}</p>
                        {isNew && <Bell size={10} className="text-amber-400" />}
                    </div>
                    <p className="text-[11px] text-stone-500">{order.phone} · {shortTime(order.createdAt)}</p>
                    {/* Order ID — secondary/muted, full id always visible. */}
                    <p className="mt-0.5 font-mono text-[10.5px] text-stone-600">{order.orderId}</p>
                </div>
                <OrderStatusBadge status={order.status} />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
                <p className="truncate text-[11.5px] text-stone-400">{itemsSummary(order.items)}</p>
                <span className="shrink-0 font-mono text-[13px] font-bold text-stone-100">{formatINR(order.totalAmount)}</span>
            </div>
            <IndicatorIcons order={order} />

            <div className="mt-3 flex items-center justify-between gap-2">
                <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-bold uppercase text-stone-300">
                    {order.paymentMethod ?? "cod"}
                </span>
                <RowActions {...props} />
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrderTable({ orders, statusCountMap, attentionCount, filtersValue }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [newIds, setNewIds] = useState<Set<string>>(new Set());
    const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

    const knownIdsRef = useRef<Set<string>>(new Set(orders.map((o) => o._id)));
    useEffect(() => {
        knownIdsRef.current = new Set(orders.map((o) => o._id));
    }, [orders]);

    const lastSeenIdRef = useRef<string | null>(orders[0]?._id ?? null);
    const userInteractedRef = useRef(false);

    // ── Autoplay gate ──
    useEffect(() => {
        const unlock = () => { userInteractedRef.current = true; };
        window.addEventListener("click", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
        return () => {
            window.removeEventListener("click", unlock);
            window.removeEventListener("keydown", unlock);
        };
    }, []);

    // ── 5-second live polling — TOAST/SOUND ONLY, never mutates the
    //    rendered (server-filtered/paginated) list. ──
    //
    // INCIDENT (Vercel Fluid Active CPU): this poll fires every 5s for as long
    // as an admin tab stays OPEN. A tab left open in the background still
    // issued a GET /api/orders every 5s — a serverless function invocation +
    // DB read each time — around the clock, for zero benefit when nobody is
    // looking. It is now gated on document.visibilityState: no request is made
    // while the tab is hidden, and a fresh poll runs the instant the tab
    // becomes visible again — so the live new-order toast/sound is fully
    // preserved whenever the admin is actually watching, with no change to the
    // 5s cadence while the tab is focused.
    useEffect(() => {
        const poll = async () => {
            // Skip the network round-trip entirely while the tab is hidden.
            if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
            try {
                const res = await fetch("/api/orders?limit=200&fields=minimal", { cache: "no-store" });
                const data = await res.json();
                if (!data.success || !Array.isArray(data.orders)) return;

                const latest: Array<{ _id: string; customerName: string; totalAmount: number }> = data.orders;
                if (!latest.length) return;

                const latestId = latest[0]._id;
                if (latestId === lastSeenIdRef.current) return;

                const brandNew = latest.filter((o) => !knownIdsRef.current.has(o._id));
                lastSeenIdRef.current = latestId;
                if (!brandNew.length) return;

                const freshIds = new Set(brandNew.map((o) => o._id));
                setNewIds((prev) => new Set([...prev, ...freshIds]));
                setTimeout(() => {
                    setNewIds((prev) => {
                        const next = new Set(prev);
                        freshIds.forEach((id) => next.delete(id));
                        return next;
                    });
                }, 8000);

                brandNew.forEach((o) => {
                    toast.custom(
                        (t) => (
                            <div className={`flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-[#13131c] px-4 py-3 shadow-2xl shadow-black/50 transition-all ${t.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                                    <Bell size={16} className="text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-black text-white">New Order 🔥</p>
                                    <p className="text-[11px] text-stone-400">{o.customerName} · {formatINR(o.totalAmount)}</p>
                                </div>
                            </div>
                        ),
                        { duration: 5000 }
                    );
                });

                if (userInteractedRef.current) {
                    try { await new Audio("/notification.mp3").play(); } catch { /* non-fatal */ }
                }

                // A brand-new order landed — the current list/counts are now
                // stale for anyone viewing "All"/"Received"/"Needs Attention".
                // Soft-refresh so the server-computed counts catch up.
                router.refresh();
            } catch (err) {
                console.warn("POLL_ERROR", err);
            }
        };

        const interval = setInterval(poll, 5000);
        // Poll immediately when the admin returns to the tab, so a backgrounded
        // tab shows fresh orders the instant it regains focus instead of
        // waiting up to 5s for the next tick.
        const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [router]);

    // ── Handlers ──
    const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Order marked as ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label}`);
            } else if (res.status === 409) {
                toast.error(data.message || "This order changed elsewhere — refreshing.");
            } else {
                toast.error(data.message || "Failed to update status");
            }
        } catch {
            toast.error("Network error — try again");
        } finally {
            router.refresh();
        }
    }, [router]);

    const handleRequestCancel = useCallback((id: string) => {
        setCancelTargetId(id);
    }, []);

    const handleConfirmCancel = useCallback(async (id: string, reason: string, note: string) => {
        try {
            const res = await fetch(`/api/admin/orders/${id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason, note }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Order cancelled");
                setCancelTargetId(null);
            } else if (res.status === 409) {
                toast.error(data.message || "This order changed elsewhere — refreshing.");
                setCancelTargetId(null);
            } else {
                toast.error(data.message || "Failed to cancel order");
            }
        } catch {
            toast.error("Network error — try again");
        } finally {
            router.refresh();
        }
    }, [router]);

    // ── Quick-filter tab hrefs — preserve every other active filter, only
    //    change status/attention, always reset to page 1. ──
    const tabHref = (patch: { status?: string; attention?: string }): string => {
        const params = new URLSearchParams();
        const next = { ...filtersValue, status: undefined, attention: undefined, ...patch };
        for (const [k, v] of Object.entries(next)) {
            if (v) params.set(k, v);
        }
        params.set("page", "1");
        return `${pathname}?${params.toString()}`;
    };

    const activeTab = filtersValue.attention === "1" ? "needs_attention" : (filtersValue.status ?? "all");

    return (
        <div className="space-y-4">
            {/* ══ Needs Attention banner ══ */}
            {attentionCount > 0 && activeTab !== "needs_attention" && (
                <Link
                    href={tabHref({ attention: "1" })}
                    className="flex w-full items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left transition-all hover:bg-amber-500/15"
                >
                    <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                    <span className="text-[12px] font-bold text-amber-300">
                        {attentionCount} order{attentionCount !== 1 ? "s" : ""} may need attention — sitting longer than usual, or awaiting manual refund
                    </span>
                </Link>
            )}

            {/* Quick-filter tabs */}
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
                <Link
                    href={tabHref({})}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-all ${activeTab === "all"
                        ? "border border-orange-500/35 bg-orange-500/15 text-orange-300"
                        : "border border-white/[0.07] bg-white/[0.03] text-stone-300 hover:border-white/[0.14] hover:text-stone-100"
                        }`}
                >
                    All Orders
                </Link>
                {attentionCount > 0 && (
                    <Link
                        href={tabHref({ attention: "1" })}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-all ${activeTab === "needs_attention"
                            ? "border border-amber-500/45 bg-amber-500/20 text-amber-300"
                            : "border border-white/[0.07] bg-white/[0.03] text-stone-300 hover:border-white/[0.14] hover:text-stone-100"
                            }`}
                    >
                        <AlertTriangle size={11} /> Needs Attention
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeTab === "needs_attention" ? "bg-amber-500/25 text-amber-100" : "bg-white/[0.08] text-stone-300"}`}>
                            {attentionCount}
                        </span>
                    </Link>
                )}
                {FILTER_STATUSES.map((s) => {
                    const count = statusCountMap[s] ?? 0;
                    return (
                        <Link
                            key={s}
                            href={tabHref({ status: s })}
                            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-all ${activeTab === s
                                ? "border border-orange-500/35 bg-orange-500/15 text-orange-300"
                                : "border border-white/[0.07] bg-white/[0.03] text-stone-300 hover:border-white/[0.14] hover:text-stone-100"
                                }`}
                        >
                            {STATUS_CONFIG[s]?.label ?? s}
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeTab === s ? "bg-orange-500/20 text-orange-100" : "bg-white/[0.08] text-stone-300"}`}>
                                {count}
                            </span>
                        </Link>
                    );
                })}
            </div>

            {/* ══ Order list ══ */}
            {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#0f0f16] py-16 text-center">
                    <Package size={22} className="mb-3 text-stone-600" strokeWidth={1.5} />
                    <p className="text-sm font-bold text-stone-300">No orders found</p>
                    <p className="mt-1 text-xs text-stone-500">Try a different filter, or clear your search.</p>
                </div>
            ) : (
                <>
                    {/* Desktop: dense table */}
                    <div className="hidden overflow-x-auto rounded-2xl border border-white/[0.06] md:block">
                        <table className="w-full min-w-[820px] text-sm">
                            <thead>
                                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                    {["Customer", "Order ID", "Items", "Total", "Payment", "Status", "Time", "Actions"].map((h) => (
                                        <th key={h} className="px-4 py-2.5 text-left text-[9.5px] font-black uppercase tracking-[0.18em] text-stone-500 whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {orders.map((order) => (
                                    <OrderDesktopRow
                                        key={order._id}
                                        order={order}
                                        isNew={newIds.has(order._id)}
                                        onStatusChange={handleStatusChange}
                                        onRequestCancel={handleRequestCancel}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile: compact single-level cards */}
                    <div className="space-y-2.5 md:hidden">
                        {orders.map((order) => (
                            <OrderMobileCard
                                key={order._id}
                                order={order}
                                isNew={newIds.has(order._id)}
                                onStatusChange={handleStatusChange}
                                onRequestCancel={handleRequestCancel}
                            />
                        ))}
                    </div>
                </>
            )}

            {cancelTargetId && (
                <CancelOrderModal
                    orderId={cancelTargetId}
                    onClose={() => setCancelTargetId(null)}
                    onConfirm={handleConfirmCancel}
                />
            )}
        </div>
    );
}
