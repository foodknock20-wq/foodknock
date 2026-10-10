export const dynamic = "force-dynamic";

// src/app/admin/users/page.tsx
// Premium Customer Intelligence Suite — FoodKnock
//
// Phase 15A pagination fix — what changed and why:
//
//   BEFORE: `User.find().limit(2000)` shipped up to 2000 FULL user rows
//   (name/email/phone/loyalty/etc.) to the browser on every single admin
//   page load, and ALL search/sort/filtering happened client-side over
//   that in-memory array. Not literally unbounded, but not real
//   pagination either — exactly the ".limit(2000) is not proper
//   pagination" case called out in the Phase 15A audit.
//
//   AFTER: the rendered table is genuinely server-paginated (page/limit/
//   search/status via URL params, Mongo .skip().limit(), countDocuments
//   for the total) — only `limit` (default 25, max 100) rows ever reach
//   the browser.
//
//   KPI strip (Total/Active/VIP/Repeat/etc.) still needs a
//   dataset-wide view to be meaningful ("VIP customers" has to mean "across
//   all customers", not "on this page of 25"). That requires cross-
//   referencing every user's phone against order history — a real
//   aggregation-based rework (ideally a $lookup-free denormalized stat or
//   a carefully phone-normalized aggregation pipeline) that belongs to the
//   dedicated Customers 2.0 workstream (Phase 15F), not a pagination patch.
//   Left AS-IS for now: the pre-existing bounded (.limit(5000), lightweight
//   projection — phone/isActive/role only, never shipped to the browser)
//   server-side computation, unchanged in substance from before this fix.
//   This is an intentionally-deferred limitation, not an oversight — see
//   the Phase 15A chat report.
//
//   The four analytics-only sort modes that depended on that same
//   cross-referenced data (Most Orders / Top Spenders / Repeat Buyers /
//   Zero Orders) have been removed from the paginated list's sort control
//   for the same reason: they need a dataset-wide ranking, which a single
//   page of 25 rows cannot correctly express. Newest/Oldest/Active/Blocked
//   remain — all four are plain, real Mongo-level sorts/filters.

import Link from "next/link";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import UserTable, { type UserRow } from "@/components/admin/users/UserTable";
import ExportUsersButton from "@/components/admin/users/ExportUsersButton";
import Pagination from "@/components/admin/shared/Pagination";
import AdminListSearchBar from "@/components/admin/shared/AdminListSearchBar";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import { parseAdminPagination, buildPaginationMeta } from "@/lib/adminPagination";
import { Users } from "lucide-react";

// ── Customer metric definitions (Phase 15F) ─────────────────────────────
// VIP and Repeat are PRE-EXISTING FoodKnock definitions — reused verbatim
// from this same file's Phase 15A/15E version (identical thresholds also
// live in src/lib/offers.ts's VIP audience check). Not redefined here.
const VIP_SPEND_THRESHOLD = 2000;   // delivered-order spend >= this = VIP
const REPEAT_ORDER_COUNT = 3;        // total orders (any status) >= this = Repeat

// Customer Type tiers — an ordered extension of the SAME ordersCount
// value VIP/Repeat already use, not a new metric: 0 -> No Orders,
// 1 -> New, 2..REPEAT_ORDER_COUNT-1 -> Returning, >=REPEAT_ORDER_COUNT -> Repeat.
// VIP remains an independent overlay (spend-based, can combine with any tier).
export type CustomerType = "no_orders" | "new" | "returning" | "repeat";
function classifyCustomerType(ordersCount: number): CustomerType {
    if (ordersCount === 0) return "no_orders";
    if (ordersCount === 1) return "new";
    if (ordersCount < REPEAT_ORDER_COUNT) return "returning";
    return "repeat";
}

// "Inactive" has NO pre-existing FoodKnock definition anywhere in the
// codebase (checked: adminAnalytics.ts, offers.ts, loyaltyService.ts —
// none define retention/inactivity). Per the Phase 15F brief ("if no
// existing definition exists, document the proposed threshold before
// implementing"): this is a NEW, clearly-labeled operational heuristic —
// a customer who has ordered before but not in the last INACTIVE_DAYS
// days. Surfaced in the UI as "Inactive (60d+)", not bare "Inactive", so
// it reads as the proposed heuristic it is, not an authoritative system
// definition.
const INACTIVE_DAYS = 60;

