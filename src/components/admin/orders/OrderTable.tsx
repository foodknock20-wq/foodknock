"use client";

// src/components/admin/orders/OrderTable.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Premium Sales Analytics + Order Intelligence Dashboard — FoodKnock
//
//  Analytics features
//  ──────────────────
//  • Date-range filter (7d / 30d / This Month / Last Month / This Year / Custom)
//  • 10 KPI cards: total orders, delivered, pending/active, cancelled,
//    total revenue, COD revenue, online revenue, AOV, highest order, best day
//
//  Order management features (preserved)
//  ──────────────────────────────────────
//  • 5-second live polling via GET /api/orders?limit=200
//  • Toast + audio notification on new order arrival
//  • Pulsing amber ring on newly-arrived cards
//  • Status-advancement buttons (PATCH /api/orders/:id)
//  • Status filter tabs (layered on top of date-range filter)
//
//  Performance
//  ───────────
//  • useMemo for all derived analytics / filtered lists
//  • useCallback for event handlers passed to children
//  • Polling only updates React state when new IDs are detected
// ─────────────────────────────────────────────────────────────────────────────

import {
    useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { toast } from "react-hot-toast";
import {
    Bell, Package, ShoppingBag, MapPin, StickyNote,
    CheckCircle2, TrendingUp, Wallet, CreditCard,
    BarChart2, Calendar, ChevronDown, Star, Award,
    ArrowUpRight, DollarSign, Activity, Filter,
} from "lucide-react";
import {
    STATUS_CONFIG, STATUS_FLOW, nextStatus, OrderStatusBadge,
} from "./OrderStatusBadge";

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
};

type DateRangeKey =
    | "7d"
    | "30d"
    | "thisMonth"
    | "lastMonth"
    | "thisYear"
    | "custom";

type Props = { orders: OrderRow[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function getRangeFromKey(key: DateRangeKey): { from: Date; to: Date } {
    const now = new Date();
    const today = startOfDay(now);

    switch (key) {
        case "7d":
            return { from: new Date(today.getTime() - 6 * 86_400_000), to: endOfDay(now) };
        case "30d":
            return { from: new Date(today.getTime() - 29 * 86_400_000), to: endOfDay(now) };
        case "thisMonth":
            return {
                from: new Date(now.getFullYear(), now.getMonth(), 1),
                to: endOfDay(now),
            };
        case "lastMonth": {
            const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            return {
                from: new Date(y, m, 1),
                to: endOfDay(new Date(y, m + 1, 0)),
            };
        }
        case "thisYear":
            return {
                from: new Date(now.getFullYear(), 0, 1),
                to: endOfDay(now),
            };
        default:
            return { from: today, to: endOfDay(now) };
    }
}

function formatINR(amount: number): string {
    return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
    label, value, sub, accent = "amber", icon: Icon,
}: {
    label: string;
    value: string | number;
    sub?: string;
    accent?: "amber" | "emerald" | "sky" | "rose" | "violet" | "orange";
    icon: React.ElementType;
}) {
    const colors: Record<string, string> = {
        amber: "text-amber-400   border-amber-500/20  bg-amber-500/6",
        emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/6",
        sky: "text-sky-400     border-sky-500/20    bg-sky-500/6",
        rose: "text-rose-400    border-rose-500/20   bg-rose-500/6",
        violet: "text-violet-400  border-violet-500/20 bg-violet-500/6",
        orange: "text-orange-400  border-orange-500/20 bg-orange-500/6",
    };
    const [iconCls, borderCls, bgCls] = colors[accent].split(/\s+/);

    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0f0f16] p-4">
            {/* Subtle accent glow */}
            <div
                className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-10 blur-2xl"
                style={{ background: `var(--tw-gradient-from, currentColor)` }}
                aria-hidden
            />
            <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">{label}</p>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${borderCls} ${bgCls}`}>
                    <Icon size={12} className={iconCls} />
                </div>
            </div>
            <p className={`font-mono text-2xl font-black ${iconCls}`}>{value}</p>
            {sub && <p className="mt-1 text-[10px] text-stone-600">{sub}</p>}
        </div>
    );
}

// ─── Date Range Filter Bar ────────────────────────────────────────────────────

const RANGE_LABELS: Record<DateRangeKey, string> = {
    "7d": "Past 7 Days",
    "30d": "Past 30 Days",
    "thisMonth": "This Month",
    "lastMonth": "Last Month",
    "thisYear": "This Year",
    "custom": "Custom Range",
};

