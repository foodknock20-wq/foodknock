"use client";

export const dynamic = "force-dynamic";

// src/app/(main)/track-order/page.tsx
// Premium manual order tracking — FoodKnock

import { useState } from "react";
import {
    Search, Loader2, Package, ArrowRight,
    Truck, Store, Phone, MapPin, ArrowLeft,
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";
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

export default function TrackOrderPage() {
    const [input, setInput]       = useState("");
    const [loading, setLoading]   = useState(false);
    const [order, setOrder]       = useState<TrackedOrder | null>(null);
    const [notFound, setNotFound] = useState(false);

    const handleTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = input.replace(/^#/, "").trim();
        if (!trimmed) { toast.error("Please enter your Order ID"); return; }
        setLoading(true);
        setOrder(null);
        setNotFound(false);
        try {
            const res  = await fetch(`/api/orders/track/${encodeURIComponent(trimmed)}`);
            const data = await res.json();
            if (!res.ok || !data.success) { setNotFound(true); return; }
            setOrder(data.order);
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FFFBF5]">

                {/* ── Hero / search ── */}
                <section className="relative overflow-hidden border-b border-amber-100">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 via-[#FFFBF5] to-orange-50/60" />
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.025]"
                        style={{ backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)", backgroundSize: "24px 24px" }}
                    />
                    <div
                        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }}
                    />
                    <div
                        className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full opacity-15 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #fbbf24, transparent 70%)" }}
                    />

                    <div className="relative mx-auto max-w-xl px-4 pb-14 pt-12 text-center md:px-6">
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5">
                            <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">
                                Live Tracking
                            </span>
                        </div>

                        <h1 className="text-3xl font-black text-stone-900 md:text-4xl">
                            Where's My Order?
                        </h1>
                        <p className="mt-3 text-sm leading-relaxed text-stone-500">
                            Enter your Order ID below to see live status and delivery updates.
                        </p>

                        <form onSubmit={handleTrack} className="mt-8 flex gap-3">
                            <div className="relative flex-1">
                                <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="e.g. ORD-1772799228658-8047"
                                    className="w-full rounded-2xl border border-amber-200 bg-white py-3.5 pl-11 pr-4 text-sm text-stone-800 shadow-sm placeholder:text-stone-400 transition-all focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-black text-white shadow-md shadow-orange-200 transition-all hover:brightness-110 disabled:opacity-60 active:scale-95"
                            >
                                {loading
                                    ? <Loader2 size={15} className="animate-spin" />
                                    : <ArrowRight size={15} strokeWidth={2.5} />}
                            </button>
                        </form>

                        <p className="mt-4 text-xs text-stone-400">
                            Signed in?{" "}
                            <Link href="/my-orders" className="font-bold text-orange-500 transition-colors hover:text-orange-600">
                                View all your orders →
                            </Link>
                        </p>
                    </div>
                </section>

                {/* ── Results ── */}
                <div className="mx-auto max-w-xl px-4 py-10 md:px-6">

                    {/* Not found */}
                    {notFound && (
                        <div className="flex flex-col items-center rounded-3xl border border-amber-100 bg-white px-6 py-14 text-center shadow-sm">
                            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100">
                                <Search size={26} className="text-stone-400" strokeWidth={1.5} />
                            </div>
                            <h2 className="text-xl font-black text-stone-900">Order Not Found</h2>
                            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
                                We couldn't find an order with ID{" "}
                                <span className="font-mono font-semibold text-stone-700">"{input}"</span>.
                                Check the ID from your confirmation message.
                            </p>
                            <button
                                onClick={() => { setNotFound(false); setInput(""); }}
                                className="mt-6 rounded-full border border-amber-200 bg-white px-5 py-2.5 text-sm font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-50"
                            >
                                Try a Different ID
                            </button>
                        </div>
                    )}

                    {/* Order result */}
                    {order && (
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

                                <div className="divide-y divide-amber-50 px-5 pb-2 pt-1">
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
                                    <h2 className="text-xs font-black uppercase tracking-wider text-stone-500">Live Order Timeline</h2>
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
                                <button
                                    onClick={() => { setOrder(null); setInput(""); }}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white py-3 text-sm font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-50"
                                >
                                    <Search size={14} /> Track Another
                                </button>
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