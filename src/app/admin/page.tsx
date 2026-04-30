// src/app/admin/page.tsx
// Premium Luxury Admin Dashboard — FoodKnock
// Ultra-refined dark aesthetic with gold accents, micro-details, and mobile-first layout

export const dynamic = "force-dynamic";

import ShopToggle from "@/components/admin/ShopToggle";
import {
    ShoppingBag, Package, Users, IndianRupee,
    Clock, AlertTriangle, ArrowRight, TrendingUp,
    Flame, Star, Zap,
} from "lucide-react";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "pending" | "preparing" | "delivered" | "cancelled" | "received";

type RecentOrder = {
    id: string;
    customerName: string;
    totalAmount: number;
    status: OrderStatus;
    createdAt: string;
    items: number;
};

type LowStockProduct = {
    id: string;
    name: string;
    category: string;
    stock: number;
    price: number;
};

type DashboardData = {
    totalOrders: number;
    totalRevenue: number;
    totalProducts: number;
    totalUsers: number;
    todayOrders: number;
    todayRevenue: number;
    recentOrders: RecentOrder[];
    lowStockProducts: LowStockProduct[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function getDashboardData(): Promise<DashboardData> {
    await connectDB();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
        totalOrders,
        revenueResult,
        totalProducts,
        totalUsers,
        todayOrders,
        todayRevenueResult,
        rawRecentOrders,
        rawLowStock,
    ] = await Promise.all([
        Order.countDocuments(),
        Order.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
        Product.countDocuments(),
        User.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: todayStart } }),
        Order.aggregate([
            { $match: { createdAt: { $gte: todayStart }, status: "delivered" } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Order.find()
            .sort({ createdAt: -1 })
            .limit(6)
            .select("_id customerName totalAmount status createdAt items")
            .lean(),
        Product.find({ stock: { $lte: 5 } })
            .sort({ stock: 1 })
            .limit(6)
            .select("_id name category stock price")
            .lean(),
    ]);

    return {
        totalOrders,
        totalRevenue: revenueResult[0]?.total ?? 0,
        totalProducts,
        totalUsers,
        todayOrders,
        todayRevenue: todayRevenueResult[0]?.total ?? 0,
        recentOrders: (rawRecentOrders as any[]).map((o) => ({
            id: String(o._id),
            customerName: o.customerName ?? "Unknown",
            totalAmount: o.totalAmount ?? 0,
            status: (o.status as OrderStatus) ?? "pending",
            createdAt: o.createdAt ? timeAgo(new Date(o.createdAt)) : "—",
            items: Array.isArray(o.items) ? o.items.length : (o.items ?? 0),
        })),
        lowStockProducts: (rawLowStock as any[]).map((p) => ({
            id: String(p._id),
            name: p.name ?? "Unnamed Product",
            category: p.category ?? "—",
            stock: p.stock ?? 0,
            price: p.price ?? 0,
        })),
    };
}

// ─── Status styles ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; text: string; bg: string; border: string; label: string }> = {
    pending: { dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Pending" },
    received: { dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Received" },
    preparing: { dot: "bg-sky-400", text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", label: "Preparing" },
    delivered: { dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Delivered" },
    cancelled: { dot: "bg-rose-400", text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", label: "Cancelled" },
};

function StatusPill({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
    title, value, sub, icon: Icon, accent, index,
}: {
    title: string;
    value: string | number;
    sub?: string;
    icon: React.ElementType;
    accent: "gold" | "emerald" | "sky" | "violet";
    index: number;
}) {
    const map = {
        gold: { glow: "#f59e0b", ring: "border-amber-500/25", bg: "bg-amber-500/8", text: "text-amber-400", iconBg: "bg-amber-500/12" },
        emerald: { glow: "#10b981", ring: "border-emerald-500/25", bg: "bg-emerald-500/8", text: "text-emerald-400", iconBg: "bg-emerald-500/12" },
        sky: { glow: "#38bdf8", ring: "border-sky-500/25", bg: "bg-sky-500/8", text: "text-sky-400", iconBg: "bg-sky-500/12" },
        violet: { glow: "#a78bfa", ring: "border-violet-500/25", bg: "bg-violet-500/8", text: "text-violet-400", iconBg: "bg-violet-500/12" },
    };
    const c = map[accent];

    return (
        <div
            className={`group relative overflow-hidden rounded-2xl border ${c.ring} bg-[#0d0d14] p-4 transition-all duration-300 hover:border-opacity-50 hover:shadow-lg`}
            style={{ animationDelay: `${index * 80}ms` }}
        >
            {/* Corner glow */}
            <div
                className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-15 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
                style={{ background: `radial-gradient(ellipse, ${c.glow}, transparent 70%)` }}
                aria-hidden
            />

            <div className="relative flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-stone-600">{title}</p>
                    <p className={`mt-2 font-mono text-[22px] font-black leading-none tracking-tight ${c.text}`}>
                        {value}
                    </p>
                    {sub && (
                        <p className="mt-1.5 text-[10px] text-stone-700">{sub}</p>
                    )}
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.iconBg} border ${c.ring}`}>
                    <Icon size={15} className={c.text} strokeWidth={2} />
                </div>
            </div>

            {/* Bottom accent line */}
            <div className={`absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-all duration-500 group-hover:w-full ${c.bg}`} />
        </div>
    );
}

// ─── Today strip ─────────────────────────────────────────────────────────────

function TodayStrip({ orders, revenue }: { orders: number; revenue: number }) {
    return (
        <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/6 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/15">
                    <Flame size={14} className="text-orange-400" />
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-600">Today's Orders</p>
                    <p className="font-mono text-lg font-black text-orange-400">{orders}</p>
                </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                    <Zap size={14} className="text-emerald-400" />
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-600">Today's Revenue</p>
                    <p className="font-mono text-lg font-black text-emerald-400">
                        ₹{revenue.toLocaleString("en-IN")}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Stock bar ────────────────────────────────────────────────────────────────

function StockBar({ stock }: { stock: number }) {
    const pct = Math.min((stock / 10) * 100, 100);
    const color = stock <= 2 ? "bg-rose-500" : stock <= 4 ? "bg-amber-400" : "bg-emerald-400";
    const txt = stock <= 2 ? "text-rose-400" : stock <= 4 ? "text-amber-400" : "text-emerald-400";
    return (
        <div className="flex items-center gap-2">
            <div className="h-1 w-12 overflow-hidden rounded-full bg-white/8">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-[11px] font-black tabular-nums ${txt}`}>{stock}</span>
        </div>
    );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
    title, subtitle, ctaHref, ctaLabel, badge, children,
}: {
    title: string;
    subtitle?: string;
    ctaHref: string;
    ctaLabel: string;
    badge?: number;
    children: React.ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14]">
            <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
                <div className="flex items-center gap-2.5">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="font-serif text-[15px] font-bold text-white">{title}</h2>
                            {badge !== undefined && badge > 0 && (
                                <span className="rounded-full border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[9px] font-black text-rose-400">
                                    {badge}
                                </span>
                            )}
                        </div>
                        {subtitle && (
                            <p className="mt-0.5 text-[10px] text-stone-700">{subtitle}</p>
                        )}
                    </div>
                </div>
                <Link
                    href={ctaHref}
                    className="group flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-400 transition-all duration-200 hover:bg-amber-500/15"
                >
                    {ctaLabel}
                    <ArrowRight size={10} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
            </div>
            {children}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
    const {
        totalOrders, totalRevenue, totalProducts, totalUsers,
        todayOrders, todayRevenue,
        recentOrders, lowStockProducts,
    } = await getDashboardData();

    const criticallyLow = lowStockProducts.filter((p) => p.stock <= 2).length;

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    return (
        <div className="space-y-5 pb-8">

            {/* ── Hero welcome banner ─────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/15 bg-[#0d0d14] px-5 py-5">
                {/* Mesh background */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                        background: "radial-gradient(ellipse 60% 80% at 95% 10%, rgba(245,158,11,0.12), transparent), radial-gradient(ellipse 40% 60% at 5% 90%, rgba(251,146,60,0.06), transparent)",
                    }}
                    aria-hidden
                />
                {/* Decorative line */}
                <div className="pointer-events-none absolute left-0 top-0 h-[1px] w-2/3 bg-gradient-to-r from-amber-500/40 to-transparent" aria-hidden />

                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/8 px-2.5 py-1">
                            <Star size={9} className="text-amber-400" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">Admin Panel</span>
                        </div>
                        <h1 className="font-serif text-xl font-black text-white sm:text-2xl">
                            {greeting}, Admin 👋
                        </h1>
                        <p className="mt-1 text-xs text-stone-600">
                            Here&apos;s your cafe intelligence for today.
                        </p>
                    </div>

                    {/* Live indicator */}
                    <div className="flex shrink-0 items-center gap-2 self-start rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3.5 py-2 sm:self-auto">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                        <span className="text-[11px] font-black text-emerald-400">Store Live</span>
                    </div>
                </div>
            </div>

            {/* ── Shop toggle ──────────────────────────────────────────────── */}
            <ShopToggle />

            {/* ── Today's pulse ────────────────────────────────────────────── */}
            <TodayStrip orders={todayOrders} revenue={todayRevenue} />

            {/* ── KPI stat grid ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <StatCard
                    title="Total Orders"
                    value={totalOrders.toLocaleString("en-IN")}
                    sub="All time"
                    icon={ShoppingBag}
                    accent="gold"
                    index={0}
                />
                <StatCard
                    title="Revenue"
                    value={`₹${(totalRevenue / 1000).toFixed(1)}k`}
                    sub="Total earnings"
                    icon={IndianRupee}
                    accent="emerald"
                    index={1}
                />
                <StatCard
                    title="Menu Items"
                    value={totalProducts}
                    sub="Active products"
                    icon={Package}
                    accent="sky"
                    index={2}
                />
                <StatCard
                    title="Customers"
                    value={totalUsers.toLocaleString("en-IN")}
                    sub="Registered users"
                    icon={Users}
                    accent="violet"
                    index={3}
                />
            </div>

            {/* ── Two column sections ──────────────────────────────────────── */}
            <div className="grid gap-4 lg:grid-cols-2">

                {/* Recent orders */}
                <SectionCard
                    title="Recent Orders"
                    subtitle="Latest activity"
                    ctaHref="/admin/orders"
                    ctaLabel="View all"
                >
                    {recentOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                                <ShoppingBag size={20} className="text-stone-700" strokeWidth={1.5} />
                            </div>
                            <p className="text-sm font-bold text-stone-600">No orders yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.04]">
                            {recentOrders.map((order, i) => (
                                <div
                                    key={order.id}
                                    className="group flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-white/[0.015]"
                                >
                                    {/* Index badge */}
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.03] text-[10px] font-black text-stone-700">
                                        {String(i + 1).padStart(2, "0")}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] font-bold text-stone-200">
                                            {order.customerName}
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-stone-700">
                                            {order.items} item{order.items !== 1 ? "s" : ""} · {order.createdAt}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                                        <span className="font-mono text-[13px] font-black text-amber-400">
                                            ₹{order.totalAmount.toLocaleString("en-IN")}
                                        </span>
                                        <StatusPill status={order.status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* Low stock */}
                <SectionCard
                    title="Stock Alerts"
                    subtitle="Items needing restock"
                    ctaHref="/admin/products"
                    ctaLabel="Manage"
                    badge={criticallyLow}
                >
                    {lowStockProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/15 bg-emerald-500/6">
                                <TrendingUp size={20} className="text-emerald-500" strokeWidth={1.5} />
                            </div>
                            <p className="text-sm font-bold text-stone-600">All items well stocked</p>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y divide-white/[0.04]">
                                {lowStockProducts.map((product) => (
                                    <div
                                        key={product.id}
                                        className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-white/[0.015]"
                                    >
                                        <div
                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${product.stock <= 2
                                                    ? "border border-rose-500/20 bg-rose-500/10"
                                                    : "border border-amber-500/20 bg-amber-500/10"
                                                }`}
                                        >
                                            <AlertTriangle
                                                size={13}
                                                className={product.stock <= 2 ? "text-rose-400" : "text-amber-400"}
                                                strokeWidth={2.5}
                                            />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-bold text-stone-200">
                                                {product.name}
                                            </p>
                                            <p className="mt-0.5 text-[10px] text-stone-700">
                                                {product.category} · ₹{product.price}
                                            </p>
                                        </div>

                                        <StockBar stock={product.stock} />
                                    </div>
                                ))}
                            </div>

                            {/* Footer note */}
                            <div className="border-t border-white/[0.04] px-5 py-3">
                                <p className="flex items-center gap-1.5 text-[10px] text-stone-700">
                                    <Clock size={10} />
                                    {criticallyLow > 0
                                        ? `${criticallyLow} item${criticallyLow !== 1 ? "s" : ""} critically low — restock soon`
                                        : "All flagged items have some stock remaining"}
                                </p>
                            </div>
                        </>
                    )}
                </SectionCard>
            </div>
        </div>
    );
}