function DateRangeBar({
    active,
    customFrom,
    customTo,
    onSelect,
    onCustomChange,
}: {
    active: DateRangeKey;
    customFrom: string;
    customTo: string;
    onSelect: (k: DateRangeKey) => void;
    onCustomChange: (from: string, to: string) => void;
}) {
    return (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4">
            <div className="mb-3 flex items-center gap-2">
                <Filter size={11} className="text-stone-600" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">
                    Date Range
                </span>
            </div>

            {/* Range pills */}
            <div className="flex flex-wrap gap-2">
                {(Object.keys(RANGE_LABELS) as DateRangeKey[]).map((k) => (
                    <button
                        key={k}
                        onClick={() => onSelect(k)}
                        className={`rounded-xl px-3.5 py-2 text-[11px] font-black transition-all duration-200 ${active === k
                                ? "border border-amber-500/35 bg-amber-500/15 text-amber-400"
                                : "border border-white/[0.06] bg-white/[0.02] text-stone-500 hover:border-white/10 hover:text-stone-300"
                            }`}
                    >
                        {RANGE_LABELS[k]}
                    </button>
                ))}
            </div>

            {/* Custom date inputs */}
            {active === "custom" && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-stone-600">From</label>
                        <input
                            type="date"
                            value={customFrom}
                            onChange={(e) => onCustomChange(e.target.value, customTo)}
                            className="rounded-xl border border-white/[0.08] bg-[#151520] px-3 py-2 text-[12px] text-stone-300 outline-none focus:border-amber-500/40"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-stone-600">To</label>
                        <input
                            type="date"
                            value={customTo}
                            onChange={(e) => onCustomChange(customFrom, e.target.value)}
                            className="rounded-xl border border-white/[0.08] bg-[#151520] px-3 py-2 text-[12px] text-stone-300 outline-none focus:border-amber-500/40"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderRowCard({
    order,
    isNew,
    onStatusChange,
}: {
    order: OrderRow;
    isNew: boolean;
    onStatusChange: (id: string, status: string) => Promise<void>;
}) {
    const [updating, setUpdating] = useState(false);
    const next = nextStatus(order.status);

    const handleAdvance = async () => {
        if (!next) return;
        setUpdating(true);
        await onStatusChange(order._id, next);
        setUpdating(false);
    };

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${isNew
                    ? "border-amber-400/50 bg-amber-500/[0.04] shadow-lg shadow-amber-500/10 ring-2 ring-amber-400/30"
                    : "border-white/[0.06] bg-[#0f0f16]"
                }`}
        >
            {isNew && (
                <div
                    className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl"
                    style={{ background: "radial-gradient(ellipse, #f97316, transparent 70%)" }}
                    aria-hidden
                />
            )}
            {isNew && (
                <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/20 px-2.5 py-1">
                    <Bell size={9} className="text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">New</span>
                </div>
            )}

            <div className="p-4">
                {/* Header */}
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-black text-white">{order.orderId}</span>
                            {order.orderType === "pickup" && (
                                <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-400">
                                    Pickup
                                </span>
                            )}
                            {order.paymentMethod && (
                                <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-stone-500">
                                    {order.paymentMethod}
                                </span>
                            )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-stone-600">
                            {new Date(order.createdAt).toLocaleString("en-IN", {
                                dateStyle: "medium", timeStyle: "short",
                            })}
                        </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                </div>

                {/* Customer */}
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex items-start gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                        <ShoppingBag size={12} className="mt-0.5 shrink-0 text-stone-600" />
                        <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-white">{order.customerName}</p>
                            <p className="text-[11px] text-stone-500">{order.phone}</p>
                        </div>
                    </div>
                    {order.address && order.address !== "Pickup" && (
                        <div className="flex items-start gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                            <MapPin size={12} className="mt-0.5 shrink-0 text-stone-600" />
                            <p className="text-[11px] leading-relaxed text-stone-500">
                                {order.address}
                                {order.landmark ? ` · Near ${order.landmark}` : ""}
                            </p>
                        </div>
                    )}
                </div>

                {/* Items */}
                <div className="mb-3 space-y-1 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[12px]">
                            <span className="text-stone-500">
                                <span className="mr-1.5 font-black text-stone-300">{item.quantity}×</span>
                                {item.name}
                            </span>
                            <span className="font-bold text-stone-400">₹{item.price * item.quantity}</span>
                        </div>
                    ))}
                </div>

                {/* Note */}
                {order.note && (
                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] px-3 py-2">
                        <StickyNote size={11} className="mt-0.5 shrink-0 text-amber-500/70" />
                        <p className="text-[11px] leading-relaxed text-amber-300/70">{order.note}</p>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-base font-black text-white">
                        ₹{order.totalAmount.toLocaleString("en-IN")}
                    </span>
                    {next ? (
                        <button
                            onClick={handleAdvance}
                            disabled={updating}
                            className="flex items-center gap-1.5 rounded-xl border border-orange-500/25 bg-orange-500/10 px-3.5 py-2 text-[11px] font-black text-orange-400 transition-all duration-200 hover:border-orange-400/40 hover:bg-orange-500/18 disabled:cursor-wait disabled:opacity-50"
                        >
                            {updating ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                            ) : (
                                STATUS_CONFIG[next]?.icon
                            )}
                            Mark as {STATUS_CONFIG[next]?.label}
                        </button>
                    ) : (
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                            <CheckCircle2 size={12} strokeWidth={2.5} /> Complete
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrderTable({ orders: initialOrders }: Props) {
    // ── State ──
    const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [newIds, setNewIds] = useState<Set<string>>(new Set());
    const [dateRange, setDateRange] = useState<DateRangeKey>("7d");
    const [customFrom, setCustomFrom] = useState<string>(() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return d.toISOString().split("T")[0];
    });
    const [customTo, setCustomTo] = useState<string>(() =>
        new Date().toISOString().split("T")[0]
    );

    const lastSeenIdRef = useRef<string | null>(initialOrders[0]?._id ?? null);
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

    // ── 5-second live polling ──
    useEffect(() => {
        const poll = async () => {
            try {
                const res = await fetch("/api/orders?limit=200", { cache: "no-store" });
                const data = await res.json();
                if (!data.success || !Array.isArray(data.orders)) return;

                const latest: OrderRow[] = data.orders;
                if (!latest.length) return;

                const latestId = latest[0]._id;
                if (latestId === lastSeenIdRef.current) return;

                const knownIds = new Set(orders.map((o) => o._id));
                const brandNew = latest.filter((o) => !knownIds.has(o._id));

                if (!brandNew.length) {
                    lastSeenIdRef.current = latestId;
                    return;
                }

                lastSeenIdRef.current = latestId;

                setOrders((prev) => {
                    const prevIds = new Set(prev.map((o) => o._id));
                    const fresh = brandNew.filter((o) => !prevIds.has(o._id));
                    return fresh.length ? [...fresh, ...prev] : prev;
                });

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
                            <div
                                className={`flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-[#13131c] px-4 py-3 shadow-2xl shadow-black/50 transition-all ${t.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                                    }`}
                            >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                                    <Bell size={16} className="text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-black text-white">New Order 🔥</p>
                                    <p className="text-[11px] text-stone-500">
                                        {o.customerName} · ₹{o.totalAmount}
                                    </p>
                                </div>
                            </div>
                        ),
                        { duration: 5000 }
                    );
                });

                if (userInteractedRef.current) {
                    try { await new Audio("/notification.mp3").play(); } catch { /* non-fatal */ }
                }
            } catch (err) {
                console.warn("POLL_ERROR", err);
            }
        };

        const interval = setInterval(poll, 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orders]);

    // ── Handlers (stable references) ──
    const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                setOrders((prev) =>
                    prev.map((o) => (o._id === id ? { ...o, status: newStatus } : o))
                );
                toast.success(
                    `Order marked as ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label}`,
                    {
                        style: {
                            background: "#0f0f16", color: "#e7e5e4",
                            border: "1px solid rgba(255,255,255,0.07)",
                            borderRadius: "14px", fontSize: "13px", fontWeight: "700",
                        },
                    }
                );
            } else {
                toast.error(data.message || "Failed to update status");
            }
        } catch {
            toast.error("Network error — try again");
        }
    }, []);

    const handleCustomChange = useCallback((from: string, to: string) => {
        setCustomFrom(from);
        setCustomTo(to);
    }, []);

    const handleRangeSelect = useCallback((k: DateRangeKey) => {
        setDateRange(k);
    }, []);

    const handleStatusFilter = useCallback((s: string) => {
        setFilterStatus(s);
    }, []);

    // ── Derived: date-range boundaries ──
    const { rangeFrom, rangeTo } = useMemo(() => {
        if (dateRange === "custom") {
            return {
                rangeFrom: customFrom ? new Date(customFrom + "T00:00:00") : new Date(0),
                rangeTo: customTo ? new Date(customTo + "T23:59:59") : new Date(),
            };
        }
        const { from, to } = getRangeFromKey(dateRange);
        return { rangeFrom: from, rangeTo: to };
    }, [dateRange, customFrom, customTo]);

    // ── Derived: orders inside selected date range ──
    const rangeOrders = useMemo(() => {
        return orders.filter((o) => {
            const t = new Date(o.createdAt).getTime();
            return t >= rangeFrom.getTime() && t <= rangeTo.getTime();
        });
    }, [orders, rangeFrom, rangeTo]);

    // ── Derived: analytics KPIs from rangeOrders ──
    const analytics = useMemo(() => {
        const total = rangeOrders.length;
        const delivered = rangeOrders.filter((o) => o.status === "delivered");
        const cancelled = rangeOrders.filter((o) => o.status === "cancelled");
        const active = rangeOrders.filter(
            (o) => o.status !== "delivered" && o.status !== "cancelled"
        );

        const totalRevenue = delivered.reduce((s, o) => s + o.totalAmount, 0);
        const codRevenue = delivered
            .filter((o) => (o.paymentMethod ?? "cod") === "cod")
            .reduce((s, o) => s + o.totalAmount, 0);
        const onlineRevenue = delivered
            .filter((o) => o.paymentMethod && o.paymentMethod !== "cod")
            .reduce((s, o) => s + o.totalAmount, 0);
        const aov = delivered.length ? Math.round(totalRevenue / delivered.length) : 0;
        const highestOrder = rangeOrders.reduce((m, o) => Math.max(m, o.totalAmount), 0);

        // Best sales day by delivered revenue
        const dayMap: Record<string, number> = {};
        delivered.forEach((o) => {
            const day = new Date(o.createdAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "short",
            });
            dayMap[day] = (dayMap[day] ?? 0) + o.totalAmount;
        });
        const bestDay = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];

        return {
            total,
            delivered: delivered.length,
            active: active.length,
            cancelled: cancelled.length,
            totalRevenue,
            codRevenue,
            onlineRevenue,
            aov,
            highestOrder,
            bestDayLabel: bestDay ? bestDay[0] : "—",
            bestDayAmount: bestDay ? bestDay[1] : 0,
        };
    }, [rangeOrders]);

    // ── Derived: status counts inside range ──
    const statusCounts = useMemo(() => {
        return rangeOrders.reduce<Record<string, number>>((acc, o) => {
            acc[o.status] = (acc[o.status] ?? 0) + 1;
            return acc;
        }, {});
    }, [rangeOrders]);

    // ── Derived: filtered orders (date range + status) ──
    const displayOrders = useMemo(() => {
        if (filterStatus === "all") return rangeOrders;
        return rangeOrders.filter((o) => o.status === filterStatus);
    }, [rangeOrders, filterStatus]);

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">

            {/* ══════════════════════════════════════════════════════════════════
                DATE RANGE FILTER
            ══════════════════════════════════════════════════════════════════ */}
            <DateRangeBar
                active={dateRange}
                customFrom={customFrom}
                customTo={customTo}
                onSelect={handleRangeSelect}
                onCustomChange={handleCustomChange}
            />

            {/* ══════════════════════════════════════════════════════════════════
                ANALYTICS KPI GRID
            ══════════════════════════════════════════════════════════════════ */}
            <div>
                <div className="mb-3 flex items-center gap-2">
                    <BarChart2 size={11} className="text-stone-600" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">
                        {dateRange === "custom"
                            ? `${customFrom || "—"} → ${customTo || "—"}`
                            : RANGE_LABELS[dateRange]} · Analytics
                    </span>
                </div>

                {/* Row 1: Order volume */}
                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <KpiCard
                        label="Total Orders"
                        value={analytics.total}
                        icon={ShoppingBag}
                        accent="amber"
                        sub="in selected range"
                    />
                    <KpiCard
                        label="Delivered"
                        value={analytics.delivered}
                        icon={CheckCircle2}
                        accent="emerald"
                        sub={`${analytics.total ? Math.round((analytics.delivered / analytics.total) * 100) : 0}% completion`}
                    />
                    <KpiCard
                        label="Active / Pending"
                        value={analytics.active}
                        icon={Activity}
                        accent="sky"
                        sub="received + preparing"
                    />
                    <KpiCard
                        label="Cancelled"
                        value={analytics.cancelled}
                        icon={Package}
                        accent="rose"
                        sub={analytics.total ? `${Math.round((analytics.cancelled / analytics.total) * 100)}% of total` : "0%"}
                    />
                </div>

                {/* Row 2: Revenue */}
                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="relative col-span-2 overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:col-span-1">
                        <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-emerald-500 opacity-10 blur-3xl" aria-hidden />
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                            Total Revenue
                        </p>
                        <p className="font-mono text-3xl font-black text-emerald-400">
                            {formatINR(analytics.totalRevenue)}
                        </p>
                        <p className="mt-1 text-[10px] text-stone-600">from delivered orders only</p>
                        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                            <TrendingUp size={10} />
                            <span>Revenue Intelligence</span>
                        </div>
                    </div>

                    <KpiCard
                        label="COD Revenue"
                        value={formatINR(analytics.codRevenue)}
                        icon={Wallet}
                        accent="amber"
                        sub="cash on delivery"
                    />
                    <KpiCard
                        label="Online Revenue"
                        value={formatINR(analytics.onlineRevenue)}
                        icon={CreditCard}
                        accent="violet"
                        sub="digital payments"
                    />
                </div>

                {/* Row 3: Intelligence */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <KpiCard
                        label="Avg Order Value"
                        value={analytics.aov > 0 ? formatINR(analytics.aov) : "—"}
                        icon={DollarSign}
                        accent="sky"
                        sub="per delivered order"
                    />
                    <KpiCard
                        label="Highest Order"
                        value={analytics.highestOrder > 0 ? formatINR(analytics.highestOrder) : "—"}
                        icon={Award}
                        accent="orange"
                        sub="single order peak"
                    />
                    <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f16] p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">Best Sales Day</p>
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/6">
                                <Star size={12} className="text-amber-400" />
                            </div>
                        </div>
                        <p className="font-mono text-2xl font-black text-amber-400">
                            {analytics.bestDayLabel}
                        </p>
                        {analytics.bestDayAmount > 0 && (
                            <p className="mt-1 text-[10px] text-stone-600">
                                {formatINR(analytics.bestDayAmount)} revenue
                            </p>
                        )}
                        {analytics.bestDayAmount === 0 && (
                            <p className="mt-1 text-[10px] text-stone-600">no delivered orders yet</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                LIVE ORDER TABLE
            ══════════════════════════════════════════════════════════════════ */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                {/* Section heading */}
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500">
                            Live Orders
                        </span>
                    </div>
                    <span className="text-[10px] text-stone-700">
                        Showing {displayOrders.length} of {rangeOrders.length} in range
                    </span>
                </div>

                {/* Status filter tabs */}
                <div className="mb-5 flex flex-wrap gap-2">
                    {["all", ...STATUS_FLOW].map((s) => {
                        const count = s !== "all" ? (statusCounts[s] ?? 0) : null;
                        return (
                            <button
                                key={s}
                                onClick={() => handleStatusFilter(s)}
                                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-black transition-all duration-200 ${filterStatus === s
                                        ? "border border-orange-500/30 bg-orange-500/15 text-orange-400"
                                        : "border border-white/[0.06] bg-white/[0.03] text-stone-500 hover:border-white/10 hover:text-stone-300"
                                    }`}
                            >
                                {s === "all"
                                    ? "All Orders"
                                    : (STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s)}
                                {count !== null && (
                                    <span
                                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${filterStatus === s
                                                ? "bg-orange-500/20 text-orange-300"
                                                : "bg-white/[0.05] text-stone-600"
                                            }`}
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Orders grid */}
                {displayOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#0f0f16] py-20 text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                            <Package size={24} className="text-stone-600" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-black text-stone-500">No orders found</p>
                        <p className="mt-1 text-xs text-stone-700">
                            {filterStatus !== "all"
                                ? "Try switching to a different status filter."
                                : "No orders in the selected date range."}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {displayOrders.map((order) => (
                            <OrderRowCard
                                key={order._id}
                                order={order}
                                isNew={newIds.has(order._id)}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}