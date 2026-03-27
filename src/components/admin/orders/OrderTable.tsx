"use client";

// src/components/admin/orders/OrderTable.tsx
// Live order dashboard — FoodKnock
//   • 5-second polling via fetch("/api/orders?limit=20")
//   • Toast notification + sound on new order
//   • Newly-arrived rows highlighted with pulsing amber ring
//   • Status update via PATCH /api/orders/:id

import { useEffect, useRef, useState } from "react";
import { toast }                        from "react-hot-toast";
import {
    Bell, Package, ShoppingBag,
    MapPin, StickyNote, CheckCircle2,
} from "lucide-react";
import {
    STATUS_CONFIG, STATUS_FLOW, nextStatus,
    OrderStatusBadge,
} from "./OrderStatusBadge";

// ─── Types ────────────────────────────────────────────────────────────────
export type OrderItem = {
    productId: string;
    name:      string;
    quantity:  number;
    price:     number;
    image:     string;
};

export type OrderRow = {
    _id:           string;
    orderId:       string;
    customerName:  string;
    phone:         string;
    address:       string;
    landmark:      string;
    orderType:     string;
    items:         OrderItem[];
    totalAmount:   number;
    status:        string;
    note:          string;
    whatsappSent:  boolean;
    createdAt:     string;
    paymentMethod?: string;
};

type Props = { orders: OrderRow[] };

// ─── OrderRowCard ─────────────────────────────────────────────────────────
function OrderRowCard({
    order,
    isNew,
    onStatusChange,
}: {
    order:          OrderRow;
    isNew:          boolean;
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
            className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
                isNew
                    ? "border-amber-400/50 bg-amber-500/[0.04] shadow-lg shadow-amber-500/10 ring-2 ring-amber-400/30"
                    : "border-white/[0.06] bg-[#0f0f16]"
            }`}
        >
            {/* Ambient glow for new orders */}
            {isNew && (
                <div
                    className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl"
                    style={{ background: "radial-gradient(ellipse, #f97316, transparent 70%)" }}
                    aria-hidden="true"
                />
            )}

            {/* New badge */}
            {isNew && (
                <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/20 px-2.5 py-1 shadow-sm">
                    <Bell size={9} className="text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">New</span>
                </div>
            )}

            <div className="p-4">
                {/* ── Header ── */}
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

                {/* ── Customer info ── */}
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

                {/* ── Items ── */}
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

                {/* ── Note ── */}
                {order.note && (
                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] px-3 py-2">
                        <StickyNote size={11} className="mt-0.5 shrink-0 text-amber-500/70" />
                        <p className="text-[11px] leading-relaxed text-amber-300/70">{order.note}</p>
                    </div>
                )}

                {/* ── Footer ── */}
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

// ─── Main component ───────────────────────────────────────────────────────
export default function OrderTable({ orders: initialOrders }: Props) {
    const [orders,       setOrders]       = useState<OrderRow[]>(initialOrders);
    const [filterStatus, setFilterStatus] = useState("all");
    const [newIds,       setNewIds]       = useState<Set<string>>(new Set());

    const lastSeenIdRef     = useRef<string | null>(initialOrders[0]?._id ?? null);
    const userInteractedRef = useRef(false);

    // ── Autoplay gate ──
    useEffect(() => {
        const unlock = () => { userInteractedRef.current = true; };
        window.addEventListener("click",   unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
        return () => {
            window.removeEventListener("click",   unlock);
            window.removeEventListener("keydown", unlock);
        };
    }, []);

    // ── 5-second polling ──
    useEffect(() => {
        const poll = async () => {
            try {
                const res  = await fetch("/api/orders?limit=20", { cache: "no-store" });
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
                    const fresh   = brandNew.filter((o) => !prevIds.has(o._id));
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

                // Toast per new order
                brandNew.forEach((o) => {
                    toast.custom(
                        (t) => (
                            <div className={`flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-[#13131c] px-4 py-3 shadow-2xl shadow-black/50 transition-all ${t.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                                    <Bell size={16} className="text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-black text-white">New Order 🔥</p>
                                    <p className="text-[11px] text-stone-500">{o.customerName} · ₹{o.totalAmount}</p>
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
    }, [orders]);

    // ── Status update ──
    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            const res  = await fetch(`/api/orders/${id}`, {
                method:  "PATCH",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                setOrders((prev) =>
                    prev.map((o) => (o._id === id ? { ...o, status: newStatus } : o))
                );
                toast.success(`Order marked as ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label}`, {
                    style: {
                        background: "#0f0f16", color: "#e7e5e4",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "14px", fontSize: "13px", fontWeight: "700",
                    },
                });
            } else {
                toast.error(data.message || "Failed to update status");
            }
        } catch {
            toast.error("Network error — try again");
        }
    };

    const filtered = filterStatus === "all"
        ? orders
        : orders.filter((o) => o.status === filterStatus);

    return (
        <div>
            {/* ── Filter tabs ── */}
            <div className="mb-5 flex flex-wrap gap-2">
                {["all", ...STATUS_FLOW].map((s) => {
                    const count = s !== "all" ? orders.filter((o) => o.status === s).length : null;
                    return (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-black transition-all duration-200 ${
                                filterStatus === s
                                    ? "border border-orange-500/30 bg-orange-500/15 text-orange-400"
                                    : "border border-white/[0.06] bg-white/[0.03] text-stone-500 hover:border-white/10 hover:text-stone-300"
                            }`}
                        >
                            {s === "all" ? "All Orders" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s}
                            {count !== null && (
                                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                                    filterStatus === s ? "bg-orange-500/20 text-orange-300" : "bg-white/[0.05] text-stone-600"
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Orders grid ── */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#0f0f16] py-20 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                        <Package size={24} className="text-stone-600" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-black text-stone-500">No orders found</p>
                    <p className="mt-1 text-xs text-stone-700">
                        {filterStatus !== "all" ? "Try switching to a different filter." : "New orders will appear here automatically."}
                    </p>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((order) => (
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
    );
}