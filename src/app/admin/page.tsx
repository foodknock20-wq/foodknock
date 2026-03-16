// src/app/admin/page.tsx
// FIXED: Added force-dynamic to prevent ISR caching on admin dashboard

export const dynamic = "force-dynamic";

import DashboardStatCard from "@/components/admin/DashboardStatCard";
import ShopToggle        from "@/components/admin/ShopToggle";
import {
    ShoppingBag, Package, Users, IndianRupee,
    Clock, AlertTriangle, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";

type OrderStatus = "pending" | "preparing" | "delivered" | "cancelled";

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
    recentOrders: RecentOrder[];
    lowStockProducts: LowStockProduct[];
};

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) !== 1 ? "s" : ""} ago`;
}

async function getDashboardData(): Promise<DashboardData> {
    await connectDB();

    const [
        totalOrders,
        revenueResult,
        totalProducts,
        totalUsers,
        rawRecentOrders,
        rawLowStock,
    ] = await Promise.all([
        Order.countDocuments(),
        Order.aggregate([
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Product.countDocuments(),
        User.countDocuments(),
        // ✅ Lean + minimal field selection
        Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select("_id customerName totalAmount status createdAt items")
            .lean(),
        Product.find({ stock: { $lte: 5 } })
            .sort({ stock: 1 })
            .limit(6)
            .select("_id name category stock price")
            .lean(),
    ]);

    const totalRevenue: number =
        revenueResult.length > 0 ? (revenueResult[0].total as number) : 0;

    const recentOrders: RecentOrder[] = (rawRecentOrders as any[]).map((o) => ({
        id:           String(o._id),
        customerName: o.customerName ?? "Unknown",
        totalAmount:  o.totalAmount ?? 0,
        status:       (o.status as OrderStatus) ?? "pending",
        createdAt:    o.createdAt ? timeAgo(new Date(o.createdAt)) : "—",
        items:        Array.isArray(o.items) ? o.items.length : (o.items ?? 0),
    }));

    const lowStockProducts: LowStockProduct[] = (rawLowStock as any[]).map((p) => ({
        id:       String(p._id),
        name:     p.name ?? "Unnamed Product",
        category: p.category ?? "—",
        stock:    p.stock ?? 0,
        price:    p.price ?? 0,
    }));

    return { totalOrders, totalRevenue, totalProducts, totalUsers, recentOrders, lowStockProducts };
}

const STATUS_STYLES: Record<OrderStatus, string> = {
    pending:   "bg-amber-500/12 text-amber-400 border-amber-500/20",
    preparing: "bg-sky-500/12 text-sky-400 border-sky-500/20",
    delivered: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20",
    cancelled: "bg-rose-500/12 text-rose-400 border-rose-500/20",
};

function StatusBadge({ status }: { status: OrderStatus }) {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
    return (
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style}`}>
            {status}
        </span>
    );
}

function StockBar({ stock }: { stock: number }) {
    const pct   = Math.min((stock / 10) * 100, 100);
    const color = stock <= 2 ? "bg-rose-500" : stock <= 4 ? "bg-amber-400" : "bg-emerald-400";
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/8">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs font-bold ${stock <= 2 ? "text-rose-400" : stock <= 4 ? "text-amber-400" : "text-emerald-400"}`}>
                {stock}
            </span>
        </div>
    );
}

function SectionCard({
    title, subtitle, ctaHref, ctaLabel, children,
}: {
    title: string; subtitle?: string; ctaHref: string; ctaLabel: string; children: React.ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111118]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div>
                    <h2 className="font-serif text-base font-bold text-white">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-[11px] text-stone-600">{subtitle}</p>}
                </div>
                <Link
                    href={ctaHref}
                    className="group flex items-center gap-1 text-[11px] font-semibold text-amber-500 transition-colors hover:text-amber-400"
                >
                    {ctaLabel}
                    <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
            </div>
            {children}
        </div>
    );
}

