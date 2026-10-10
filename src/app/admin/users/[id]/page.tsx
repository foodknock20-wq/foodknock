export const dynamic = "force-dynamic";

// src/app/admin/users/[id]/page.tsx
//
// Phase 15F — Customer detail / operational profile. New route (none
// existed before). Reuses, never duplicates:
//   - VIP_SPEND_THRESHOLD / REPEAT_ORDER_COUNT / classifyCustomerType()
//     from admin/users/page.tsx (same definitions as the list).
//   - the EXISTING /api/admin/loyalty/[userId] route for the loyalty
//     ledger (fetched client-side by CustomerLoyaltyPanel — not
//     re-queried here).
//   - the EXISTING order detail route (/admin/orders/[id]) — order rows
//     link there, never duplicate order business logic.
//   - User.addresses (Phase 9 Account 2.0 field) — no new address storage.
//
// Data authority per section (documented, not invented):
//   Orders/Delivered/Cancelled/Total Spend/AOV/First+Last Order
//     -> one bounded Order.aggregate() scoped to this user's phone
//        (same phone-matching convention the Customers list already uses
//        — Order has no `user` ObjectId on every historical row, phone is
//        the reliable match key across the app, see Order.ts/User.ts).
//        Total Spend = sum of DELIVERED order totalAmount, matching the
//        exact VIP definition on the list page (not all orders).
//   Most Ordered Items / Preferred Payment -> same bounded aggregate pass.
//   Order History list -> bounded, paginated Order.find() by phone.

import { notFound } from "next/navigation";
import Link from "next/link";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import CustomerLoyaltyPanel from "@/components/admin/users/CustomerLoyaltyPanel";
import SendNotificationButton from "@/components/admin/users/SendNotificationButton";
import { parseAdminPagination, buildPaginationMeta } from "@/lib/adminPagination";
import Pagination from "@/components/admin/shared/Pagination";
import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import {
    ArrowLeft, Mail, Phone, Calendar, ShieldCheck, ShieldOff, Award,
    MapPin, ShoppingBag, TrendingUp, Clock, CreditCard,
} from "lucide-react";

const VIP_SPEND_THRESHOLD = 2000;
const REPEAT_ORDER_COUNT = 3;

