// src/app/admin/page.tsx
// FoodKnock Admin Dashboard 2.0 — Operations Center (Phase 15E.8)
//
// Visual/information-architecture reference: ./admin_suggested_dashboard/
// FoodKnock Operations Dashboard.png — inspiration for layout/density only;
// every number below comes from a real, documented FoodKnock data source
// (see src/lib/adminDashboard.ts's header for the exact authority per
// section). Mobile-first: the DOM order below IS the mobile reading order
// (shop status -> today's KPIs -> orders -> alerts -> sales -> actions ->
// best sellers -> customer/review insight); desktop pairs sections into
// 2-column rows at `lg:` via grid, it does not reorder them.

export const dynamic = "force-dynamic";

import Link from "next/link";
import ShopToggle from "@/components/admin/ShopToggle";
import KpiCard from "@/components/admin/analytics/KpiCard";
import TrendChart from "@/components/admin/analytics/charts/TrendChart";
import DonutChart from "@/components/admin/analytics/charts/DonutChart";
import { OrderStatusBadge, STATUS_CONFIG } from "@/components/admin/orders/OrderStatusBadge";
import { getDashboardData } from "@/lib/adminDashboard";
import { isValidRangeKey, percentChange, type AnalyticsRangeKey } from "@/lib/analyticsDateRange";
import { formatINR, formatCompactINR, formatNumber, formatRate } from "@/lib/analyticsFormat";
import { cdnImage } from "@/lib/cdnImage";
import {
    ShoppingBag, IndianRupee, Receipt, Users, TrendingUp,
    Plus, Package, ClipboardList, UserRound, Sparkles, MapPin,
    AlertTriangle, Star, ArrowRight, Clock,
} from "lucide-react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const RANGE_TABS: { key: AnalyticsRangeKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "This Week" },
    { key: "thisMonth", label: "This Month" },
];

const OUTCOME_COLORS: Record<string, string> = {
    received: "#fbbf24", preparing: "#38bdf8", out_for_delivery: "#a78bfa",
    delivered: "#34d399", cancelled: "#fb7185",
};

