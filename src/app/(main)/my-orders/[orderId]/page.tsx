"use client";

export const dynamic = "force-dynamic";

// src/app/(main)/my-orders/[orderId]/page.tsx
// Premium order detail view — FoodKnock

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Package, ArrowLeft, MapPin, Store, Phone, Clock,
    ChefHat, Truck, PartyPopper, FileText, ArrowRight,
    Loader2, UtensilsCrossed, Calendar, Hash,
} from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import OrderTimeline from "@/components/orders/OrderTimeline";

type OrderItem = { name: string; quantity: number; price: number; image?: string };
type Order = {
    _id: string; orderId: string; customerName: string; phone: string;
    address: string; landmark?: string; orderType: "delivery" | "pickup";
    items: OrderItem[]; totalAmount: number; status: string;
    note?: string; createdAt: string;
};

const STATUS_CONFIG: Record<string, {
    label: string; icon: React.ElementType;
    bg: string; text: string; border: string; dot: string;
}> = {
    received:         { label: "Order Received",   icon: Clock,        bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500"    },
    preparing:        { label: "Preparing",         icon: ChefHat,      bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500"   },
    out_for_delivery: { label: "Out for Delivery",  icon: Truck,        bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-500"  },
    delivered:        { label: "Delivered 🎉",      icon: PartyPopper,  bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
};

function StatusBadge({ status }: { status: string }) {
    const cfg  = STATUS_CONFIG[status] ?? { label: status, icon: Package, bg: "bg-stone-50", text: "text-stone-600", border: "border-stone-200", dot: "bg-stone-400" };
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <span className={`h-2 w-2 rounded-full ${cfg.dot} ${status === "out_for_delivery" ? "animate-pulse" : ""}`} />
            <Icon size={13} strokeWidth={2.5} />
            {cfg.label}
        </span>
    );
}

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
    const { orderId } = use(params);
    const router = useRouter();
    const [order, setOrder]   = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState("");

    useEffect(() => {
        async function load() {
            const meRes = await fetch("/api/auth/me", { credentials: "include" });
            if (!meRes.ok) { router.replace(`/auth?redirect=/my-orders/${orderId}`); return; }
            try {
                const res  = await fetch(`/api/orders/track/${encodeURIComponent(orderId)}`);
                const data = await res.json();
                if (!res.ok || !data.success) { setError("Order not found. Please check the order ID."); return; }
                setOrder(data.order);
            } catch {
                setError("Failed to load order details.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [orderId, router]);

    if (loading) {
        return (
            <>
                <Navbar />
                <main className="flex min-h-screen items-center justify-center bg-[#FFFBF5]">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 size={36} className="animate-spin text-amber-400" strokeWidth={1.5} />
                        <p className="text-sm text-stone-400">Loading order details…</p>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    if (error || !order) {
        return (
            <>
                <Navbar />
                <main className="flex min-h-screen items-center justify-center bg-[#FFFBF5] px-4">
                    <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-red-100 bg-white px-8 py-16 text-center shadow-sm">
                        <Package size={40} className="mb-4 text-stone-300" strokeWidth={1.5} />
                        <h2 className="text-lg font-black text-stone-900">Order Not Found</h2>
                        <p className="mt-2 text-sm text-stone-500">{error || "This order doesn't exist or may have been removed."}</p>
                        <Link
                            href="/my-orders"
                            className="mt-6 flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-2.5 text-sm font-black text-white shadow-md"
                        >
                            <ArrowLeft size={14} /> Back to My Orders
                        </Link>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);

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
                        className="pointer-events-none absolute inset-0 opacity-[0.022]"
                        style={{ backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)", backgroundSize: "28px 28px" }}
                    />
                    <div className="relative mx-auto max-w-4xl px-4 pb-8 pt-8 md:px-8">
                        <Link
                            href="/my-orders"
                            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-stone-500 transition-colors hover:text-orange-600"
                        >
                            <ArrowLeft size={15} /> Back to My Orders
                        </Link>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-500">Order Details</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-xl font-black text-stone-900 md:text-2xl">{order.customerName}</h1>
                                    <StatusBadge status={order.status} />
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-400">
                                    <span className="flex items-center gap-1">
                                        <Hash size={11} />
                                        <span className="font-mono">{order.orderId}</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar size={11} />
                                        {new Date(order.createdAt).toLocaleString("en-IN", {
                                            day: "2-digit", month: "short", year: "numeric",
                                            hour: "2-digit", minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                            </div>

                            <Link
                                href={`/track-order/${encodeURIComponent(order.orderId)}`}
                                className="group flex shrink-0 items-center gap-2 self-start rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition-all hover:brightness-110 active:scale-95"
                            >
                                <Truck size={15} strokeWidth={2.5} />
                                Track Order
                                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── Content ── */}
                <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
                    <div className="grid gap-5 lg:grid-cols-5">

                        {/* Left col */}
                        <div className="space-y-5 lg:col-span-3">

                            {/* Customer info */}
                            <div className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm">
                                <div className="border-b border-amber-50 bg-amber-50/50 px-5 py-3.5">
                                    <h2 className="text-xs font-black uppercase tracking-wider text-stone-500">Customer Info</h2>
                                </div>
                                <div className="space-y-3.5 p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                                            <Phone size={14} className="text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Phone</p>
                                            <p className="text-sm font-semibold text-stone-800">{order.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                                            {order.orderType === "delivery"
                                                ? <MapPin size={14} className="text-amber-600" />
                                                : <Store size={14} className="text-amber-600" />}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                                                {order.orderType === "delivery" ? "Delivery Address" : "Pickup Order"}
                                            </p>
                                            {order.orderType === "delivery" ? (
                                                <p className="text-sm font-semibold text-stone-800">
                                                    {order.address}{order.landmark ? `, ${order.landmark}` : ""}
                                                </p>
                                            ) : (
                                                <p className="text-sm font-semibold text-stone-800">Collect from FoodKnock kitchen</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                                            <Truck size={14} className="text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Order Type</p>
                                            <p className="text-sm font-semibold capitalize text-stone-800">{order.orderType}</p>
                                        </div>
                                    </div>
                                    {order.note && (
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                                                <FileText size={14} className="text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Note</p>
                                                <p className="text-sm text-stone-700">{order.note}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Items ordered */}
                            <div className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm">
                                <div className="border-b border-amber-50 bg-amber-50/50 px-5 py-3.5">
                                    <h2 className="text-xs font-black uppercase tracking-wider text-stone-500">
                                        Items Ordered · {order.items.reduce((s, i) => s + i.quantity, 0)} items
                                    </h2>
                                </div>
                                <div className="divide-y divide-amber-50">
                                    {order.items.map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 px-5 py-4">
                                            {item.image ? (
                                                <img
                                                    src={item.image}
                                                    alt={item.name}
                                                    className="h-12 w-12 shrink-0 rounded-2xl border border-amber-100 object-cover"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                />
                                            ) : (
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100">
                                                    <UtensilsCrossed size={18} className="text-amber-500" strokeWidth={1.8} />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="line-clamp-1 text-sm font-bold text-stone-900">{item.name}</p>
                                                <p className="text-xs text-stone-400">₹{item.price.toLocaleString("en-IN")} × {item.quantity}</p>
                                            </div>
                                            <p className="text-sm font-black text-stone-900">
                                                ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-2 border-t border-amber-100 bg-amber-50/40 px-5 py-4">
                                    <div className="flex items-center justify-between text-sm text-stone-500">
                                        <span>Subtotal</span>
                                        <span>₹{subtotal.toLocaleString("en-IN")}</span>
                                    </div>
                                    <div className="flex items-center justify-between font-black text-stone-900">
                                        <span>Total Paid</span>
                                        <span className="text-xl text-orange-600">₹{order.totalAmount.toLocaleString("en-IN")}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right col */}
                        <div className="space-y-5 lg:col-span-2">

                            {/* Timeline */}
                            <div className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm">
                                <div className="border-b border-amber-50 bg-amber-50/50 px-5 py-3.5">
                                    <h2 className="text-xs font-black uppercase tracking-wider text-stone-500">Order Timeline</h2>
                                </div>
                                <div className="p-5">
                                    <OrderTimeline
                                        status={order.status}
                                        orderType={order.orderType}
                                        createdAt={order.createdAt}
                                    />
                                </div>
                            </div>

                            {/* Track CTA card */}
                            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 p-6 shadow-lg shadow-orange-200">
                                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
                                <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5" />
                                <Truck size={28} className="mb-3 text-white/80" strokeWidth={1.5} />
                                <h3 className="text-base font-black text-white">Live Order Tracking</h3>
                                <p className="mt-1 text-sm text-white/80">
                                    See real-time delivery updates and live status for this order.
                                </p>
                                <Link
                                    href={`/track-order/${encodeURIComponent(order.orderId)}`}
                                    className="group mt-4 flex items-center justify-between rounded-2xl bg-white px-5 py-3 text-sm font-black text-orange-600 shadow-md transition-all hover:bg-orange-50 active:scale-95"
                                >
                                    Track Live Status
                                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                                </Link>
                            </div>

                            {/* Reorder CTA */}
                            <Link
                                href="/menu"
                                className="group flex items-center justify-between rounded-3xl border border-amber-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-orange-300 hover:bg-amber-50/50"
                            >
                                <span className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100">
                                        <UtensilsCrossed size={18} className="text-amber-600" strokeWidth={2} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-stone-900">Order Again</p>
                                        <p className="text-xs text-stone-400">Browse our fresh menu</p>
                                    </div>
                                </span>
                                <ArrowRight size={16} className="text-stone-300 transition-all group-hover:translate-x-1 group-hover:text-orange-500" />
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}