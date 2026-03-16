"use client";

export const dynamic = "force-dynamic";

// src/app/(main)/track-order/[orderId]/page.tsx
// Auto-loads order by orderId from URL — FoodKnock

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
    Package, ArrowLeft, ArrowRight, Loader2,
    Truck, Store, MapPin, Search,
} from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import OrderTimeline from "@/components/orders/OrderTimeline";

type TrackedOrder = {
    _id: string; orderId: string; customerName: string; phone: string;
    address: string; landmark?: string; orderType: string;
    items: { name: string; quantity: number; price: number; image?: string }[];
    totalAmount: number; status: string; note?: string; createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
    received:         { label: "Order Received",  bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500"    },
    preparing:        { label: "Preparing",        bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500"   },
    out_for_delivery: { label: "Out for Delivery", bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-500"  },
    delivered:        { label: "Delivered 🎉",     bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
};

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, bg: "bg-stone-50", text: "text-stone-600", border: "border-stone-200", dot: "bg-stone-400" };
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${status === "out_for_delivery" ? "animate-pulse" : ""}`} />
            {cfg.label}
        </span>
    );
}

export default function TrackOrderByIdPage({ params }: { params: Promise<{ orderId: string }> }) {
    const { orderId }         = use(params);
    const [order, setOrder]   = useState<TrackedOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState("");

    useEffect(() => {
        async function load() {
            if (!orderId) { setError("No order ID provided."); setLoading(false); return; }
            try {
                const res  = await fetch(`/api/orders/track/${encodeURIComponent(orderId)}`);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    setError("No order found with that ID. Please check and try again.");
                    return;
                }
                setOrder(data.order);
            } catch {
                setError("Something went wrong. Please try again.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [orderId]);

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FFFBF5]">

                {/* ── Header ── */}
                <section className="relative overflow-hidden border-b border-amber-100 bg-gradient-to-br from-amber-50/80 via-[#FFFBF5] to-orange-50/60">
                    <div
                        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }}
                    />
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.025]"
                        style={{ backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)", backgroundSize: "24px 24px" }}
                    />
                    <div className="relative mx-auto max-w-2xl px-4 pb-8 pt-8 md:px-8">
                        <Link
                            href="/track-order"
                            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-stone-500 transition-colors hover:text-orange-600"
                        >
                            <ArrowLeft size={15} /> Track another order
                        </Link>

                        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5">
                            <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-600">Live Tracking</span>
                        </div>
                        <h1 className="text-2xl font-black text-stone-900 md:text-3xl">Live Order Status</h1>
                        <p className="mt-1 font-mono text-sm text-stone-400">#{orderId}</p>
                    </div>
                </section>

                {/* ── Content ── */}
                <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">

                    {loading && (
                        <div className="flex flex-col items-center py-24">
                            <Loader2 size={36} className="animate-spin text-amber-400" strokeWidth={1.5} />
                            <p className="mt-4 text-sm text-stone-400">Fetching your order status…</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex flex-col items-center rounded-3xl border border-amber-100 bg-white px-6 py-16 text-center shadow-sm">
                            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100">
                                <Search size={26} className="text-stone-400" strokeWidth={1.5} />
                            </div>
                            <h2 className="text-lg font-black text-stone-900">Order Not Found</h2>
                            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">{error}</p>
                            <Link
                                href="/track-order"
                                className="mt-6 flex items-center gap-2 rounded-full border border-amber-200 bg-white px-5 py-2.5 text-sm font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-50"
                            >
                                <ArrowLeft size={13} /> Try Manually
                            </Link>
                        </div>
                    )}

                    {!loading && !error && order && (
                        <div className="space-y-4">
                            <div className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm">
                                <div className="flex items-start justify-between gap-3 border-b border-amber-50 p-5">
                                    <div className="space-y-1.5">
                                        <p className="text-lg font-black text-stone-900">{order.customerName}</p>
                                        {order.orderType === "delivery" ? (
                                            <p className="flex items-start gap-1.5 text-sm text-stone-500">
                                                <MapPin size={12} className="mt-0.5 shrink-0 text-amber-500" />
                                                {order.address}{order.landmark ? `, ${order.landmark}` : ""}
                                            </p>
                                        ) : (
                                            <p className="flex items-center gap-1.5 text-sm text-stone-500">
                                                <Store size={12} className="text-amber-500" /> Pickup order
                                            </p>
                                        )}
                                        <p className="font-mono text-[11px] text-stone-400">#{order.orderId}</p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-2">
                                        <StatusBadge status={order.status} />
                                        <span className="text-2xl font-black text-orange-600">
                                            ₹{order.totalAmount.toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                </div>

                                <div className="divide-y divide-amber-50/80 px-5 pb-2 pt-1">
                                    {order.items.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                                            <span className="font-medium text-stone-700">
                                                {item.name}
                                                <span className="ml-2 text-xs font-normal text-stone-400">× {item.quantity}</span>
                                            </span>
                                            <span className="font-semibold text-stone-800">
                                                ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {order.note && (
                                    <div className="border-t border-amber-50 bg-amber-50/30 px-5 py-3">
                                        <p className="text-xs text-stone-500">📝 {order.note}</p>
                                    </div>
                                )}
                            </div>

                            <div className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm">
                                <div className="border-b border-amber-50 bg-amber-50/50 px-5 py-3.5">
                                    <h2 className="text-xs font-black uppercase tracking-wider text-stone-500">Live Timeline</h2>
                                </div>
                                <div className="p-6">
                                    <OrderTimeline
                                        status={order.status}
                                        orderType={order.orderType}
                                        createdAt={order.createdAt}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Link
                                    href="/track-order"
                                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white py-3 text-sm font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-50"
                                >
                                    <Search size={14} /> Track Another
                                </Link>
                                <Link
                                    href="/menu"
                                    className="group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-black text-white shadow-md shadow-orange-200 transition-all hover:brightness-110 active:scale-95"
                                >
                                    Order Again
                                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}