function normalizePhone(phone: unknown): string {
    return String(phone ?? "").replace(/\D/g, "").slice(-10);
}

type SortParam = "newest" | "oldest" | "active" | "blocked";
export type TypeFilter = "all" | "no_orders" | "new" | "returning" | "repeat" | "vip" | "inactive";
const VALID_TYPE_FILTERS: TypeFilter[] = ["all", "no_orders", "new", "returning", "repeat", "vip", "inactive"];

async function getKpis() {
    await connectDB();

    // Unchanged in substance from the pre-Phase-15 implementation — see
    // file header. Lightweight projection, bounded, server-only (never
    // reaches the browser as rows — only the derived counts below do).
    // Phase 15F: `lastOrderAt` added to the SAME existing aggregation
    // (one extra $max in an already-running $group — no new query).
    const [orderAgg, kpiUsers] = await Promise.all([
        Order.aggregate<{ _id: string; orderCount: number; deliveredSpend: number; lastOrderAt: Date }>([
            { $match: { phone: { $exists: true, $ne: null, $type: "string" } } },
            { $project: { _id: 0, rawPhone: "$phone", status: 1, totalAmount: 1, createdAt: 1 } },
            {
                $group: {
                    _id: "$rawPhone",
                    orderCount: { $sum: 1 },
                    deliveredSpend: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, { $ifNull: ["$totalAmount", 0] }, 0] } },
                    lastOrderAt: { $max: "$createdAt" },
                },
            },
        ]),
        User.find().select("_id phone isActive").limit(5000).lean<Array<{ _id: unknown; phone?: string; isActive?: boolean }>>(),
    ]);

    const countMap = new Map<string, number>();
    const spendMap = new Map<string, number>();
    const lastOrderMap = new Map<string, Date>();
    for (const row of orderAgg) {
        const ph = normalizePhone(row._id);
        if (!ph) continue;
        countMap.set(ph, (countMap.get(ph) ?? 0) + row.orderCount);
        spendMap.set(ph, (spendMap.get(ph) ?? 0) + row.deliveredSpend);
        const existing = lastOrderMap.get(ph);
        if (!existing || row.lastOrderAt > existing) lastOrderMap.set(ph, row.lastOrderAt);
    }

    const inactiveCutoff = new Date(Date.now() - INACTIVE_DAYS * 86_400_000);

    let active = 0, blocked = 0, withOrders = 0, zeroOrders = 0, vip = 0, repeat = 0, newCount = 0, returning = 0, inactive = 0, totalRevenue = 0;
    // Phase 15F: ids qualifying each type filter, built from this SAME
    // bounded 5000-user pass — reused to scope the paginated query below
    // (`_id: {$in: [...]}`) rather than running a second computation.
    const idsByType: Record<TypeFilter, string[]> = { all: [], no_orders: [], new: [], returning: [], repeat: [], vip: [], inactive: [] };

    for (const u of kpiUsers) {
        if (u.isActive) active++; else blocked++;
        const ph = normalizePhone(u.phone);
        const ordersCount = countMap.get(ph) ?? 0;
        const totalSpend = spendMap.get(ph) ?? 0;
        const lastOrderAt = lastOrderMap.get(ph) ?? null;
        totalRevenue += totalSpend;
        const id = String(u._id);
        const isVip = totalSpend >= VIP_SPEND_THRESHOLD;
        const type = classifyCustomerType(ordersCount);
        const isInactive = ordersCount > 0 && lastOrderAt !== null && lastOrderAt.getTime() < inactiveCutoff.getTime();

        if (ordersCount > 0) withOrders++; else zeroOrders++;
        if (isVip) { vip++; idsByType.vip.push(id); }
        if (type === "repeat") { repeat++; idsByType.repeat.push(id); }
        if (type === "new") { newCount++; idsByType.new.push(id); }
        if (type === "returning") { returning++; idsByType.returning.push(id); }
        if (type === "no_orders") idsByType.no_orders.push(id);
        if (isInactive) { inactive++; idsByType.inactive.push(id); }
    }

    return {
        total: kpiUsers.length, active, blocked, withOrders, zeroOrders, vip, repeat,
        newCount, returning, inactive, totalRevenue, orderAgg, idsByType,
    };
}

