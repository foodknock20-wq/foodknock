"use client";

export const dynamic = "force-dynamic";

// src/app/admin/loyalty/page.tsx
// Admin loyalty management panel.
// ─ Shows all users sorted by points balance (highest first)
// ─ Manual credit (admin_credit) and debit (admin_debit) with reason
// ─ Debit entries show as "expiring" / penalty style in the table
// ─ Balance refreshes inline after every action (no full reload)

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
    Star, Search, Plus, Minus, X, Loader2,
    ChevronLeft, ChevronRight, Users, TrendingUp,
    Sparkles, Gift, AlertTriangle, ArrowUpRight,
    ArrowDownRight, Clock, RefreshCw,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────
type UserRow = {
    id:                  string;
    name:                string;
    email:               string;
    phone:               string;
    loyaltyPoints:       number;
    referralCode:        string | null;
    deliveredOrderCount: number;
    joinedAt:            string;
};

type ActionType = "admin_credit" | "admin_debit";

type ModalState = {
    userId:  string;
    name:    string;
    balance: number;
    points:  string;
    type:    ActionType;
    note:    string;
    // Debit sub-type for display
    debitReason: "manual" | "expiry" | "correction";
};

// Predefined debit reasons
const DEBIT_REASONS: { value: ModalState["debitReason"]; label: string; icon: string; note: string }[] = [
    { value: "manual",     label: "Manual debit",       icon: "📋", note: "Manual admin adjustment" },
    { value: "expiry",     label: "Points expired",     icon: "⏰", note: "Points expired — unused after 90 days" },
    { value: "correction", label: "Correction / fraud", icon: "🚨", note: "Correction — incorrectly credited points" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function PointsBadge({ pts }: { pts: number }) {
    const color = pts >= 200 ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
                : pts >= 100  ? "text-orange-300 border-orange-500/30 bg-orange-500/10"
                : pts > 0     ? "text-stone-300 border-stone-500/20 bg-stone-500/8"
                              : "text-stone-600 border-stone-700/30 bg-stone-700/10";
    return (
        <div className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${color}`}>
            <Star size={10} className="fill-current" />
            <span className="font-mono text-[13px] font-black">{pts.toLocaleString("en-IN")}</span>
        </div>
    );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AdminLoyaltyPage() {
    const [users,      setUsers]      = useState<UserRow[]>([]);
    const [total,      setTotal]      = useState(0);
    const [page,       setPage]       = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search,     setSearch]     = useState("");
    const [loading,    setLoading]    = useState(true);

    const [modal,      setModal]      = useState<ModalState | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Tracks which user rows just had their balance updated (for flash animation)
    const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());

    // ── Fetch users ──────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async (p: number, q: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p) });
            if (q) params.set("search", q);
            const res  = await fetch(`/api/admin/loyalty?${params}`, { credentials: "include" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setUsers(data.users ?? []);
            setTotal(data.total ?? 0);
            setTotalPages(data.totalPages ?? 1);
        } catch (err: any) {
            toast.error(err.message ?? "Failed to load loyalty data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => fetchUsers(page, search), 300);
        return () => clearTimeout(t);
    }, [page, search, fetchUsers]);

    // ── Open modal ───────────────────────────────────────────────────────────
    const openModal = (user: UserRow, type: ActionType) => {
        setModal({
            userId:      user.id,
            name:        user.name,
            balance:     user.loyaltyPoints,
            points:      "",
            type,
            note:        "",
            debitReason: "manual",
        });
    };

    // ── Submit credit / debit ────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!modal) return;
        const pts = parseInt(modal.points);
        if (isNaN(pts) || pts <= 0) {
            toast.error("Enter a valid positive number of points");
            return;
        }
        if (modal.type === "admin_debit" && pts > modal.balance) {
            toast.error(`User only has ${modal.balance} pts — can't debit ${pts}`);
            return;
        }

        // Build final note from sub-reason if debit
        const finalNote = modal.type === "admin_debit"
            ? (DEBIT_REASONS.find((r) => r.value === modal.debitReason)?.note ?? modal.note)
              + (modal.note ? ` — ${modal.note}` : "")
            : modal.note || "Admin credit";

        setSubmitting(true);
        try {
            const res = await fetch("/api/admin/loyalty", {
                method:      "POST",
                headers:     { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    userId: modal.userId,
                    points: pts,
                    type:   modal.type,
                    note:   finalNote,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            toast.success(data.message, {
                style: {
                    background: modal.type === "admin_credit" ? "#ecfdf5" : "#fff1f2",
                    color:      modal.type === "admin_credit" ? "#065f46" : "#881337",
                    border:     `1px solid ${modal.type === "admin_credit" ? "#6ee7b7" : "#fda4af"}`,
                    borderRadius: "12px",
                },
            });

            // Update the row in-place so the table reflects the new balance immediately
            const newBalance = data.newBalance ?? 0;
            setUsers((prev) => prev.map((u) =>
                u.id === modal.userId ? { ...u, loyaltyPoints: newBalance } : u
            ));

            // Flash the updated row
            setUpdatedIds((s) => new Set(s).add(modal.userId));
            setTimeout(() => setUpdatedIds((s) => { const n = new Set(s); n.delete(modal.userId!); return n; }), 2000);

            setModal(null);
        } catch (err: any) {
            toast.error(err.message ?? "Failed to update points");
        } finally {
            setSubmitting(false);
        }
    };

    // ── Aggregates ───────────────────────────────────────────────────────────
    const totalPointsOnPage = users.reduce((s, u) => s + u.loyaltyPoints, 0);
    const avgBalanceOnPage  = users.length ? Math.round(totalPointsOnPage / users.length) : 0;

    return (
        <div className="space-y-6">

            {/* ════════════════════════════════════════════════════════════
                Modal
            ════════════════════════════════════════════════════════════ */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
                    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-[#16161f] shadow-2xl">

                        {/* Modal header */}
                        <div className={`flex items-center justify-between px-6 py-4 ${
                            modal.type === "admin_credit"
                                ? "bg-gradient-to-r from-emerald-900/40 to-emerald-800/20 border-b border-emerald-500/20"
                                : "bg-gradient-to-r from-rose-900/40 to-rose-800/20 border-b border-rose-500/20"
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                                    modal.type === "admin_credit" ? "bg-emerald-500/20" : "bg-rose-500/20"
                                }`}>
                                    {modal.type === "admin_credit"
                                        ? <ArrowUpRight size={16} className="text-emerald-400" />
                                        : <ArrowDownRight size={16} className="text-rose-400" />
                                    }
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white">
                                        {modal.type === "admin_credit" ? "Credit Points" : "Debit Points"}
                                    </h3>
                                    <p className="text-[11px] text-stone-500">
                                        for <span className="font-semibold text-stone-300">{modal.name}</span>
                                        {" · "}current balance:{" "}
                                        <span className={modal.type === "admin_credit" ? "text-amber-400" : "text-rose-400"}>
                                            {modal.balance} pts
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setModal(null)} className="text-stone-600 hover:text-stone-300 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-4 p-6">

                            {/* Debit reason selector */}
                            {modal.type === "admin_debit" && (
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-stone-500">
                                        Reason for Debit
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {DEBIT_REASONS.map((r) => {
                                            const active = modal.debitReason === r.value;
                                            return (
                                                <button
                                                    key={r.value}
                                                    type="button"
                                                    onClick={() => setModal((m) => m ? { ...m, debitReason: r.value } : null)}
                                                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all ${
                                                        active
                                                            ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                                                            : "border-white/[0.06] bg-white/[0.03] text-stone-500 hover:border-white/[0.12] hover:text-stone-400"
                                                    }`}
                                                >
                                                    <span className="text-lg">{r.icon}</span>
                                                    <span className="text-[10px] font-bold leading-tight">{r.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Points input */}
                            <div>
                                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-widest text-stone-500">
                                    Points *
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max={modal.type === "admin_debit" ? modal.balance : undefined}
                                        value={modal.points}
                                        onChange={(e) => setModal((m) => m ? { ...m, points: e.target.value } : null)}
                                        placeholder="e.g. 50"
                                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-sm text-stone-200 placeholder:text-stone-700 focus:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                                    />
                                    {modal.type === "admin_debit" && modal.points && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-stone-500">
                                            → {modal.balance - (parseInt(modal.points) || 0)} left
                                        </div>
                                    )}
                                </div>
                                {/* Quick select for credit */}
                                {modal.type === "admin_credit" && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {[10, 25, 50, 100, 200].map((n) => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => setModal((m) => m ? { ...m, points: String(n) } : null)}
                                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-all ${
                                                    modal.points === String(n)
                                                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                                                        : "border-white/[0.07] bg-white/[0.03] text-stone-500 hover:text-stone-300"
                                                }`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Additional note */}
                            <div>
                                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-widest text-stone-500">
                                    Additional Note <span className="font-normal normal-case tracking-normal text-stone-700">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={modal.note}
                                    onChange={(e) => setModal((m) => m ? { ...m, note: e.target.value } : null)}
                                    placeholder={
                                        modal.type === "admin_credit"
                                            ? "e.g. Apology credit for order delay"
                                            : "e.g. Customer request, order #12345"
                                    }
                                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-sm text-stone-200 placeholder:text-stone-700 focus:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                                />
                            </div>

                            {/* Debit warning */}
                            {modal.type === "admin_debit" && modal.points && parseInt(modal.points) > 0 && (
                                <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3">
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-400" />
                                    <p className="text-[11px] leading-relaxed text-rose-300">
                                        This will deduct <strong>{modal.points} pts</strong> from {modal.name}'s balance.
                                        This action is logged in the ledger and cannot be undone.
                                    </p>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => setModal(null)}
                                    disabled={submitting}
                                    className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.04] py-2.5 text-sm font-medium text-stone-300 transition-colors hover:bg-white/[0.07] disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || !modal.points || parseInt(modal.points) <= 0}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                        modal.type === "admin_credit"
                                            ? "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-900/40"
                                            : "bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-900/40"
                                    }`}
                                >
                                    {submitting
                                        ? <Loader2 size={14} className="animate-spin" />
                                        : modal.type === "admin_credit"
                                            ? <><Plus size={14} strokeWidth={3} /> Credit Points</>
                                            : <><Minus size={14} strokeWidth={3} /> Debit Points</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                Page header
            ════════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                        <Star size={11} className="text-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Loyalty</span>
                    </div>
                    <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">Loyalty Management</h1>
                    <p className="mt-1 text-sm text-stone-600">
                        Balances, transaction history, manual credits & debits.
                    </p>
                </div>
                <button
                    onClick={() => fetchUsers(page, search)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-stone-400 transition-colors hover:text-white"
                >
                    <RefreshCw size={13} />
                    Refresh
                </button>
            </div>

            {/* ── Summary strip ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                    {
                        label: "Total Users",
                        value: total.toLocaleString("en-IN"),
                        icon: <Users size={14} className="text-amber-400" />,
                        sub: "on this page",
                    },
                    {
                        label: "Points in Circulation",
                        value: totalPointsOnPage.toLocaleString("en-IN"),
                        icon: <Star size={14} className="text-amber-400" />,
                        sub: `≈ ₹${(totalPointsOnPage * 0.5).toFixed(0)} value`,
                    },
                    {
                        label: "Avg. Balance",
                        value: avgBalanceOnPage.toLocaleString("en-IN"),
                        icon: <TrendingUp size={14} className="text-amber-400" />,
                        sub: "per user this page",
                    },
                ].map(({ label, value, icon, sub }) => (
                    <div key={label} className="rounded-2xl border border-white/[0.06] bg-[#111118] px-4 py-4">
                        <div className="mb-1 flex items-center gap-1.5">
                            {icon}
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-600">{label}</p>
                        </div>
                        <p className="font-serif text-2xl font-black text-white">{value}</p>
                        <p className="mt-0.5 text-[11px] text-stone-600">{sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Search ── */}
            <div className="relative max-w-sm">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-600" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search by name, email or phone…"
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-stone-300 placeholder:text-stone-700 focus:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                />
            </div>

            {/* ── Table ── */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111118]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20">
                        <Loader2 size={24} className="animate-spin text-amber-400" />
                        <p className="text-sm text-stone-600">Loading loyalty data…</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                            <Users size={20} className="text-stone-700" />
                        </div>
                        <p className="text-sm font-semibold text-stone-600">No users found</p>
                        {search && <p className="text-[12px] text-stone-700">Try a different search term</p>}
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                        {["Customer", "Balance", "Referral Code", "Delivered Orders", "Joined", "Actions"].map((h) => (
                                            <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-stone-600">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {users.map((user) => {
                                        const isUpdated = updatedIds.has(user.id);
                                        return (
                                            <tr
                                                key={user.id}
                                                className={`transition-all hover:bg-white/[0.02] ${isUpdated ? "bg-amber-500/8" : ""}`}
                                            >
                                                <td className="px-4 py-3.5">
                                                    <p className="font-semibold text-stone-200">{user.name}</p>
                                                    <p className="text-[11px] text-stone-600">{user.email}</p>
                                                    {user.phone && <p className="text-[10px] text-stone-700">{user.phone}</p>}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <PointsBadge pts={user.loyaltyPoints} />
                                                    <p className="mt-0.5 text-[10px] text-stone-600">
                                                        ≈ ₹{(user.loyaltyPoints * 0.5).toFixed(0)}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {user.referralCode ? (
                                                        <span className="rounded-full border border-amber-500/20 bg-amber-500/8 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-400">
                                                            {user.referralCode}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-stone-700">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="font-bold text-stone-300">
                                                        {user.deliveredOrderCount}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-1 text-[11px] text-stone-600">
                                                        <Clock size={10} />
                                                        {fmtDate(user.joinedAt)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        {/* Credit */}
                                                        <button
                                                            onClick={() => openModal(user, "admin_credit")}
                                                            className="group flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1.5 text-[11px] font-black text-emerald-400 transition-all hover:bg-emerald-500/20"
                                                            title="Credit points"
                                                        >
                                                            <Plus size={11} strokeWidth={3} />
                                                            Credit
                                                        </button>
                                                        {/* Debit */}
                                                        <button
                                                            onClick={() => openModal(user, "admin_debit")}
                                                            disabled={user.loyaltyPoints === 0}
                                                            className="group flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/8 px-2.5 py-1.5 text-[11px] font-black text-rose-400 transition-all hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                                                            title="Debit points"
                                                        >
                                                            <Minus size={11} strokeWidth={3} />
                                                            Debit
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="divide-y divide-white/[0.04] md:hidden">
                            {users.map((user) => {
                                const isUpdated = updatedIds.has(user.id);
                                return (
                                    <div
                                        key={user.id}
                                        className={`px-4 py-4 transition-colors ${isUpdated ? "bg-amber-500/8" : ""}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-white">{user.name}</p>
                                                <p className="truncate text-[11px] text-stone-500">{user.email}</p>
                                            </div>
                                            <div className="shrink-0">
                                                <PointsBadge pts={user.loyaltyPoints} />
                                                <p className="mt-0.5 text-right text-[10px] text-stone-600">
                                                    ≈ ₹{(user.loyaltyPoints * 0.5).toFixed(0)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                                                <span>{user.deliveredOrderCount} orders</span>
                                                {user.referralCode && (
                                                    <span className="font-mono font-bold text-amber-400">{user.referralCode}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openModal(user, "admin_credit")}
                                                    className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1.5 text-[11px] font-black text-emerald-400"
                                                >
                                                    <Plus size={10} strokeWidth={3} /> Credit
                                                </button>
                                                <button
                                                    onClick={() => openModal(user, "admin_debit")}
                                                    disabled={user.loyaltyPoints === 0}
                                                    className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/8 px-2.5 py-1.5 text-[11px] font-black text-rose-400 disabled:opacity-30"
                                                >
                                                    <Minus size={10} strokeWidth={3} /> Debit
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-[11px] text-stone-600">
                        Page {page} of {totalPages} · {total} total users
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-stone-400 transition-colors disabled:opacity-40 hover:text-white"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        {/* Page number pills */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition-colors ${
                                        p === page
                                            ? "border border-amber-500/30 bg-amber-500/15 text-amber-400"
                                            : "border border-white/[0.07] bg-white/[0.03] text-stone-500 hover:text-white"
                                    }`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-stone-400 transition-colors disabled:opacity-40 hover:text-white"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Legend ── */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-700">Balance tiers</p>
                {[
                    { label: "200+ pts", color: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
                    { label: "100–199 pts", color: "text-orange-300 bg-orange-500/10 border-orange-500/30" },
                    { label: "1–99 pts",  color: "text-stone-300 bg-stone-500/8 border-stone-500/20" },
                    { label: "0 pts",     color: "text-stone-600 bg-stone-700/10 border-stone-700/30" },
                ].map(({ label, color }) => (
                    <div key={label} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${color}`}>
                        <Star size={9} className="fill-current" />
                        {label}
                    </div>
                ))}
            </div>

        </div>
    );
}