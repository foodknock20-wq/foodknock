
"use client";
export const dynamic = "force-dynamic";

// src/app/(main)/my-orders/page.tsx
// Premium authenticated "My Orders" — FoodKnock

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Package, ArrowRight, Clock, ChefHat, Truck, PartyPopper,
    Store, Loader2, ShoppingBag, ChevronRight, Calendar,
    ReceiptText, UtensilsCrossed, Search, X, ChevronLeft,
    Sparkles, IndianRupee, TrendingUp,
} from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

const ORDERS_PER_PAGE = 6;

type OrderItem = { name: string; quantity: number; price: number; image?: string };
type Order = {
    _id: string; orderId: string; customerName: string; phone: string;
    address: string; landmark?: string; orderType: "delivery" | "pickup";
    items: OrderItem[]; totalAmount: number; status: string;
    note?: string; createdAt: string;
};
type FilterTab = "all" | "active" | "delivered" | "received" | "preparing" | "out_for_delivery";

const STATUS_CONFIG: Record<string, {
    label: string; icon: React.ElementType;
    bg: string; text: string; border: string; dot: string;
    headerBg: string; headerBorder: string;
}> = {
    received: {
        label: "Order Received", icon: Clock,
        bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500",
        headerBg: "bg-blue-50", headerBorder: "border-b border-blue-100",
    },
    preparing: {
        label: "Preparing", icon: ChefHat,
        bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500",
        headerBg: "bg-amber-50", headerBorder: "border-b border-amber-100",
    },
    out_for_delivery: {
        label: "Out for Delivery", icon: Truck,
        bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500",
        headerBg: "bg-orange-50", headerBorder: "border-b border-orange-100",
    },
    delivered: {
        label: "Delivered", icon: PartyPopper,
        bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500",
        headerBg: "bg-emerald-50", headerBorder: "border-b border-emerald-100",
    },
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (s: string) => new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const fmtRs   = (n: number) => "₹" + n.toLocaleString("en-IN");

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_CONFIG[status] ?? { label: status, icon: Package, bg: "bg-stone-50", text: "text-stone-600", border: "border-stone-200", dot: "bg-stone-400" };
    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${c.bg} ${c.text} ${c.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${status === "out_for_delivery" || status === "preparing" ? "animate-pulse" : ""}`} />
            <Icon size={11} strokeWidth={2.5} />
            {c.label}
        </span>
    );
}

function SkeletonCard() {
    return (
        <div className="flex flex-col overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm animate-pulse">
            <div className="h-12 bg-gradient-to-r from-stone-100 to-amber-50/40" />
            <div className="flex flex-col gap-3 p-5">
                <div className="flex gap-2">
                    <div className="h-3.5 w-28 rounded-full bg-stone-100" />
                    <div className="h-3.5 w-14 rounded-full bg-stone-100" />
                </div>
                <div className="h-4 w-full rounded-full bg-stone-100" />
                <div className="h-4 w-3/4 rounded-full bg-stone-100" />
                <div className="mt-2 flex items-center justify-between border-t border-stone-50 pt-3">
                    <div className="h-5 w-16 rounded-full bg-stone-100" />
                    <div className="h-8 w-28 rounded-full bg-orange-100/70" />
                </div>
            </div>
        </div>
    );
}

function OrderCard({ order, index }: { order: Order; index: number }) {
    const itemCount    = order.items.reduce((s, i) => s + i.quantity, 0);
    const previewItems = order.items.slice(0, 2);
    const remaining    = order.items.length - 2;
    const cfg          = STATUS_CONFIG[order.status];

    return (
        <Link
            href={`/my-orders/${order.orderId}`}
            className="group flex flex-col overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm transition-all duration-300 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-100/60 hover:-translate-y-1"
            style={{ animationDelay: `${index * 60}ms` }}
        >
            <div className={`flex items-center justify-between px-5 py-3 ${cfg?.headerBg ?? "bg-stone-50"} ${cfg?.headerBorder ?? "border-b border-stone-100"}`}>
                <StatusBadge status={order.status} />
                <span className="font-mono text-[10px] tracking-wider text-stone-400">
                    #{order.orderId.slice(-10)}
                </span>
            </div>

            <div className="flex flex-1 flex-col p-5">
                <div className="mb-3.5 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] text-stone-400">
                        <Calendar size={10} strokeWidth={2.5} />
                        {fmtDate(order.createdAt)} · {fmtTime(order.createdAt)}
                    </span>
                    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        order.orderType === "delivery"
                            ? "border-amber-200 bg-amber-50 text-amber-600"
                            : "border-stone-200 bg-stone-50 text-stone-600"
                    }`}>
                        {order.orderType === "delivery"
                            ? <><Truck size={8} strokeWidth={2.5} /> Delivery</>
                            : <><Store size={8} strokeWidth={2.5} /> Pickup</>}
                    </span>
                </div>

                <div className="mb-4 space-y-2">
                    {previewItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 text-[11px] font-black text-amber-700">
                                {item.quantity}
                            </div>
                            <span className="flex-1 truncate text-[13px] font-medium text-stone-700">{item.name}</span>
                            <span className="shrink-0 text-[11px] font-semibold text-stone-500">
                                {fmtRs(item.price * item.quantity)}
                            </span>
                        </div>
                    ))}
                    {remaining > 0 && (
                        <p className="pl-8 text-[11px] text-stone-400">+{remaining} more item{remaining > 1 ? "s" : ""}</p>
                    )}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-amber-50 pt-3.5">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                            {itemCount} item{itemCount !== 1 ? "s" : ""}
                        </p>
                        <p className="text-[17px] font-black leading-tight text-orange-600">
                            {fmtRs(order.totalAmount)}
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-[11px] font-black text-white shadow-md shadow-orange-200 transition-all duration-200 group-hover:brightness-110">
                        View Details
                        <ChevronRight size={12} strokeWidth={3} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                </div>
            </div>
        </Link>
    );
}

