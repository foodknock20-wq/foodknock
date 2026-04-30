"use client";

// src/components/admin/users/UserTable.tsx
// Premium Customer Intelligence Table — FoodKnock
// PRODUCTION REWRITE: timer-ref cleanup, no stale closures, zero memory leaks

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
    Search, Users, CheckCircle2, XCircle, ShieldOff, ShieldCheck,
    Phone, Calendar, ShoppingBag, Crown, Loader2, Copy, MessageCircle,
    Star, TrendingUp, SlidersHorizontal, Zap, Award,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRow = {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: "user" | "admin";
    isActive: boolean;
    ordersCount: number;
    totalSpend: number;
    avgOrder: number;
    isVip: boolean;
    isRepeat: boolean;
    loyaltyPoints: number;
    createdAt: string;
};

type SortKey =
    | "newest"
    | "oldest"
    | "most_orders"
    | "zero_orders"
    | "highest_spend"
    | "repeat_buyers"
    | "active_only"
    | "blocked_only";

type Props = { users: UserRow[] };

// ─── Sort config ──────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "newest", label: "Newest Joined" },
    { key: "oldest", label: "Oldest Joined" },
    { key: "most_orders", label: "Most Orders" },
    { key: "highest_spend", label: "Top Spenders" },
    { key: "repeat_buyers", label: "Repeat Buyers" },
    { key: "zero_orders", label: "Zero Orders" },
    { key: "active_only", label: "Active Only" },
    { key: "blocked_only", label: "Blocked Only" },
];

// ─── Pure sort/filter helper (no closure over state, safe to call in useMemo) ─

function applySort(list: UserRow[], key: SortKey): UserRow[] {
    // Always copy to avoid mutating the source array
    const arr = [...list];
    switch (key) {
        case "newest": return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        case "oldest": return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        case "most_orders": return arr.sort((a, b) => b.ordersCount - a.ordersCount);
        case "highest_spend": return arr.sort((a, b) => b.totalSpend - a.totalSpend);
        case "repeat_buyers": return arr.filter((u) => u.isRepeat).sort((a, b) => b.ordersCount - a.ordersCount);
        case "zero_orders": return arr.filter((u) => u.ordersCount === 0);
        case "active_only": return arr.filter((u) => u.isActive);
        case "blocked_only": return arr.filter((u) => !u.isActive);
        default: return arr;
    }
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: "user" | "admin" }) {
    if (role !== "admin") return null;
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-400">
            <Crown size={8} /> Admin
        </span>
    );
}

function CustomerBadge({ isVip, isRepeat, ordersCount }: { isVip: boolean; isRepeat: boolean; ordersCount: number }) {
    if (isVip) return (
        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-yellow-300">
            <Award size={8} /> VIP
        </span>
    );
    if (isRepeat) return (
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-400">
            <Zap size={8} /> Repeat
        </span>
    );
    if (ordersCount === 0) return (
        <span className="inline-flex items-center gap-1 rounded-full border border-stone-700/40 bg-stone-800/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-stone-600">
            New
        </span>
    );
    return null;
}

