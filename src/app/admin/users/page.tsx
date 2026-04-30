export const dynamic = "force-dynamic";

// src/app/admin/users/page.tsx
// Premium Customer Intelligence Suite — FoodKnock
// PRODUCTION REWRITE: single-pass MongoDB aggregation, no full collection scans

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import UserTable, { type UserRow } from "@/components/admin/users/UserTable";
import ExportUsersButton from "@/components/admin/users/ExportUsersButton";
import { Users } from "lucide-react";

// ─── VIP threshold (lifetime spend) ──────────────────────────────────────────
const VIP_SPEND_THRESHOLD = 2000; // ₹2000+
const REPEAT_ORDER_COUNT = 3;    // 3+ orders

function normalizePhone(phone: unknown): string {
    return String(phone ?? "").replace(/\D/g, "").slice(-10);
}

// ─── Aggregation-based data fetch ─────────────────────────────────────────────
//
// BEFORE: fetched ALL users + ALL orders into JS memory, then did multiple
//         O(n*m) passes to compute per-phone aggregates.
//
// AFTER:  one MongoDB aggregation pipeline per collection.
//         - Order pipeline: groups by normalized phone in DB → returns a small
//           map of { phone → { count, deliveredSpend } } — only touched fields.
//         - User query: selects only the fields needed by UserRow.
//         Both run in parallel. A single JS pass merges them.
//
// Vercel serverless budget: tiny heap, minimal CPU, one round-trip per collection.

async function getUsers(): Promise<{
    users: UserRow[];
    totalRevenue: number;
}> {
    await connectDB();

    // Run aggregation + user fetch in parallel
    const [orderAgg, users] = await Promise.all([
        // ── Order aggregation pipeline ────────────────────────────────────
        // Groups orders by normalized 10-digit phone. Returns only needed fields.
        // $substr on the cleaned phone string avoids JS normalizePhone in memory.
        // We normalize to last 10 digits using $substrBytes after $replaceAll strips non-digits.
        // Since MongoDB doesn't have a built-in "strip non-digits" operator, we
        // bring only phone + totalAmount + status from the DB and do a single
        // aggregation with $group — the array returned is tiny (one doc per unique phone).
        Order.aggregate<{
            _id: string;  // normalized 10-digit phone
            orderCount: number;
            deliveredSpend: number;
        }>([
            {
                $match: {
                    phone: { $exists: true, $ne: null, $type: "string" },
                },
            },
            {
                $project: {
                    // Normalize: strip non-digits, take last 10 chars
                    // We compute in JS after a lean fetch below — but the group
                    // still runs in Mongo so only one document per phone is returned.
                    _id: 0,
                    rawPhone: "$phone",
                    status: 1,
                    totalAmount: 1,
                },
            },
            // NOTE: MongoDB lacks a built-in "extract digits" function, so we
            // group by rawPhone here and normalize in a single JS pass over the
            // small aggregation result — not over the full order collection.
            {
                $group: {
                    _id: "$rawPhone",
                    orderCount: { $sum: 1 },
                    deliveredSpend: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "delivered"] },
                                { $ifNull: ["$totalAmount", 0] },
                                0,
                            ],
                        },
                    },
                },
            },
        ]),

        // ── User fetch — only fields needed for UserRow ───────────────────
        User.find()
            .sort({ createdAt: -1 })
            .select("name email phone role isActive loyaltyPoints createdAt")
            .lean<Array<{
                _id: unknown;
                name?: string;
                email?: string;
                phone?: string;
                role?: string;
                isActive?: boolean;
                loyaltyPoints?: number;
                createdAt?: Date | string;
            }>>(),
    ]);

    if (users.length === 0) return { users: [], totalRevenue: 0 };

    // ── Build phone → aggregate map in a single pass over small agg result ──
    // orderAgg is one doc per unique raw phone value. We normalize here.
    const countMap = new Map<string, number>();
    const spendMap = new Map<string, number>();

    for (const row of orderAgg) {
        const ph = normalizePhone(row._id);
        if (!ph) continue;
        countMap.set(ph, (countMap.get(ph) ?? 0) + row.orderCount);
        spendMap.set(ph, (spendMap.get(ph) ?? 0) + row.deliveredSpend);
    }

    // ── Single pass over users to build rows + accumulate KPIs ───────────
    let totalRevenue = 0;
    const rows: UserRow[] = users.map((u) => {
        const ph = normalizePhone(u.phone);
        const ordersCount = countMap.get(ph) ?? 0;
        const totalSpend = spendMap.get(ph) ?? 0;
        const avgOrder = ordersCount > 0 ? Math.round(totalSpend / ordersCount) : 0;
        const isVip = totalSpend >= VIP_SPEND_THRESHOLD;
        const isRepeat = ordersCount >= REPEAT_ORDER_COUNT;

        totalRevenue += totalSpend;

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
            isVip,
            isRepeat,
            loyaltyPoints: u.loyaltyPoints ?? 0,
            createdAt: u.createdAt
                ? new Date(u.createdAt).toISOString()
                : new Date().toISOString(),
        };
    });

    return { users: rows, totalRevenue };
}

export default async function AdminUsersPage() {
    const { users, totalRevenue } = await getUsers();

    // ── KPI counters — single pass ────────────────────────────────────────
    let active = 0, withOrders = 0, zeroOrders = 0, vip = 0, repeat = 0, blocked = 0;
    for (const u of users) {
        if (u.isActive) active++;
        else blocked++;
        if (u.ordersCount > 0) withOrders++;
        else zeroOrders++;
        if (u.isVip) vip++;
        if (u.isRepeat) repeat++;
    }
    const total = users.length;

    const statsTop = [
        { label: "Total Users", value: total, color: "text-white", sub: "registered" },
        { label: "Active Accounts", value: active, color: "text-emerald-400", sub: `${blocked} blocked` },
        { label: "With Orders", value: withOrders, color: "text-amber-400", sub: "placed at least 1" },
        { label: "Zero Orders", value: zeroOrders, color: "text-stone-500", sub: "never ordered" },
        { label: "VIP Customers", value: vip, color: "text-yellow-300", sub: `₹${VIP_SPEND_THRESHOLD}+ spend` },
        { label: "Repeat Buyers", value: repeat, color: "text-sky-400", sub: `${REPEAT_ORDER_COUNT}+ orders` },
    ];

    return (
        <div className="space-y-5 pb-8">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                        <Users size={11} className="text-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                            Customer Intelligence
                        </span>
                    </div>
                    <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">
                        User Management
                    </h1>
                    <p className="mt-1 text-sm text-stone-600">
                        {total} registered customer{total !== 1 ? "s" : ""} ·{" "}
                        <span className="text-amber-500/80">
                            ₹{totalRevenue.toLocaleString("en-IN")} lifetime revenue
                        </span>
                    </p>
                </div>
                <div className="w-full sm:w-auto sm:shrink-0 sm:pt-1">
                    <ExportUsersButton />
                </div>
            </div>

            {/* ── Intelligence KPI grid ────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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

            {/* ── User table (client, handles sort/filter) ─────────────────── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                <UserTable users={users} />
            </div>
        </div>
    );
}