function EmptyState({ filter, onClear }: { filter: FilterTab; onClear: () => void }) {
    const MAP: Record<FilterTab, { emoji: string; title: string; sub: string }> = {
        all:              { emoji: "🛍️", title: "No orders yet",            sub: "Your order history will show up here. Start with something delicious!" },
        active:           { emoji: "⏳", title: "No active orders",          sub: "All quiet for now. Fancy something fresh from the kitchen?" },
        delivered:        { emoji: "✅", title: "No delivered orders yet",   sub: "Completed orders land here once delivered." },
        received:         { emoji: "📬", title: "No orders received",        sub: "Orders confirmed by the kitchen appear here." },
        preparing:        { emoji: "👨‍🍳", title: "Nothing being prepared",  sub: "Orders being cooked will show up here in real-time." },
        out_for_delivery: { emoji: "🛵", title: "Nothing out for delivery",  sub: "Orders on their way to you will appear here." },
    };
    const { emoji, title, sub } = MAP[filter];
    return (
        <div className="flex flex-col items-center rounded-3xl border border-amber-100 bg-white px-8 py-20 text-center shadow-sm">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-50 to-orange-100 text-4xl shadow-inner">{emoji}</div>
            <h3 className="text-xl font-black text-stone-900">{title}</h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">{sub}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                {filter !== "all" && (
                    <button
                        onClick={onClear}
                        className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-bold text-stone-600 shadow-sm transition-all hover:bg-stone-50"
                    >
                        <X size={13} /> Show All Orders
                    </button>
                )}
                <Link
                    href="/menu"
                    className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-orange-200 transition-all hover:brightness-110 active:scale-95"
                >
                    <UtensilsCrossed size={13} strokeWidth={2.5} /> Browse Menu
                </Link>
            </div>
        </div>
    );
}

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
    if (total <= 1) return null;
    const getVisible = (): (number | "…")[] => {
        if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
        if (current <= 3) return [1, 2, 3, 4, 5, "…", total];
        if (current >= total - 2) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
        return [1, "…", current - 1, current, current + 1, "…", total];
    };
    return (
        <div className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
            <button
                onClick={() => onChange(current - 1)}
                disabled={current === 1}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200 bg-white text-stone-500 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
                <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            {getVisible().map((p, i) =>
                p === "…" ? (
                    <span key={`e${i}`} className="flex h-10 w-10 items-center justify-center text-sm text-stone-400">···</span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onChange(p as number)}
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold transition-all ${
                            current === p
                                ? "scale-105 bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200"
                                : "border border-amber-100 bg-white text-stone-600 shadow-sm hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                        }`}
                    >
                        {p}
                    </button>
                )
            )}
            <button
                onClick={() => onChange(current + 1)}
                disabled={current === total}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200 bg-white text-stone-500 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
                <ChevronRight size={16} strokeWidth={2.5} />
            </button>
            <span className="ml-1.5 text-xs text-stone-400">Page {current} of {total}</span>
        </div>
    );
}

type TabDef = { key: FilterTab; label: string; icon: React.ElementType };
const TABS: TabDef[] = [
    { key: "all",              label: "All",         icon: Package     },
    { key: "active",           label: "Active",      icon: Sparkles    },
    { key: "received",         label: "Received",    icon: Clock       },
    { key: "preparing",        label: "Preparing",   icon: ChefHat     },
    { key: "out_for_delivery", label: "On the Way",  icon: Truck       },
    { key: "delivered",        label: "Delivered",   icon: PartyPopper },
];

