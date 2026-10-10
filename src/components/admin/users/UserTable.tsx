"use client";

// src/components/admin/users/UserTable.tsx
// Premium Customer Intelligence Table — FoodKnock
// PRODUCTION REWRITE: timer-ref cleanup, no stale closures, zero memory leaks

import { useCallback, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
    Users, CheckCircle2, XCircle, ShieldOff, ShieldCheck,
    Crown, Loader2, Copy, MessageCircle, Star, Zap, Award, Sparkles,
} from "lucide-react";
import type { CustomerType } from "@/app/admin/users/page";

// Phase 15A: search + sort/status filters are now server-side
// (AdminListSearchBar + UserSortFilter on the parent page) — this
// component only ever receives the current page's rows.

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
    customerType: CustomerType;
    lastOrderAt: string | null;
    loyaltyPoints: number;
    createdAt: string;
};

type Props = { users: UserRow[] };

function lastOrderLabel(iso: string | null): string {
    if (!iso) return "Never";
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
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

// Phase 15F: the badge previously shown here for "ordersCount === 0" was
// labeled "New" — overloaded with a different meaning than the Customers
// 2.0 brief's 4-tier taxonomy (New/Returning/Repeat/No Orders). Relabeled
// "No Orders" for that zero case; "New" is now its own tier (exactly 1
// order), distinct from "Returning" (2..REPEAT_ORDER_COUNT-1) — see
// classifyCustomerType() in admin/users/page.tsx for the exact rule. VIP
// remains an independent spend-based overlay, shown regardless of tier.
function CustomerBadge({ isVip, customerType }: { isVip: boolean; customerType: CustomerType }) {
    if (isVip) return (
        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-yellow-300">
            <Award size={8} /> VIP
        </span>
    );
    if (customerType === "repeat") return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400">
            <Zap size={8} /> Repeat
        </span>
    );
    if (customerType === "returning") return (
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-400">
            <Sparkles size={8} /> Returning
        </span>
    );
    if (customerType === "new") return (
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-400">
            New
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-stone-700/40 bg-stone-800/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-stone-400">
            No Orders
        </span>
    );
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

export default function UserTable({ users }: Props) {
    const router = useRouter();
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
            toast.success(nextActive ? "User unblocked" : "User blocked");
            router.refresh();
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            loadingUserRef.current = null;
            setLoading(null);
        }
    }, [router]);

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
            {users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                        <Users size={22} className="text-stone-700" strokeWidth={1.5} />
                    </div>
                    <p className="text-base font-bold text-stone-300">No users found</p>
                    <p className="mt-1 text-xs text-stone-700">
                        Try a different search or filter.
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
                                        "Last Order",
                                        "Status",
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
                                {users.map((user) => (
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
                                                        <CustomerBadge isVip={user.isVip} customerType={user.customerType} />
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
                                                            className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-stone-100 transition-all"
                                                        >
                                                            <Copy size={11} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleWhatsApp(user.phone)}
                                                            title="Open WhatsApp"
                                                            aria-label="Open WhatsApp chat"
                                                            className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-emerald-400 transition-all"
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

                                        {/* Last Order */}
                                        <td className="px-4 py-3.5">
                                            <span className="text-[11px] text-stone-400">{lastOrderLabel(user.lastOrderAt)}</span>
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

                                        {/* Actions */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <Link
                                                    href={`/admin/users/${user._id}`}
                                                    className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-bold text-stone-200 transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300"
                                                >
                                                    View
                                                </Link>
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
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Mobile cards ────────────────────────────────────── */}
                    <div className="space-y-3 md:hidden">
                        {users.map((user) => (
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
                                            <CustomerBadge isVip={user.isVip} customerType={user.customerType} />
                                        </div>
                                        <p className="truncate text-[11px] text-stone-600">{user.email}</p>
                                        <p className="text-[10.5px] text-stone-500">Last order: {lastOrderLabel(user.lastOrderAt)}</p>
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
                                        <Link
                                            href={`/admin/users/${user._id}`}
                                            className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-bold text-stone-200"
                                        >
                                            View
                                        </Link>
                                        {user.phone && (
                                            <>
                                                <button
                                                    onClick={() => handleCopyPhone(user.phone, user._id)}
                                                    aria-label="Copy phone number"
                                                    className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-bold text-stone-300 hover:text-stone-100"
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

                </>
            )}
        </>
    );
}