function normalizePhone(phone: unknown): string {
    return String(phone ?? "").replace(/\D/g, "").slice(-10);
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
type PageProps = { params: Promise<{ id: string }>; searchParams: SearchParams };

async function getCustomer(id: string, sp: Awaited<SearchParams>) {
    await connectDB();

    const user = await User.findById(id)
        .select("name email phone role isActive loyaltyPoints referralCode addresses createdAt")
        .lean<{
            _id: unknown; name?: string; email?: string; phone?: string; role?: string;
            isActive?: boolean; loyaltyPoints?: number; referralCode?: string;
            addresses?: Array<{
                _id: unknown; label?: string; flatNo?: string; addressLine: string; locality?: string;
                city: string; state: string; pincode: string; landmark?: string; isDefault?: boolean;
            }>;
            createdAt?: Date;
        }>();

    if (!user) return null;

    // Phone-match, NOT exact-string match — Order.phone and User.phone are
    // independently free-text fields that can differ in formatting (same
    // reason the Customers list's own orderAgg normalizes both sides
    // before comparing, see normalizePhone() above). Anchoring on just the
    // last 10 digits reproduces that same matching rule for this one
    // customer's bounded order set.
    const phone = normalizePhone(user.phone);
    const phoneMatch = phone ? { phone: { $regex: `${phone}$` } } : { phone: "__none__" };

    // One bounded aggregate for every derived order stat this page needs —
    // never more than this single user's own order documents are scanned,
    // and the $facet keeps it to one round trip.
    const [statsAgg] = await Order.aggregate([
        { $match: { ...phoneMatch, archivedAt: null } },
        {
            $facet: {
                totals: [
                    {
                        $group: {
                            _id: null,
                            totalOrders: { $sum: 1 },
                            delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
                            cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
                            totalSpend: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$totalAmount", 0] } },
                            firstOrderAt: { $min: "$createdAt" },
                            lastOrderAt: { $max: "$createdAt" },
                        },
                    },
                ],
                paymentMethods: [
                    { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ],
                topItems: [
                    { $unwind: "$items" },
                    { $group: { _id: "$items.name", quantity: { $sum: "$items.quantity" } } },
                    { $sort: { quantity: -1 } },
                    { $limit: 5 },
                ],
            },
        },
    ]);

    const totals = statsAgg?.totals?.[0] ?? {
        totalOrders: 0, delivered: 0, cancelled: 0, totalSpend: 0, firstOrderAt: null, lastOrderAt: null,
    };
    const aov = totals.delivered > 0 ? totals.totalSpend / totals.delivered : 0;
    const isVip = totals.totalSpend >= VIP_SPEND_THRESHOLD;
    const customerType =
        totals.totalOrders === 0 ? "no_orders" :
        totals.totalOrders === 1 ? "new" :
        totals.totalOrders < REPEAT_ORDER_COUNT ? "returning" : "repeat";

    const { page, limit, skip } = parseAdminPagination(sp, { defaultLimit: 10, maxLimit: 50 });
    const [orderRows, orderTotal] = await Promise.all([
        Order.find({ ...phoneMatch, archivedAt: null })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("orderId totalAmount status paymentMethod createdAt items")
            .lean<Array<{ _id: unknown; orderId?: string; totalAmount?: number; status?: string; paymentMethod?: string; createdAt?: Date; items?: unknown[] }>>(),
        Order.countDocuments({ ...phoneMatch, archivedAt: null }),
    ]);

    return {
        user: {
            id: String(user._id),
            name: user.name ?? "Unknown",
            email: user.email ?? "",
            phone: user.phone ?? "",
            role: user.role === "admin" ? "admin" : "user",
            isActive: user.isActive ?? true,
            loyaltyPoints: user.loyaltyPoints ?? 0,
            referralCode: user.referralCode ?? null,
            addresses: user.addresses ?? [],
            createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
        },
        stats: {
            totalOrders: totals.totalOrders,
            delivered: totals.delivered,
            cancelled: totals.cancelled,
            totalSpend: totals.totalSpend,
            aov,
            firstOrderAt: totals.firstOrderAt ? new Date(totals.firstOrderAt).toISOString() : null,
            lastOrderAt: totals.lastOrderAt ? new Date(totals.lastOrderAt).toISOString() : null,
            isVip,
            customerType,
            cancellationRate: totals.totalOrders > 0 ? (totals.cancelled / totals.totalOrders) * 100 : 0,
        },
        paymentMethods: (statsAgg?.paymentMethods ?? []) as { _id: string; count: number }[],
        topItems: (statsAgg?.topItems ?? []) as { _id: string; quantity: number }[],
        orders: orderRows.map((o) => ({
            _id: String(o._id),
            orderId: o.orderId ?? String(o._id),
            totalAmount: o.totalAmount ?? 0,
            status: o.status ?? "received",
            paymentMethod: o.paymentMethod ?? "cod",
            createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
            items: Array.isArray(o.items) ? o.items.length : 0,
        })),
        ordersMeta: buildPaginationMeta(orderTotal, page, limit),
    };
}

const TYPE_LABEL: Record<string, string> = {
    no_orders: "No Orders", new: "New", returning: "Returning", repeat: "Repeat",
};

export default async function CustomerDetailPage({ params, searchParams }: PageProps) {
    const { id } = await params;
    const sp = await searchParams;

    if (!mongoose.Types.ObjectId.isValid(id)) notFound();

    const data = await getCustomer(id, sp);
    if (!data) notFound();

    const { user, stats, paymentMethods, topItems, orders, ordersMeta } = data;

    return (
        <div className="space-y-5 pb-8">
            <Link
                href="/admin/users"
                className="group inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400 transition-all hover:text-amber-400"
            >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] transition-all group-hover:border-amber-500/25 group-hover:bg-amber-500/[0.08]">
                    <ArrowLeft size={11} className="transition-transform group-hover:-translate-x-0.5" />
                </span>
                Back to Customers
            </Link>

            {/* ── Header ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3.5">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-black ring-1 ${stats.isVip
                            ? "bg-gradient-to-br from-yellow-500/25 to-amber-500/25 text-yellow-300 ring-yellow-500/20"
                            : "bg-gradient-to-br from-orange-500/15 to-amber-500/15 text-amber-400 ring-amber-500/12"
                            }`}>
                            {user.name.trim()[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg font-bold text-white">{user.name}</h1>
                                {stats.isVip && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-yellow-300">
                                        <Award size={8} /> VIP
                                    </span>
                                )}
                                <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-stone-300">
                                    {TYPE_LABEL[stats.customerType]}
                                </span>
                                {user.isActive ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400"><ShieldCheck size={11} /> Active</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400"><ShieldOff size={11} /> Blocked</span>
                                )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-stone-400">
                                {user.phone && <span className="flex items-center gap-1.5"><Phone size={11} /> {user.phone}</span>}
                                {user.email && <span className="flex items-center gap-1.5"><Mail size={11} /> {user.email}</span>}
                                {user.createdAt && (
                                    <span className="flex items-center gap-1.5">
                                        <Calendar size={11} /> Joined {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <SendNotificationButton userId={user.id} userName={user.name} />
                </div>
            </div>

            {/* ── Summary KPIs ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                    { label: "Total Orders", value: stats.totalOrders, icon: ShoppingBag },
                    { label: "Delivered", value: stats.delivered, icon: ShieldCheck },
                    { label: "Cancelled", value: stats.cancelled, icon: ShieldOff },
                    { label: "Total Spend", value: `₹${stats.totalSpend.toLocaleString("en-IN")}`, icon: TrendingUp },
                    { label: "AOV", value: stats.aov > 0 ? `₹${Math.round(stats.aov).toLocaleString("en-IN")}` : "—", icon: CreditCard },
                    { label: "Last Order", value: stats.lastOrderAt ? new Date(stats.lastOrderAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "Never", icon: Clock },
                ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-xl border border-white/[0.06] bg-[#0d0d14] px-3.5 py-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-stone-500">{label}</p>
                            <Icon size={12} className="text-amber-400/60" />
                        </div>
                        <p className="mt-1.5 font-mono text-base font-black text-white">{value}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                {/* ── Order History ── */}
                <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14]">
                    <div className="border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
                        <h2 className="text-[14px] font-bold text-white">Order History</h2>
                    </div>
                    {orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
                            <ShoppingBag size={20} className="text-stone-600" strokeWidth={1.5} />
                            <p className="text-sm font-bold text-stone-400">No orders yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.04]">
                            {orders.map((o) => (
                                <Link
                                    key={o._id}
                                    href={`/admin/orders/${o._id}`}
                                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:px-5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <span className="font-mono text-[12px] font-bold text-stone-200">{o.orderId}</span>
                                        <p className="mt-0.5 text-[11px] text-stone-500">
                                            {o.items} item{o.items !== 1 ? "s" : ""} · {o.paymentMethod.toUpperCase()} · {new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <span className="font-mono text-[12.5px] font-bold text-stone-100">₹{o.totalAmount.toLocaleString("en-IN")}</span>
                                        <OrderStatusBadge status={o.status} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                    <div className="px-4 sm:px-5">
                        <Pagination
                            meta={ordersMeta}
                            basePath={`/admin/users/${user.id}`}
                            searchParams={{}}
                            itemLabel="orders"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    {/* ── Insights ── */}
                    <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                        <h2 className="mb-3 text-[14px] font-bold text-white">Insights</h2>
                        <div className="space-y-3">
                            <div>
                                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Preferred Payment</p>
                                {paymentMethods.length === 0 ? (
                                    <p className="text-[12px] text-stone-500">No orders yet</p>
                                ) : (
                                    <p className="text-[13px] font-semibold text-stone-200">
                                        {paymentMethods[0]._id === "razorpay" ? "Online (Razorpay)" : "Cash on Delivery"}
                                        <span className="ml-1.5 text-stone-500">({paymentMethods[0].count} order{paymentMethods[0].count !== 1 ? "s" : ""})</span>
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Most Ordered Items</p>
                                {topItems.length === 0 ? (
                                    <p className="text-[12px] text-stone-500">No orders yet</p>
                                ) : (
                                    <div className="space-y-1">
                                        {topItems.map((it) => (
                                            <div key={it._id} className="flex items-center justify-between text-[12px]">
                                                <span className="truncate text-stone-300">{it._id}</span>
                                                <span className="shrink-0 font-bold text-amber-400">×{it.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {stats.totalOrders > 0 && (
                                <div>
                                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Cancellation Rate</p>
                                    <p className={`text-[13px] font-semibold ${stats.cancellationRate > 20 ? "text-rose-400" : "text-stone-200"}`}>
                                        {stats.cancellationRate.toFixed(0)}%
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Loyalty ── */}
                    <CustomerLoyaltyPanel userId={user.id} currentBalance={user.loyaltyPoints} referralCode={user.referralCode} />

                    {/* ── Addresses ── */}
                    <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                        <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-white">
                            <MapPin size={14} className="text-amber-400" /> Saved Addresses
                        </h2>
                        {user.addresses.length === 0 ? (
                            <p className="text-[12px] text-stone-500">No saved addresses</p>
                        ) : (
                            <div className="space-y-2.5">
                                {user.addresses.map((a) => (
                                    <div key={String(a._id)} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                        <div className="flex items-center gap-2">
                                            {a.label && <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">{a.label}</span>}
                                            {a.isDefault && <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">Default</span>}
                                        </div>
                                        <p className="mt-1 text-[12px] leading-relaxed text-stone-300">
                                            {[a.flatNo, a.addressLine, a.locality, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                                        </p>
                                        {a.landmark && <p className="mt-0.5 text-[11px] text-stone-500">Near {a.landmark}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