export default function MyOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState("");
    const [filter, setFilter]   = useState<FilterTab>("all");
    const [search, setSearch]   = useState("");
    const [page, setPage]       = useState(1);
    const gridRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function load() {
            try {
                const meRes = await fetch("/api/auth/me", { credentials: "include" });
                if (!meRes.ok) { router.replace("/auth?redirect=/my-orders"); return; }
                const meData = await meRes.json();
                if (!meData.success) { router.replace("/auth?redirect=/my-orders"); return; }
                const ordRes  = await fetch("/api/orders/my", { credentials: "include" });
                const ordData = await ordRes.json();
                if (!ordRes.ok || !ordData.success) { setError("Failed to load your orders. Please try again."); return; }
                setOrders(ordData.orders ?? []);
            } catch {
                setError("Something went wrong. Please refresh the page.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [router]);

    const activeOrders   = useMemo(() => orders.filter((o) => o.status !== "delivered"), [orders]);
    const totalSpent     = useMemo(() => orders.reduce((s, o) => s + o.totalAmount, 0), [orders]);
    const mostOrdered    = useMemo(() => {
        const freq: Record<string, number> = {};
        orders.forEach((o) => o.items.forEach((i) => { freq[i.name] = (freq[i.name] ?? 0) + i.quantity; }));
        return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }, [orders]);

    const tabCounts = useMemo<Record<FilterTab, number>>(() => ({
        all:              orders.length,
        active:           orders.filter((o) => o.status !== "delivered").length,
        received:         orders.filter((o) => o.status === "received").length,
        preparing:        orders.filter((o) => o.status === "preparing").length,
        out_for_delivery: orders.filter((o) => o.status === "out_for_delivery").length,
        delivered:        orders.filter((o) => o.status === "delivered").length,
    }), [orders]);

    const filteredOrders = useMemo(() => {
        let base = orders;
        if (filter === "active") base = base.filter((o) => o.status !== "delivered");
        else if (filter !== "all") base = base.filter((o) => o.status === filter);
        if (search.trim()) {
            const q = search.trim().toLowerCase().replace(/^#/, "");
            base = base.filter((o) =>
                o.orderId.toLowerCase().includes(q) ||
                o.items.some((i) => i.name.toLowerCase().includes(q)) ||
                o.customerName.toLowerCase().includes(q)
            );
        }
        return base;
    }, [orders, filter, search]);

    const totalPages  = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
    const pagedOrders = filteredOrders.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE);

    const handleFilter = (f: FilterTab) => { setFilter(f); setSearch(""); setPage(1); };
    const handleSearch = (v: string) => { setSearch(v); setPage(1); };
    const handlePage   = (p: number) => {
        setPage(p);
        setTimeout(() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    };

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FFFBF5]">

                {/* ── Hero ── */}
                <section className="relative overflow-hidden border-b border-amber-100">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-50/90 via-[#FFFBF5] to-orange-50/70" />
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.022]"
                        style={{ backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)", backgroundSize: "28px 28px" }}
                    />
                    <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }} />
                    <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(ellipse, #fbbf24, transparent 70%)" }} />

                    <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 md:px-8 md:pb-10 md:pt-14">
                        <div className="mb-4 flex items-center gap-3.5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/70">
                                <Package size={22} className="text-white" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-500">FoodKnock</p>
                                <h1 className="text-2xl font-black leading-tight text-stone-900 md:text-3xl">My Orders</h1>
                            </div>
                        </div>
                        <p className="mb-6 max-w-md text-sm leading-relaxed text-stone-500">
                            Every order in one place — track live status, view full details, and reorder your favourites in seconds.
                        </p>

                        {!loading && orders.length > 0 && (
                            <div className="flex flex-wrap gap-2.5">
                                <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-2.5 shadow-sm">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100">
                                        <ReceiptText size={13} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest leading-none text-stone-400">Total</p>
                                        <p className="text-sm font-black text-stone-900">{orders.length} orders</p>
                                    </div>
                                </div>
                                {activeOrders.length > 0 && (
                                    <div className="flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2.5 shadow-sm">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-100">
                                            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-orange-500" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest leading-none text-orange-400">Active</p>
                                            <p className="text-sm font-black text-orange-700">{activeOrders.length} live</p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 shadow-sm">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100">
                                        <IndianRupee size={13} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest leading-none text-emerald-500">Total Spent</p>
                                        <p className="text-sm font-black text-emerald-700">{fmtRs(totalSpent)}</p>
                                    </div>
                                </div>
                                {mostOrdered && (
                                    <div className="flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 shadow-sm">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-100">
                                            <TrendingUp size={13} className="text-violet-600" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest leading-none text-violet-400">Favourite</p>
                                            <p className="max-w-[120px] truncate text-sm font-black text-violet-700">{mostOrdered}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Sticky filter + search ── */}
                {!loading && !error && orders.length > 0 && (
                    <div className="sticky top-[68px] z-30 border-b border-amber-100 bg-[#FFFBF5]/95 shadow-sm backdrop-blur-xl">
                        <div className="mx-auto max-w-7xl px-4 md:px-8">
                            <div className="flex items-center gap-1.5 overflow-x-auto py-3 scrollbar-none">
                                {TABS.map(({ key, label, icon: Icon }) => {
                                    const cnt      = tabCounts[key];
                                    const isActive = filter === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => handleFilter(key)}
                                            className={`flex shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-[12px] font-bold transition-all duration-200 ${
                                                isActive
                                                    ? "border-orange-400 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200"
                                                    : "border-amber-100 bg-white text-stone-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                                            }`}
                                        >
                                            <Icon size={11} strokeWidth={2.5} />
                                            {label}
                                            {cnt > 0 && (
                                                <span className={`rounded-full px-1.5 py-px text-[10px] font-black leading-none ${isActive ? "bg-white/25 text-white" : "bg-stone-100 text-stone-500"}`}>
                                                    {cnt}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="pb-3">
                                <div className="relative">
                                    <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        placeholder="Search by dish name, order ID, or your name…"
                                        className="w-full rounded-2xl border border-amber-200 bg-white py-2.5 pl-10 pr-10 text-sm text-stone-700 shadow-sm placeholder:text-stone-400 transition-all focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                    />
                                    {search && (
                                        <button onClick={() => handleSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-400 transition-colors hover:text-stone-700">
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Content ── */}
                <div ref={gridRef} className="mx-auto max-w-7xl px-4 py-8 md:px-8">
                    {loading && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    )}
                    {!loading && error && (
                        <div className="flex flex-col items-center rounded-3xl border border-red-100 bg-white px-8 py-16 text-center shadow-sm">
                            <div className="mb-4 text-4xl">⚠️</div>
                            <p className="text-base font-black text-stone-900">Something went wrong</p>
                            <p className="mt-1 text-sm text-stone-500">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-5 rounded-full border border-red-200 bg-white px-6 py-2.5 text-sm font-bold text-red-600 shadow-sm transition-all hover:bg-red-50"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                    {!loading && !error && filteredOrders.length === 0 && (
                        <EmptyState filter={filter} onClear={() => handleFilter("all")} />
                    )}
                    {!loading && !error && filteredOrders.length > 0 && (
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-stone-500">
                                Showing{" "}
                                <span className="font-black text-stone-800">
                                    {(page - 1) * ORDERS_PER_PAGE + 1}–{Math.min(page * ORDERS_PER_PAGE, filteredOrders.length)}
                                </span>
                                {" "}of{" "}
                                <span className="font-black text-stone-800">{filteredOrders.length}</span>
                                {" "}order{filteredOrders.length !== 1 ? "s" : ""}
                                {search && <span className="text-orange-500"> for "{search}"</span>}
                            </p>
                            {search && (
                                <button
                                    onClick={() => handleSearch("")}
                                    className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-bold text-stone-500 shadow-sm transition-all hover:bg-stone-50"
                                >
                                    <X size={11} /> Clear search
                                </button>
                            )}
                        </div>
                    )}
                    {!loading && !error && pagedOrders.length > 0 && (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {pagedOrders.map((order, i) => (
                                    <OrderCard key={order._id} order={order} index={i} />
                                ))}
                            </div>
                            <Pagination current={page} total={totalPages} onChange={handlePage} />
                            {totalPages > 1 && (
                                <p className="mt-3 text-center text-xs text-stone-400">
                                    {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""} · {ORDERS_PER_PAGE} per page
                                </p>
                            )}
                        </>
                    )}

                    {!loading && !error && orders.length > 0 && (
                        <div className="relative mt-12 overflow-hidden rounded-3xl shadow-xl shadow-orange-200/60">
                            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 p-6 md:p-8">
                                <div
                                    className="pointer-events-none absolute inset-0 opacity-[0.10]"
                                    style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
                                />
                                <div className="relative flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
                                    <div>
                                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">🍽️ Always Fresh</p>
                                        <h3 className="text-xl font-black text-white">Craving something new?</h3>
                                        <p className="mt-1 text-sm text-white/80">Our full menu is hot, fresh, and ready for your next order.</p>
                                    </div>
                                    <Link
                                        href="/menu"
                                        className="flex shrink-0 items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-black text-orange-600 shadow-lg shadow-orange-800/20 transition-all hover:bg-orange-50 active:scale-95"
                                    >
                                        <UtensilsCrossed size={15} strokeWidth={2.5} />
                                        Order Again
                                        <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />

            <style jsx global>{`
                .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
                .scrollbar-none::-webkit-scrollbar { display: none; }
            `}</style>
        </>
    );
}