export default async function AdminDashboardPage() {
    const {
        totalOrders, totalRevenue, totalProducts, totalUsers,
        recentOrders, lowStockProducts,
    } = await getDashboardData();

    const criticallyLow = lowStockProducts.filter((p) => p.stock <= 2).length;

    return (
        <div className="space-y-8">
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/8 via-orange-500/4 to-[#111118] px-6 py-5">
                <div
                    className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-10 blur-3xl"
                    style={{ background: "radial-gradient(ellipse, #f59e0b, transparent 70%)" }}
                    aria-hidden="true"
                />
                <div className="relative flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="font-serif text-xl font-bold text-white md:text-2xl">Hello, Admin 👋</p>
                        <p className="mt-1 text-sm text-stone-500">Here&apos;s what&apos;s happening with your cafe today.</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.6)]" />
                        <span className="text-xs font-semibold text-emerald-400">Store is Open</span>
                    </div>
                </div>
            </div>

            <ShopToggle />

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <DashboardStatCard title="Total Orders"  value={totalOrders}  icon={ShoppingBag} description="All time orders placed" accentColor="amber" />
                <DashboardStatCard title="Revenue"       value={`₹${totalRevenue.toLocaleString("en-IN")}`} icon={IndianRupee} description="Total earnings" accentColor="emerald" />
                <DashboardStatCard title="Products"      value={totalProducts} icon={Package}     description="Active menu items"   accentColor="blue" />
                <DashboardStatCard title="Users"         value={totalUsers}    icon={Users}       description="Registered customers" accentColor="violet" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard title="Recent Orders" subtitle="Last 5 orders placed" ctaHref="/admin/orders" ctaLabel="View all">
                    {recentOrders.length === 0 ? (
                        <div className="flex items-center justify-center px-5 py-10 text-sm text-stone-600">No orders yet.</div>
                    ) : (
                        <div className="divide-y divide-white/[0.04]">
                            {recentOrders.map((order) => (
                                <div key={order.id} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                                        <ShoppingBag size={15} className="text-stone-500" strokeWidth={2} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-stone-200">{order.customerName}</p>
                                        <p className="text-[11px] text-stone-600">{order.items} item{order.items !== 1 ? "s" : ""} · {order.createdAt}</p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <span className="font-serif text-sm font-bold text-amber-400">₹{order.totalAmount.toLocaleString("en-IN")}</span>
                                        <StatusBadge status={order.status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                <SectionCard title="Low Stock Alert" subtitle="Products needing restock" ctaHref="/admin/products" ctaLabel="Manage">
                    {lowStockProducts.length === 0 ? (
                        <div className="flex items-center justify-center px-5 py-10 text-sm text-stone-600">All products are well stocked.</div>
                    ) : (
                        <>
                            <div className="divide-y divide-white/[0.04]">
                                {lowStockProducts.map((product) => (
                                    <div key={product.id} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${product.stock <= 2 ? "bg-rose-500/10" : "bg-amber-500/10"}`}>
                                            <AlertTriangle size={15} className={product.stock <= 2 ? "text-rose-400" : "text-amber-400"} strokeWidth={2} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-stone-200">{product.name}</p>
                                            <p className="text-[11px] text-stone-600">{product.category} · ₹{product.price}</p>
                                        </div>
                                        <div className="shrink-0"><StockBar stock={product.stock} /></div>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-white/[0.04] px-5 py-3">
                                <p className="flex items-center gap-1.5 text-[11px] text-stone-600">
                                    <Clock size={11} />
                                    {criticallyLow > 0
                                        ? `${criticallyLow} item${criticallyLow !== 1 ? "s" : ""} critically low — consider restocking soon.`
                                        : "All flagged items have some stock remaining."}
                                </p>
                            </div>
                        </>
                    )}
                </SectionCard>
            </div>
        </div>
    );
}