async function getUsersPage(
    searchParams: { [key: string]: string | string[] | undefined },
    orderAgg: Array<{ _id: string; orderCount: number; deliveredSpend: number; lastOrderAt: Date }>,
    idsByType: Record<TypeFilter, string[]>
) {
    const { page, limit, skip } = parseAdminPagination(searchParams, { defaultLimit: 25, maxLimit: 100 });
    const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
    const sort: SortParam = (["newest", "oldest", "active", "blocked"] as const).includes(searchParams.sort as SortParam)
        ? (searchParams.sort as SortParam)
        : "newest";
    const rawType = typeof searchParams.type === "string" ? searchParams.type : "all";
    const type: TypeFilter = VALID_TYPE_FILTERS.includes(rawType as TypeFilter) ? (rawType as TypeFilter) : "all";

    const filter: Record<string, unknown> = {};
    if (sort === "active") filter.isActive = true;
    if (sort === "blocked") filter.isActive = false;
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
        ];
    }
    // Phase 15F: scope to the type-matching id set computed in getKpis()
    // (same bounded 5000-user pass) — not a second unbounded computation.
    if (type !== "all") {
        filter._id = { $in: idsByType[type].map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const sortSpec: Record<string, 1 | -1> = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

    const [rows, total] = await Promise.all([
        User.find(filter)
            .select("name email phone role isActive loyaltyPoints createdAt")
            .sort(sortSpec)
            .skip(skip)
            .limit(limit)
            .lean<Array<{
                _id: unknown; name?: string; email?: string; phone?: string;
                role?: string; isActive?: boolean; loyaltyPoints?: number; createdAt?: Date | string;
            }>>(),
        User.countDocuments(filter),
    ]);

    const countMap = new Map<string, number>();
    const spendMap = new Map<string, number>();
    const lastOrderMap = new Map<string, Date>();
    for (const row of orderAgg) {
        const ph = normalizePhone(row._id);
        if (!ph) continue;
        countMap.set(ph, (countMap.get(ph) ?? 0) + row.orderCount);
        spendMap.set(ph, (spendMap.get(ph) ?? 0) + row.deliveredSpend);
        const existing = lastOrderMap.get(ph);
        if (!existing || row.lastOrderAt > existing) lastOrderMap.set(ph, row.lastOrderAt);
    }

    const users: UserRow[] = rows.map((u) => {
        const ph = normalizePhone(u.phone);
        const ordersCount = countMap.get(ph) ?? 0;
        const totalSpend = spendMap.get(ph) ?? 0;
        const avgOrder = ordersCount > 0 ? Math.round(totalSpend / ordersCount) : 0;
        const lastOrderAt = lastOrderMap.get(ph) ?? null;
        return {
            _id: String(u._id),
            name: u.name ?? "",
            email: u.email ?? "",
            phone: u.phone ?? "",
            role: (u.role === "admin" ? "admin" : "user") as "user" | "admin",
            isActive: u.isActive ?? true,
            ordersCount,
            totalSpend,
            avgOrder,
            isVip: totalSpend >= VIP_SPEND_THRESHOLD,
            isRepeat: ordersCount >= REPEAT_ORDER_COUNT,
            customerType: classifyCustomerType(ordersCount),
            lastOrderAt: lastOrderAt ? lastOrderAt.toISOString() : null,
            loyaltyPoints: u.loyaltyPoints ?? 0,
            createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
        };
    });

    return { users, meta: buildPaginationMeta(total, page, limit), sort, search, type };
}

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedSearchParams = await searchParams;
    const kpis = await getKpis();
    const { users, meta, sort, search, type } = await getUsersPage(resolvedSearchParams, kpis.orderAgg, kpis.idsByType);

    const statsTop = [
        { label: "Total Users", value: kpis.total, color: "text-white", sub: "registered" },
        { label: "Active Accounts", value: kpis.active, color: "text-emerald-400", sub: `${kpis.blocked} blocked` },
        { label: "With Orders", value: kpis.withOrders, color: "text-amber-400", sub: "placed at least 1" },
        { label: "Zero Orders", value: kpis.zeroOrders, color: "text-stone-400", sub: "never ordered" },
        { label: "New (1 order)", value: kpis.newCount, color: "text-sky-400", sub: "placed exactly 1" },
        { label: "Returning", value: kpis.returning, color: "text-violet-400", sub: `2–${REPEAT_ORDER_COUNT - 1} orders` },
        { label: "Repeat Buyers", value: kpis.repeat, color: "text-emerald-300", sub: `${REPEAT_ORDER_COUNT}+ orders` },
        { label: "VIP Customers", value: kpis.vip, color: "text-yellow-300", sub: `₹${VIP_SPEND_THRESHOLD}+ spend` },
    ];

    return (
        <div className="space-y-5 pb-8">

            <AdminPageHeader
                icon={Users}
                title="Customers"
                description={
                    <>
                        {kpis.total} registered ·{" "}
                        <span className="text-amber-400">₹{kpis.totalRevenue.toLocaleString("en-IN")} lifetime revenue</span>
                    </>
                }
                actions={<ExportUsersButton />}
            />

            {/* ── Intelligence KPI grid ────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {statsTop.map(({ label, value, color, sub }) => (
                    <div
                        key={label}
                        className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14] px-4 py-3.5"
                    >
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-stone-600">{label}</p>
                        <p className={`mt-1.5 font-mono text-2xl font-black ${color}`}>{value}</p>
                        <p className="mt-0.5 text-[10px] text-stone-700">{sub}</p>
                        <div className="pointer-events-none absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-white/5" />
                    </div>
                ))}
            </div>

            {/* ── User table ─────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <AdminListSearchBar placeholder="Search name, email, or phone…" />
                    <UserSortFilter current={sort} search={search} type={type} />
                </div>
                <div className="mb-5">
                    <CustomerTypeFilter current={type} search={search} sort={sort} />
                </div>

                <UserTable users={users} />

                <Pagination
                    meta={meta}
                    basePath="/admin/users"
                    searchParams={{ search, sort: sort === "newest" ? undefined : sort, type: type === "all" ? undefined : type }}
                    itemLabel="customers"
                />
            </div>
        </div>
    );
}

// ── Customer type filter chips — same URL-driven Link pattern, scoped by
//    the id sets computed once in getKpis() (see §ids ByType above). ─────
function CustomerTypeFilter({ current, search, sort }: { current: TypeFilter; search?: string; sort: SortParam }) {
    const options: { value: TypeFilter; label: string }[] = [
        { value: "all", label: "All Customers" },
        { value: "no_orders", label: "No Orders" },
        { value: "new", label: "New" },
        { value: "returning", label: "Returning" },
        { value: "repeat", label: "Repeat" },
        { value: "vip", label: "High Value (VIP)" },
        { value: "inactive", label: `Inactive (${INACTIVE_DAYS}d+)` },
    ];
    return (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {options.map((o) => {
                const params = new URLSearchParams();
                if (search) params.set("search", search);
                if (sort !== "newest") params.set("sort", sort);
                if (o.value !== "all") params.set("type", o.value);
                params.set("page", "1");
                const href = `/admin/users?${params.toString()}`;
                const active = current === o.value;
                return (
                    <Link
                        key={o.value}
                        href={href}
                        className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold transition-colors ${active
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                            : "border-white/[0.07] bg-white/[0.02] text-stone-300 hover:border-white/[0.12] hover:text-stone-100"
                            }`}
                    >
                        {o.label}
                    </Link>
                );
            })}
        </div>
    );
}

// ── Sort/status filter — plain server-rendered links, same URL-driven
//    pattern as Pagination/AdminListSearchBar. ──────────────────────────
function UserSortFilter({ current, search, type }: { current: SortParam; search?: string; type: TypeFilter }) {
    const options: { value: SortParam; label: string }[] = [
        { value: "newest", label: "Newest Joined" },
        { value: "oldest", label: "Oldest Joined" },
        { value: "active", label: "Active Only" },
        { value: "blocked", label: "Blocked Only" },
    ];
    return (
        <div className="flex shrink-0 flex-wrap gap-1.5">
            {options.map((o) => {
                const params = new URLSearchParams();
                if (search) params.set("search", search);
                if (o.value !== "newest") params.set("sort", o.value);
                if (type !== "all") params.set("type", type);
                params.set("page", "1");
                const href = `/admin/users?${params.toString()}`;
                const active = current === o.value;
                return (
                    <Link
                        key={o.value}
                        href={href}
                        className={`rounded-xl border px-3 py-2.5 text-[12px] font-bold transition-colors ${active
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                            : "border-white/[0.07] bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]"
                            }`}
                    >
                        {o.label}
                    </Link>
                );
            })}
        </div>
    );
}