function timeAgo(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const rawRange = typeof sp.range === "string" ? sp.range : undefined;
    const rangeKey: AnalyticsRangeKey = isValidRangeKey(rawRange) ? rawRange : "today";

    const data = await getDashboardData(rangeKey);
    const {
        today, yesterday, period, trend, outcome, bestSellers, customers,
        totalCustomers, allTime, recentOrders, lowStock, lowStockTotal, criticallyLowTotal, rating, activeCampaign,
    } = data;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const todayOrdersChange = percentChange(today.totalOrders, yesterday.totalOrders);
    const todayRevenueChange = percentChange(today.revenue, yesterday.revenue);
    const todayAov = today.totalOrders > today.cancelledOrders ? today.revenue / (today.totalOrders - today.cancelledOrders) : 0;
    const yesterdayAov = yesterday.totalOrders > yesterday.cancelledOrders ? yesterday.revenue / (yesterday.totalOrders - yesterday.cancelledOrders) : 0;
    const todayAovChange = percentChange(todayAov, yesterdayAov);

    const periodAov = period.totalOrders > period.cancelledOrders ? period.revenue / (period.totalOrders - period.cancelledOrders) : 0;

    const outcomeTotal = outcome.reduce((s, o) => s + o.count, 0);
    const donutSlices = outcome
        .filter((o) => o.count > 0)
        .map((o) => ({ label: STATUS_CONFIG[o.status as keyof typeof STATUS_CONFIG]?.label ?? o.status, value: o.count, color: OUTCOME_COLORS[o.status] ?? "#78716c" }));

    const quickActions = [
        { label: "Add Product", href: "/admin/products/new", icon: Plus },
        { label: "Manage Menu", href: "/admin/products", icon: Package },
        { label: "View Orders", href: "/admin/orders", icon: ClipboardList },
        { label: "Customers", href: "/admin/users", icon: UserRound },
        { label: "Create Offer", href: "/admin/campaigns", icon: Sparkles },
        { label: "Delivery Settings", href: "/admin/delivery", icon: MapPin },
    ];

    return (
        <div className="space-y-4 pb-8 sm:space-y-5">

            {/* ══ 1. Hero — greeting + shop status (mobile priority #1) ══ */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/15 bg-[#0d0d14] px-4 py-4 sm:px-5 sm:py-5">
                <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{ background: "radial-gradient(ellipse 60% 80% at 95% 10%, rgba(245,158,11,0.12), transparent)" }}
                    aria-hidden
                />
                <div className="relative flex flex-col gap-3">
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                            {greeting}, Admin 👋
                        </h1>
                        <p className="mt-0.5 text-xs text-stone-400">Here&apos;s what&apos;s happening with FoodKnock today.</p>
                    </div>
                    <ShopToggle />
                </div>
            </div>

            {/* ══ 2. Today's KPIs (mobile priority #2) ══ */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <KpiCard label="Today's Orders" value={formatNumber(today.totalOrders)} icon={ShoppingBag}
                    description="Orders created today (Asia/Kolkata), including cancelled."
                    comparisonPct={todayOrdersChange.pct} comparisonDirection={todayOrdersChange.direction} sub="vs yesterday" />
                <KpiCard label="Today's Revenue" value={formatCompactINR(today.revenue)} icon={IndianRupee}
                    description="Final amount of today's non-cancelled orders."
                    comparisonPct={todayRevenueChange.pct} comparisonDirection={todayRevenueChange.direction} sub="vs yesterday" />
                <KpiCard label="Avg Order Value" value={formatINR(todayAov)} icon={Receipt}
                    description="Today's revenue ÷ non-cancelled order count."
                    comparisonPct={todayAovChange.pct} comparisonDirection={todayAovChange.direction} sub="vs yesterday" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <KpiCard label="Total Orders" value={formatNumber(allTime.totalOrders)} icon={ClipboardList}
                    description="All orders ever placed, archived excluded." sub="All time" />
                <KpiCard label="Total Revenue" value={formatCompactINR(allTime.totalRevenue)} icon={TrendingUp}
                    description="Lifetime non-cancelled revenue, archived excluded." sub="All time" />
                <KpiCard label="Total Customers" value={formatNumber(totalCustomers)} icon={Users}
                    description="Registered customer accounts." sub="Registered" />
            </div>

            {/* ══ 3. Recent Orders + Today's Order Status (mobile priority #3) ══ */}
            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14]">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
                        <h2 className="text-[14px] font-bold text-white">Recent Orders</h2>
                        <Link href="/admin/orders" className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300">
                            View All <ArrowRight size={11} />
                        </Link>
                    </div>
                    {recentOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
                            <ShoppingBag size={20} className="text-stone-600" strokeWidth={1.5} />
                            <p className="text-sm font-bold text-stone-400">No orders yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.04]">
                            {recentOrders.map((order) => (
                                <Link
                                    key={order._id}
                                    href={`/admin/orders/${order._id}`}
                                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:px-5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-[12px] font-bold text-stone-200">{order.orderId}</span>
                                            <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-bold uppercase text-stone-300">
                                                {order.paymentMethod}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 truncate text-[11px] text-stone-500">
                                            {order.customerName} · {order.items} item{order.items !== 1 ? "s" : ""} · {timeAgo(order.createdAt)}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <span className="font-mono text-[12.5px] font-bold text-stone-100">₹{order.totalAmount.toLocaleString("en-IN")}</span>
                                        <OrderStatusBadge status={order.status} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                    <h2 className="mb-4 text-[14px] font-bold text-white">Today&apos;s Order Status</h2>
                    {outcomeTotal === 0 ? (
                        <div className="flex h-32 items-center justify-center text-[11px] text-stone-500">No orders today yet</div>
                    ) : (
                        <DonutChart slices={donutSlices} centerLabel={String(outcomeTotal)} centerSub="Orders" valueFormat={formatNumber} />
                    )}
                </div>
            </div>

            {/* ══ 4. Low Stock Alerts (mobile priority #4) ══ */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14]">
                <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
                    <div className="flex items-center gap-2">
                        <h2 className="text-[14px] font-bold text-white">Low Stock Alerts</h2>
                        {lowStockTotal > 0 && (
                            <span className="rounded-full border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[9px] font-black text-rose-400">
                                {lowStockTotal}
                            </span>
                        )}
                    </div>
                    <Link href="/admin/products?stock=low" className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300">
                        View All <ArrowRight size={11} />
                    </Link>
                </div>
                {lowStockTotal === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                        <TrendingUp size={20} className="text-emerald-500" strokeWidth={1.5} />
                        <p className="text-sm font-bold text-stone-400">All items well stocked</p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-white/[0.04]">
                            {lowStock.map((p) => (
                                <div key={p._id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03]">
                                        {p.image ? <img src={cdnImage(p.image, 48)} alt={p.name} className="h-full w-full object-cover" loading="lazy" /> : null}
                                    </div>
                                    <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-stone-200">{p.name}</p>
                                    <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${p.stock <= 2 ? "border-rose-500/25 bg-rose-500/10 text-rose-400" : "border-amber-500/25 bg-amber-500/10 text-amber-400"}`}>
                                        {p.stock} left
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-white/[0.04] px-4 py-2.5 sm:px-5">
                            <p className="flex items-center gap-1.5 text-[10px] text-stone-500">
                                <Clock size={10} />
                                {criticallyLowTotal > 0 ? `${criticallyLowTotal} item${criticallyLowTotal !== 1 ? "s" : ""} critically low (2 or fewer left)` : "All flagged items have some stock remaining"}
                                {lowStockTotal > lowStock.length ? ` · showing ${lowStock.length} of ${lowStockTotal}` : ""}
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* ══ 5. Sales Overview (mobile priority #5) ══ */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-[14px] font-bold text-white">Sales Overview</h2>
                        <p className="text-[11px] text-stone-500">Revenue and orders over time</p>
                    </div>
                    <div className="flex gap-1.5">
                        {RANGE_TABS.map((t) => (
                            <Link
                                key={t.key}
                                href={`/admin?range=${t.key}`}
                                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${rangeKey === t.key
                                    ? "border border-orange-500/35 bg-orange-500/15 text-orange-300"
                                    : "border border-white/[0.07] bg-white/[0.03] text-stone-300 hover:text-stone-100"
                                    }`}
                            >
                                {t.label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                    <div>
                        <span className="font-mono text-xl font-black text-white">{formatINR(period.revenue)}</span>
                        <span className="ml-2 text-[11px] text-stone-500">Revenue</span>
                    </div>
                    <div>
                        <span className="font-mono text-xl font-black text-white">{formatNumber(period.totalOrders)}</span>
                        <span className="ml-2 text-[11px] text-stone-500">Orders</span>
                    </div>
                    <div>
                        <span className="font-mono text-base font-bold text-stone-300">{formatINR(periodAov)}</span>
                        <span className="ml-2 text-[11px] text-stone-500">AOV</span>
                    </div>
                </div>

                <TrendChart
                    points={trend.map((t) => ({ bucketStart: t.bucketStart, value: t.revenue }))}
                    color="#f97316"
                    valueFormat={formatCompactINR}
                    bucket={data.range.bucket}
                    emptyLabel="No sales data in this range"
                />
            </div>

            {/* ══ 6. Quick Actions (mobile priority #6) ══ */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                <h2 className="mb-3 text-[14px] font-bold text-white">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {quickActions.map((a) => (
                        <Link
                            key={a.href}
                            href={a.href}
                            className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-[12.5px] font-bold text-stone-200 transition-all hover:border-amber-500/30 hover:bg-amber-500/8 hover:text-amber-300"
                        >
                            <a.icon size={15} strokeWidth={2} />
                            {a.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* ══ 7. Best Selling Items (mobile priority #7) ══ */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14]">
                <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
                    <h2 className="text-[14px] font-bold text-white">Best Selling Items</h2>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{data.range.label}</span>
                </div>
                {bestSellers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                        <Package size={20} className="text-stone-600" strokeWidth={1.5} />
                        <p className="text-sm font-bold text-stone-400">No sales in this range yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {bestSellers.slice(0, 5).map((p, i) => (
                            <div key={`${p.productId ?? p.name}-${i}`} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-[11px] font-black text-stone-400">
                                    {i + 1}
                                </span>
                                <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-stone-200">{p.name}</p>
                                <span className="shrink-0 text-[11px] text-stone-500">{p.units} sold</span>
                                <span className="shrink-0 font-mono text-[12.5px] font-bold text-amber-400">{formatCompactINR(p.revenue)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ══ 8. Customer Snapshot + Rating (mobile priority #8) ══ */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                    <h2 className="mb-3 text-[14px] font-bold text-white">Customer Snapshot</h2>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <p className="font-mono text-lg font-black text-white">{formatNumber(customers.newCustomers)}</p>
                            <p className="text-[10px] text-stone-500">New</p>
                        </div>
                        <div>
                            <p className="font-mono text-lg font-black text-white">{formatNumber(customers.returningCustomers)}</p>
                            <p className="text-[10px] text-stone-500">Returning</p>
                        </div>
                        <div>
                            <p className="font-mono text-lg font-black text-amber-400">{formatRate(customers.repeatCustomerRate)}</p>
                            <p className="text-[10px] text-stone-500">Repeat Rate</p>
                        </div>
                    </div>
                    <p className="mt-3 text-[10.5px] text-stone-500">In {data.range.label.toLowerCase()} · {formatNumber(totalCustomers)} total customers</p>
                </div>

                <Link
                    href="/admin/reviews"
                    className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 transition-colors hover:border-amber-500/20 sm:p-5"
                >
                    <div>
                        <h2 className="mb-1 text-[14px] font-bold text-white">Average Rating</h2>
                        {rating.average !== null ? (
                            <>
                                <p className="font-mono text-2xl font-black text-amber-400">{rating.average.toFixed(1)}</p>
                                <p className="text-[11px] text-stone-500">Based on {rating.count} review{rating.count !== 1 ? "s" : ""}</p>
                            </>
                        ) : (
                            <p className="text-[12px] text-stone-500">No reviews yet</p>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Star size={18} className="fill-amber-400 text-amber-400" />
                        <ArrowRight size={14} className="text-stone-500" />
                    </div>
                </Link>
            </div>

            {/* ══ 9. Active Campaign ══ */}
            {activeCampaign ? (
                <Link
                    href="/admin/campaigns"
                    className="flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/5 p-4 transition-colors hover:border-amber-500/35 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                            <Sparkles size={18} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="text-[13px] font-bold text-white">{activeCampaign.name}</p>
                            <p className="text-[11px] text-stone-400">
                                {activeCampaign.discountType === "PERCENTAGE" ? `${activeCampaign.discountValue}% OFF` : activeCampaign.discountType === "FREE_DELIVERY" ? "Free Delivery" : `₹${activeCampaign.discountValue} OFF`}
                                {" · "}{activeCampaign.ordersToday} order{activeCampaign.ordersToday !== 1 ? "s" : ""} today
                            </p>
                        </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-300">
                        Manage Offers <ArrowRight size={11} />
                    </span>
                </Link>
            ) : (
                <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                            <AlertTriangle size={16} className="text-stone-400" />
                        </div>
                        <p className="text-[12.5px] font-semibold text-stone-300">No active campaign right now</p>
                    </div>
                    <Link href="/admin/campaigns" className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/15">
                        Create Offer <ArrowRight size={11} />
                    </Link>
                </div>
            )}
        </div>
    );
}