function Avatar({ name, isVip }: { name: string; isVip: boolean }) {
    const initial = name.trim()[0]?.toUpperCase() ?? "?";
    return (
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ring-1 ${isVip
                ? "bg-gradient-to-br from-yellow-500/25 to-amber-500/25 text-yellow-300 ring-yellow-500/20"
                : "bg-gradient-to-br from-orange-500/15 to-amber-500/15 text-amber-400 ring-amber-500/12"
            }`}>
            {initial}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UserTable({ users: initialUsers }: Props) {
    const [users, setUsers] = useState<UserRow[]>(initialUsers);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("newest");
    const [loading, setLoading] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    // ── Ref-tracked timers — never leaks across renders or unmounts ───────
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadingUserRef = useRef<string | null>(null);

    // Cleanup all pending timers on unmount
    useEffect(() => {
        return () => {
            if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
        };
    }, []);

    // ── Derived filtered + sorted list ────────────────────────────────────
    // useMemo dependency array is stable — only recomputes when these 3 change.
    // applySort is a module-level pure function so it is never a stale closure.
    const visible = useMemo<UserRow[]>(() => {
        let list: UserRow[] = users;

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (u) =>
                    u.name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    u.phone.includes(q)
            );
        }

        return applySort(list, sortKey);
    }, [users, search, sortKey]);

    // ── Handlers ─────────────────────────────────────────────────────────

    const handleToggle = useCallback(async (user: UserRow) => {
        // Guard against double-click while a request is already in flight
        if (loadingUserRef.current === user._id) return;
        loadingUserRef.current = user._id;
        setLoading(user._id);

        const nextActive = !user.isActive;
        try {
            const res = await fetch(`/api/users/${user._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: nextActive }),
            });
            const data: { message?: string } = await res.json();
            if (!res.ok) {
                toast.error(data.message ?? "Failed to update user");
                return;
            }
            setUsers((prev) =>
                prev.map((u) => (u._id === user._id ? { ...u, isActive: nextActive } : u))
            );
            toast.success(nextActive ? "User unblocked" : "User blocked");
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            loadingUserRef.current = null;
            setLoading(null);
        }
    }, []); // no deps — reads user arg from param, setters are stable

    const handleCopyPhone = useCallback((phone: string, id: string) => {
        if (!phone) return;

        navigator.clipboard.writeText(phone).then(() => {
            // Clear any existing timer before setting a new one
            if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);

            setCopied(id);
            toast.success("Phone copied!", { duration: 1500 });

            copyTimerRef.current = setTimeout(() => {
                setCopied(null);
                copyTimerRef.current = null;
            }, 2000);
        }).catch(() => {
            toast.error("Could not copy to clipboard");
        });
    }, []); // stable — only uses ref + setter

    const handleWhatsApp = useCallback((phone: string) => {
        const clean = phone.replace(/\D/g, "");
        const num = clean.length === 10 ? `91${clean}` : clean;
        window.open(`https://wa.me/${num}`, "_blank", "noopener,noreferrer");
    }, []);

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <>
            {/* ── Controls bar ──────────────────────────────────────────── */}
            <div className="mb-5 space-y-3">
                {/* Search */}
                <div className="relative max-w-sm">
                    <Search
                        size={13}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-600"
                        strokeWidth={2}
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, email or phone…"
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-stone-300 placeholder:text-stone-700 focus:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                    />
                </div>

                {/* Sort pills */}
                <div className="flex items-center gap-2">
                    <SlidersHorizontal size={11} className="shrink-0 text-stone-600" />
                    <div className="flex flex-wrap gap-1.5">
                        {SORT_OPTIONS.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setSortKey(key)}
                                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all duration-150 ${sortKey === key
                                        ? "border border-amber-500/35 bg-amber-500/15 text-amber-400"
                                        : "border border-white/[0.06] bg-white/[0.02] text-stone-600 hover:border-white/10 hover:text-stone-400"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                        <Users size={22} className="text-stone-700" strokeWidth={1.5} />
                    </div>
                    <p className="font-serif text-base font-bold text-stone-500">
                        {users.length === 0 ? "No users yet" : "No users match this filter"}
                    </p>
                    <p className="mt-1 text-xs text-stone-700">
                        {users.length === 0
                            ? "Registered customers will appear here."
                            : "Try a different search or sort option."}
                    </p>
                </div>
            ) : (
                <>
                    {/* ── Desktop table ───────────────────────────────────── */}
                    <div className="hidden overflow-hidden rounded-2xl border border-white/[0.06] md:block">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/[0.05] bg-white/[0.015]">
                                    {[
                                        "Customer",
                                        "Contact",
                                        "Orders · Spend",
                                        "Avg Order",
                                        "Loyalty",
                                        "Status",
                                        "Joined",
                                        "Actions",
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-stone-700"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {visible.map((user) => (
                                    <tr
                                        key={user._id}
                                        className={`group transition-colors hover:bg-white/[0.025] ${!user.isActive ? "opacity-40" : ""
                                            }`}
                                    >
                                        {/* Customer */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <Avatar name={user.name} isVip={user.isVip} />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-stone-200">{user.name}</span>
                                                        <RoleBadge role={user.role} />
                                                        <CustomerBadge
                                                            isVip={user.isVip}
                                                            isRepeat={user.isRepeat}
                                                            ordersCount={user.ordersCount}
                                                        />
                                                    </div>
                                                    <p className="text-[11px] text-stone-600">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Contact */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[12px] text-stone-500">
                                                    {user.phone || "—"}
                                                </span>
                                                {user.phone && (
                                                    <>
                                                        <button
                                                            onClick={() => handleCopyPhone(user.phone, user._id)}
                                                            title="Copy phone"
                                                            aria-label="Copy phone number"
                                                            className="opacity-0 group-hover:opacity-100 text-stone-700 hover:text-stone-400 transition-all"
                                                        >
                                                            <Copy size={11} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleWhatsApp(user.phone)}
                                                            title="Open WhatsApp"
                                                            aria-label="Open WhatsApp chat"
                                                            className="opacity-0 group-hover:opacity-100 text-stone-700 hover:text-emerald-400 transition-all"
                                                        >
                                                            <MessageCircle size={11} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>

                                        {/* Orders + spend */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-amber-400">{user.ordersCount}</span>
                                                <span className="text-stone-700">·</span>
                                                <span className="font-bold text-emerald-400">
                                                    ₹{user.totalSpend.toLocaleString("en-IN")}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Avg order */}
                                        <td className="px-4 py-3.5">
                                            <span className="text-[12px] font-bold text-stone-400">
                                                {user.avgOrder > 0
                                                    ? `₹${user.avgOrder.toLocaleString("en-IN")}`
                                                    : "—"}
                                            </span>
                                        </td>

                                        {/* Loyalty */}
                                        <td className="px-4 py-3.5">
                                            {user.loyaltyPoints > 0 ? (
                                                <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/8 px-2.5 py-0.5">
                                                    <Star size={9} className="fill-amber-400 text-amber-400" />
                                                    <span className="font-mono text-[11px] font-black text-amber-400">
                                                        {user.loyaltyPoints}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-stone-700">—</span>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3.5">
                                            {user.isActive ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                                    <CheckCircle2 size={11} strokeWidth={2.5} /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                                                    <XCircle size={11} strokeWidth={2.5} /> Blocked
                                                </span>
                                            )}
                                        </td>

                                        {/* Joined */}
                                        <td className="px-4 py-3.5">
                                            <span className="text-[11px] text-stone-600">
                                                {new Date(user.createdAt).toLocaleDateString("en-IN", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3.5">
                                            {user.role !== "admin" && (
                                                <button
                                                    onClick={() => handleToggle(user)}
                                                    disabled={loading === user._id}
                                                    aria-label={user.isActive ? "Block user" : "Unblock user"}
                                                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition-all disabled:opacity-50 ${user.isActive
                                                            ? "border-rose-500/20 bg-rose-500/8 text-rose-400 hover:bg-rose-500/15"
                                                            : "border-emerald-500/20 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15"
                                                        }`}
                                                >
                                                    {loading === user._id ? (
                                                        <Loader2 size={10} className="animate-spin" />
                                                    ) : user.isActive ? (
                                                        <ShieldOff size={10} />
                                                    ) : (
                                                        <ShieldCheck size={10} />
                                                    )}
                                                    {user.isActive ? "Block" : "Unblock"}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Mobile cards ────────────────────────────────────── */}
                    <div className="space-y-3 md:hidden">
                        {visible.map((user) => (
                            <div
                                key={user._id}
                                className={`rounded-2xl border border-white/[0.06] bg-[#0f0f16] p-4 ${!user.isActive ? "opacity-50" : ""
                                    }`}
                            >
                                {/* Top row */}
                                <div className="flex items-start gap-3">
                                    <Avatar name={user.name} isVip={user.isVip} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <p className="font-bold text-white">{user.name}</p>
                                            <RoleBadge role={user.role} />
                                            <CustomerBadge
                                                isVip={user.isVip}
                                                isRepeat={user.isRepeat}
                                                ordersCount={user.ordersCount}
                                            />
                                        </div>
                                        <p className="truncate text-[11px] text-stone-600">{user.email}</p>
                                    </div>
                                    {user.isActive ? (
                                        <span className="shrink-0 text-[10px] font-bold text-emerald-400">Active</span>
                                    ) : (
                                        <span className="shrink-0 text-[10px] font-bold text-rose-400">Blocked</span>
                                    )}
                                </div>

                                {/* Stats grid */}
                                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                                    <div className="text-center">
                                        <p className="text-[9px] uppercase tracking-widest text-stone-700">Orders</p>
                                        <p className="font-mono text-sm font-black text-amber-400">{user.ordersCount}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] uppercase tracking-widest text-stone-700">Spend</p>
                                        <p className="font-mono text-sm font-black text-emerald-400">
                                            ₹{user.totalSpend > 999
                                                ? `${(user.totalSpend / 1000).toFixed(1)}k`
                                                : user.totalSpend}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] uppercase tracking-widest text-stone-700">Points</p>
                                        <p className="font-mono text-sm font-black text-amber-300">
                                            {user.loyaltyPoints || "—"}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions row */}
                                <div className="mt-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {user.phone && (
                                            <>
                                                <button
                                                    onClick={() => handleCopyPhone(user.phone, user._id)}
                                                    aria-label="Copy phone number"
                                                    className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-bold text-stone-500 hover:text-stone-300"
                                                >
                                                    <Copy size={10} />
                                                    {copied === user._id ? "Copied!" : "Copy"}
                                                </button>
                                                <button
                                                    onClick={() => handleWhatsApp(user.phone)}
                                                    aria-label="Open WhatsApp"
                                                    className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1.5 text-[10px] font-bold text-emerald-400"
                                                >
                                                    <MessageCircle size={10} /> WA
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    {user.role !== "admin" && (
                                        <button
                                            onClick={() => handleToggle(user)}
                                            disabled={loading === user._id}
                                            aria-label={user.isActive ? "Block user" : "Unblock user"}
                                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition-all disabled:opacity-50 ${user.isActive
                                                    ? "border-rose-500/20 bg-rose-500/8 text-rose-400"
                                                    : "border-emerald-500/20 bg-emerald-500/8 text-emerald-400"
                                                }`}
                                        >
                                            {loading === user._id ? (
                                                <Loader2 size={10} className="animate-spin" />
                                            ) : user.isActive ? (
                                                <ShieldOff size={10} />
                                            ) : (
                                                <ShieldCheck size={10} />
                                            )}
                                            {user.isActive ? "Block" : "Unblock"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Count strip */}
                    <p className="mt-4 text-right text-[11px] text-stone-700">
                        {visible.length} of {users.length} customer{users.length !== 1 ? "s" : ""}
                    </p>
                </>
            )}
        </>
    );
}