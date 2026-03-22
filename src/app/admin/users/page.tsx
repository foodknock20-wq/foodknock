export const dynamic = "force-dynamic";

// src/app/admin/users/page.tsx  (updated — responsive + ExportUsersButton)

import { connectDB }      from "@/lib/db";
import User               from "@/models/User";
import Order              from "@/models/Order";
import UserTable, { type UserRow } from "@/components/admin/users/UserTable";
import ExportUsersButton  from "@/components/admin/users/ExportUsersButton";
import { Users }          from "lucide-react";

function normalizePhone(phone: string) {
    return String(phone || "").replace(/\D/g, "").slice(-10);
}

async function getUsers(): Promise<UserRow[]> {
    await connectDB();

    const users = await User.find()
        .sort({ createdAt: -1 })
        .select("-password")
        .lean();

    if (users.length === 0) return [];

    const orders = await Order.find(
        { phone: { $exists: true, $ne: null } },
        "phone"
    ).lean();

    const countMap: Record<string, number> = {};

    orders.forEach((order: any) => {
        const normalized = normalizePhone(order.phone);
        if (!normalized) return;
        countMap[normalized] = (countMap[normalized] || 0) + 1;
    });

    return (users as any[]).map((u) => {
        const normalizedUserPhone = normalizePhone(u.phone);

        return {
            _id:         String(u._id),
            name:        u.name        ?? "",
            email:       u.email       ?? "",
            phone:       u.phone       ?? "",
            role:        (u.role       ?? "user") as "user" | "admin",
            isActive:    u.isActive    ?? true,
            ordersCount: countMap[normalizedUserPhone] ?? 0,
            createdAt:   u.createdAt
                ? new Date(u.createdAt).toISOString()
                : new Date().toISOString(),
        };
    });
}

export default async function AdminUsersPage() {
    const users = await getUsers();

    const totalUsers        = users.length;
    const activeUsers       = users.filter((u) => u.isActive).length;
    const blockedUsers      = users.filter((u) => !u.isActive).length;
    const usersWithOrders   = users.filter((u) => u.ordersCount > 0).length;

    return (
        <div className="space-y-5 sm:space-y-6">

            {/* ── Header row: title + export button ──────────────────── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                {/* Left: badge + title + subtitle */}
                <div className="min-w-0">
                    <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                        <Users size={11} className="text-amber-400" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                            Users
                        </span>
                    </div>
                    <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">
                        User Management
                    </h1>
                    <p className="mt-1 text-sm text-stone-500">
                        {totalUsers} registered customer{totalUsers !== 1 ? "s" : ""} —{" "}
                        manage accounts and access
                    </p>
                </div>

                {/* Right: full-width on mobile, auto on sm+ */}
                <div className="w-full sm:w-auto sm:shrink-0 sm:pt-1">
                    <ExportUsersButton />
                </div>
            </div>

            {/* ── Stat cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Total Users",  value: totalUsers,      color: "text-white" },
                    { label: "Active",        value: activeUsers,     color: "text-emerald-400" },
                    {
                        label: "Blocked",
                        value: blockedUsers,
                        color: blockedUsers > 0 ? "text-rose-400" : "text-stone-600",
                    },
                    { label: "Have Orders",  value: usersWithOrders, color: "text-amber-400" },
                ].map(({ label, value, color }) => (
                    <div
                        key={label}
                        className="rounded-xl border border-white/[0.06] bg-[#111118] px-4 py-3"
                    >
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-600">
                            {label}
                        </p>
                        <p className={`mt-1 font-serif text-2xl font-black ${color}`}>
                            {value}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── User table ─────────────────────────────────────────── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-4 sm:p-5">
                <UserTable users={users} />
            </div>
        </div>
    );
}
