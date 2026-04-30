"use client";

export const dynamic = "force-dynamic";

// src/app/admin/loyalty/page.tsx
// Premium Loyalty Control Dashboard — FoodKnock
// PRODUCTION REWRITE:
//   - AbortController on every fetch (no stale response overwrites)
//   - True global analytics from backend (not current-page slice)
//   - All timeout refs tracked and cleaned up on unmount
//   - updatedIds timer uses ref, not bare setTimeout
//   - Race-condition-free search debounce

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "react-hot-toast";
import {
    Star, Search, Plus, Minus, X, Loader2,
    ChevronLeft, ChevronRight, Users, TrendingUp,
    Gift, AlertTriangle, ArrowUpRight, ArrowDownRight,
    Clock, RefreshCw, SlidersHorizontal, Wallet,
    Crown, Zap, Activity, BarChart2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRow = {
    id: string;
    name: string;
    email: string;
    phone: string;
    loyaltyPoints: number;
    referralCode: string | null;
    deliveredOrderCount: number;
    joinedAt: string;
};

type TxRow = {
    id: string;
    userName: string;
    points: number;
    type: "admin_credit" | "admin_debit" | "earned" | "redeemed";
    note: string;
    createdAt: string;
};

// Global analytics represent ALL users in DB — not just current page.
// Backend must return this in the GET response (see note in fetchAll).
type GlobalAnalytics = {
    totalUsers: number;
    totalPoints: number;
    users100plus: number;
    usersZero: number;
    avgBalance: number;
    liabilityINR: number;
};

type ActionType = "admin_credit" | "admin_debit";
type LoyaltySortKey = "highest" | "lowest" | "most_orders" | "referral_only" | "zero_balance" | "newest";

type ModalState = {
    userId: string;
    name: string;
    balance: number;
    points: string;
    type: ActionType;
    note: string;
    debitReason: "manual" | "expiry" | "correction";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEBIT_REASONS: {
    value: ModalState["debitReason"];
    label: string;
    icon: string;
    note: string;
}[] = [
        { value: "manual", label: "Manual debit", icon: "📋", note: "Manual admin adjustment" },
        { value: "expiry", label: "Points expired", icon: "⏰", note: "Points expired — unused after 90 days" },
        { value: "correction", label: "Correction / fraud", icon: "🚨", note: "Correction — incorrectly credited points" },
    ];

const SORT_OPTIONS: { key: LoyaltySortKey; label: string }[] = [
    { key: "highest", label: "Highest Balance" },
    { key: "lowest", label: "Lowest Balance" },
    { key: "most_orders", label: "Most Orders" },
    { key: "referral_only", label: "Referral Users" },
    { key: "zero_balance", label: "Zero Balance" },
    { key: "newest", label: "Recently Joined" },
];

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
}
function fmtTime(iso: string) {
    return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
}

function tierOf(pts: number): { label: string; color: string; dot: string } {
    if (pts >= 200) return { label: "VIP", color: "text-yellow-300 border-yellow-500/30 bg-yellow-500/10", dot: "bg-yellow-400" };
    if (pts >= 100) return { label: "Active", color: "text-amber-300 border-amber-500/25 bg-amber-500/10", dot: "bg-amber-400" };
    if (pts > 0) return { label: "Low", color: "text-stone-400 border-stone-600/30 bg-stone-700/20", dot: "bg-stone-500" };
    return { label: "Zero", color: "text-stone-600 border-stone-700/20 bg-stone-800/20", dot: "bg-stone-700" };
}

function PointsBadge({ pts }: { pts: number }) {
    const tier = tierOf(pts);
    return (
        <div className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${tier.color}`}>
            <Star size={9} className="fill-current" />
            <span className="font-mono text-[12px] font-black">{pts.toLocaleString("en-IN")}</span>
        </div>
    );
}

function TierBadge({ pts }: { pts: number }) {
    const tier = tierOf(pts);
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${tier.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
            {tier.label}
        </span>
    );
}

// ── Fallback analytics (zeros) while data loads ───────────────────────────────

const EMPTY_ANALYTICS: GlobalAnalytics = {
    totalUsers: 0,
    totalPoints: 0,
    users100plus: 0,
    usersZero: 0,
    avgBalance: 0,
    liabilityINR: 0,
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminLoyaltyPage() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [transactions, setTransactions] = useState<TxRow[]>([]);
    const [globalStats, setGlobalStats] = useState<GlobalAnalytics>(EMPTY_ANALYTICS);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<LoyaltySortKey>("highest");
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<ModalState | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());

    // ── Ref-tracked timers and abort controllers ──────────────────────────
    //
    // abortRef:      holds the AbortController for the in-flight users fetch.
    //                Cancelled before every new fetch so stale responses never
    //                overwrite fresher data.
    //
    // debounceRef:   holds the search debounce timer. Cleared on each keystroke
    //                and on unmount.
    //
    // updatedTimers: Map of userId → timer handle. Each timer removes the id
    //                from the updatedIds set. Cleaned up on unmount so no
    //                setState is called after the component is gone.

    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const updatedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // ── Global cleanup on unmount ─────────────────────────────────────────
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            if (debounceRef.current !== null) clearTimeout(debounceRef.current);
            updatedTimers.current.forEach((t) => clearTimeout(t));
            updatedTimers.current.clear();
        };
    }, []);

    // ── Core fetch ────────────────────────────────────────────────────────
    //
    // IMPORTANT: the backend GET /api/admin/loyalty must return a `analytics`
    // object with TRUE GLOBAL counts (not filtered/paginated). If your current
    // backend doesn't return it, the UI gracefully falls back to the
    // current-page approximation. Add it to the backend response like:
    //
    //   analytics: {
    //     totalUsers, totalPoints, users100plus,
    //     usersZero, avgBalance, liabilityINR
    //   }
    //
    // This is a read-only aggregation so it adds minimal DB load.

    const fetchAll = useCallback(async (p: number, q: string, signal: AbortSignal) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p) });
            if (q) params.set("search", q);

            const [usersRes, txRes] = await Promise.all([
                fetch(`/api/admin/loyalty?${params}`, {
                    credentials: "include",
                    signal,
                }),
                fetch(`/api/admin/loyalty/transactions?limit=20`, {
                    credentials: "include",
                    signal,
                }).catch(() => null), // transactions panel is non-critical
            ]);

            // If aborted mid-flight, the error below is caught as AbortError
            const usersData = await usersRes.json();
            if (!usersRes.ok) throw new Error(usersData.message ?? "Failed to load");

            setUsers(usersData.users ?? []);
            setTotal(usersData.total ?? 0);
            setTotalPages(usersData.totalPages ?? 1);

            // ── True global analytics ──────────────────────────────────────
            // Prefer backend-supplied global stats. Fall back to current-page
            // approximation only if backend hasn't been updated yet.
            if (usersData.analytics) {
                setGlobalStats(usersData.analytics as GlobalAnalytics);
            } else {
                // Degraded fallback: page-scoped approximation
                // (labelled so the engineer knows to fix the backend)
                const pageUsers: UserRow[] = usersData.users ?? [];
                const totalPts = pageUsers.reduce((s: number, u: UserRow) => s + u.loyaltyPoints, 0);
                const users100plus = pageUsers.filter((u: UserRow) => u.loyaltyPoints >= 100).length;
                const usersZero = pageUsers.filter((u: UserRow) => u.loyaltyPoints === 0).length;
                const avgBalance = pageUsers.length ? Math.round(totalPts / pageUsers.length) : 0;
                setGlobalStats({
                    totalUsers: usersData.total ?? pageUsers.length,
                    totalPoints: totalPts,
                    users100plus,
                    usersZero,
                    avgBalance,
                    liabilityINR: Math.round(totalPts * 0.5),
                });
            }

            if (txRes?.ok) {
                const txData = await txRes.json();
                if (Array.isArray(txData.transactions)) {
                    setTransactions(txData.transactions);
                }
            }
        } catch (err: unknown) {
            // AbortError is expected when a newer fetch cancels this one — not an error
            if (err instanceof Error && err.name === "AbortError") return;
            toast.error(err instanceof Error ? err.message : "Failed to load loyalty data");
        } finally {
            // Only clear loading if this request wasn't aborted
            if (!signal.aborted) setLoading(false);
        }
    }, []); // stable — no external deps

    // ── Trigger fetch with debounce + abort-on-supersede ─────────────────
    useEffect(() => {
        // Clear any pending debounce timer
        if (debounceRef.current !== null) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            debounceRef.current = null;

            // Abort previous in-flight request
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            fetchAll(page, search, controller.signal);
        }, 300);
    }, [page, search, fetchAll]);

    // ── Client-side sort (no re-fetch needed) ─────────────────────────────
    const sortedUsers = useMemo<UserRow[]>(() => {
        const list = [...users];
        switch (sortKey) {
            case "highest": return list.sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);
            case "lowest": return list.sort((a, b) => a.loyaltyPoints - b.loyaltyPoints);
            case "most_orders": return list.sort((a, b) => b.deliveredOrderCount - a.deliveredOrderCount);
            case "referral_only": return list.filter((u) => !!u.referralCode).sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);
            case "zero_balance": return list.filter((u) => u.loyaltyPoints === 0);
            case "newest": return list.sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
            default: return list;
        }
    }, [users, sortKey]);

    // ── Modal ─────────────────────────────────────────────────────────────

    const openModal = useCallback((user: UserRow, type: ActionType) => {
        setModal({
            userId: user.id,
            name: user.name,
            balance: user.loyaltyPoints,
            points: "",
            type,
            note: "",
            debitReason: "manual",
        });
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!modal) return;
        const pts = parseInt(modal.points, 10);
        if (isNaN(pts) || pts <= 0) { toast.error("Enter a valid positive number"); return; }
        if (modal.type === "admin_debit" && pts > modal.balance) {
            toast.error(`User only has ${modal.balance} pts — can't debit ${pts}`);
            return;
        }

        const reasonNote = DEBIT_REASONS.find((r) => r.value === modal.debitReason)?.note ?? "";
        const finalNote = modal.type === "admin_debit"
            ? `${reasonNote}${modal.note ? ` — ${modal.note}` : ""}`
            : modal.note || "Admin credit";

        setSubmitting(true);
        try {
            const res = await fetch("/api/admin/loyalty", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    userId: modal.userId,
                    points: pts,
                    type: modal.type,
                    note: finalNote,
                }),
            });
            const data: { message?: string; newBalance?: number } = await res.json();
            if (!res.ok) throw new Error(data.message ?? "Failed to update");

            toast.success(data.message ?? "Done", {
                style: {
                    background: modal.type === "admin_credit" ? "#ecfdf5" : "#fff1f2",
                    color: modal.type === "admin_credit" ? "#065f46" : "#881337",
                    border: `1px solid ${modal.type === "admin_credit" ? "#6ee7b7" : "#fda4af"}`,
                    borderRadius: "12px",
                },
            });

            const newBalance = data.newBalance ?? 0;
            const userId = modal.userId; // capture before clearing modal

            setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, loyaltyPoints: newBalance } : u))
            );

            // Highlight updated row, then clean up the timer ref
            setUpdatedIds((s) => new Set(s).add(userId));
            // Clear any existing timer for this user before setting a new one
            const existingTimer = updatedTimers.current.get(userId);
            if (existingTimer !== undefined) clearTimeout(existingTimer);
            const t = setTimeout(() => {
                setUpdatedIds((s) => { const n = new Set(s); n.delete(userId); return n; });
                updatedTimers.current.delete(userId);
            }, 2500);
            updatedTimers.current.set(userId, t);

            // Prepend synthetic transaction record
            const newTx: TxRow = {
                id: `${Date.now()}-${userId}`,
                userName: modal.name,
                points: pts,
                type: modal.type,
                note: finalNote,
                createdAt: new Date().toISOString(),
            };
            setTransactions((prev) => [newTx, ...prev.slice(0, 19)]);

            // Also update global stats optimistically
            setGlobalStats((prev) => {
                const delta = modal.type === "admin_credit" ? pts : -pts;
                const newTotal = prev.totalPoints + delta;
                const newAvg = prev.totalUsers > 0
                    ? Math.round(newTotal / prev.totalUsers)
                    : 0;
                return {
                    ...prev,
                    totalPoints: newTotal,
                    avgBalance: newAvg,
                    liabilityINR: Math.round(newTotal * 0.5),
                };
            });

            setModal(null);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to update points");
        } finally {
            setSubmitting(false);
        }
    }, [modal]);

    // ── Manual refresh (replaces stale fetch) ─────────────────────────────
    const handleRefresh = useCallback(() => {
        if (debounceRef.current !== null) clearTimeout(debounceRef.current);
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        fetchAll(page, search, controller.signal);
    }, [page, search, fetchAll]);

    // ─── Render ───────────────────────────────────────────────────────────

    return (
        <div className="space-y-6 pb-8">

            {/* ══════════════════════════════════════════════════════════════
                MODAL
            ══════════════════════════════════════════════════════════════ */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center">
                    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-[#13131e] shadow-2xl">
                        {/* Header */}
                        <div className={`flex items-center justify-between px-6 py-4 border-b ${modal.type === "admin_credit"
                                ? "bg-gradient-to-r from-emerald-950/60 to-emerald-900/20 border-emerald-500/20"
                                : "bg-gradient-to-r from-rose-950/60 to-rose-900/20 border-rose-500/20"
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${modal.type === "admin_credit" ? "bg-emerald-500/20" : "bg-rose-500/20"
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
                                        <span className="font-semibold text-stone-300">{modal.name}</span>
                                        {" · "}
                                        <span className={modal.type === "admin_credit" ? "text-amber-400" : "text-rose-400"}>
                                            {modal.balance} pts current
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModal(null)}
                                aria-label="Close modal"
                                className="text-stone-600 hover:text-stone-300 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-4 p-6">
                            {/* Debit reason */}
                            {modal.type === "admin_debit" && (
                                <div>
                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-stone-600">
                                        Debit Reason
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {DEBIT_REASONS.map((r) => (
                                            <button
                                                key={r.value}
                                                type="button"
                                                onClick={() => setModal((m) => m ? { ...m, debitReason: r.value } : null)}
                                                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all ${modal.debitReason === r.value
                                                        ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                                                        : "border-white/[0.06] bg-white/[0.03] text-stone-500 hover:border-white/[0.12]"
                                                    }`}
                                            >
                                                <span className="text-lg">{r.icon}</span>
                                                <span className="text-[10px] font-bold leading-tight">{r.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Points input */}
                            <div>
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-stone-600">
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
                                            → {modal.balance - (parseInt(modal.points, 10) || 0)} left
                                        </div>
                                    )}
                                </div>
                                {modal.type === "admin_credit" && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {[10, 25, 50, 100, 200].map((n) => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => setModal((m) => m ? { ...m, points: String(n) } : null)}
                                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-all ${modal.points === String(n)
                                                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                                                        : "border-white/[0.07] bg-white/[0.03] text-stone-600 hover:text-stone-300"
                                                    }`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Note */}
                            <div>
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-stone-600">
                                    Note{" "}
                                    <span className="font-normal normal-case tracking-normal text-stone-700">
                                        (optional)
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    value={modal.note}
                                    onChange={(e) => setModal((m) => m ? { ...m, note: e.target.value } : null)}
                                    placeholder={
                                        modal.type === "admin_credit"
                                            ? "e.g. Apology for delay"
                                            : "e.g. Customer request"
                                    }
                                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-sm text-stone-200 placeholder:text-stone-700 focus:border-amber-500/40 focus:outline-none"
                                />
                            </div>

                            {/* Warning banner */}
                            {modal.type === "admin_debit" &&
                                modal.points &&
                                parseInt(modal.points, 10) > 0 && (
                                    <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3">
                                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-rose-400" />
                                        <p className="text-[11px] leading-relaxed text-rose-300/80">
                                            This deducts{" "}
                                            <strong className="text-rose-300">{modal.points} pts</strong>{" "}
                                            from {modal.name}. This action is permanent and logged.
                                        </p>
                                    </div>
                                )}

                            {/* Buttons */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => setModal(null)}
                                    disabled={submitting}
                                    className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.04] py-2.5 text-sm font-bold text-stone-400 transition-colors hover:bg-white/[0.07] disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || !modal.points || parseInt(modal.points, 10) <= 0}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black text-white transition-all disabled:opacity-50 ${modal.type === "admin_credit"
                                            ? "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-900/40"
                                            : "bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-900/40"
                                        }`}
                                >
                                    {submitting ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : modal.type === "admin_credit" ? (
                                        <><Plus size={14} strokeWidth={3} /> Credit</>
                                    ) : (
                                        <><Minus size={14} strokeWidth={3} /> Debit</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                PAGE HEADER
            ══════════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                        <Star size={11} className="text-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                            Loyalty Control
                        </span>
                    </div>
                    <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">
                        Loyalty Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-stone-600">
                        Manage points, track balances, and control customer rewards.
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2 text-sm font-bold text-stone-400 transition-colors hover:text-white disabled:opacity-50"
                >
                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                GLOBAL ANALYTICS STRIP
                Values come from backend global aggregation — NOT current page.
            ══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {(
                    [
                        { label: "Total Users", value: globalStats.totalUsers.toLocaleString("en-IN"), icon: Users, color: "text-white" },
                        { label: "Points in Circ.", value: globalStats.totalPoints.toLocaleString("en-IN"), icon: Star, color: "text-amber-400" },
                        { label: "100+ Pts Users", value: globalStats.users100plus, icon: Crown, color: "text-yellow-300" },
                        { label: "Zero Balance", value: globalStats.usersZero, icon: Activity, color: "text-stone-500" },
                        { label: "Avg Balance", value: globalStats.avgBalance.toLocaleString("en-IN"), icon: BarChart2, color: "text-sky-400" },
                        { label: "Discount Liability", value: `₹${globalStats.liabilityINR.toLocaleString("en-IN")}`, icon: Wallet, color: "text-rose-400" },
                    ] as const
                ).map(({ label, value, icon: Icon, color }) => (
                    <div
                        key={label}
                        className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14] px-4 py-3.5"
                    >
                        <div className="mb-1 flex items-center gap-1.5">
                            <Icon size={11} className={color} />
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-stone-700">{label}</p>
                        </div>
                        <p className={`font-mono text-xl font-black ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                MAIN CONTENT: TABLE + TRANSACTIONS SIDE
            ══════════════════════════════════════════════════════════════ */}
            <div className="grid gap-5 lg:grid-cols-3">

                {/* ── Left: users table (2/3 width) ─────────────────────── */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Controls */}
                    <div className="space-y-3">
                        <div className="relative max-w-sm">
                            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-600" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                placeholder="Search name, email or phone…"
                                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-stone-300 placeholder:text-stone-700 focus:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal size={11} className="shrink-0 text-stone-600" />
                            <div className="flex flex-wrap gap-1.5">
                                {SORT_OPTIONS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        onClick={() => setSortKey(key)}
                                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all ${sortKey === key
                                                ? "border border-amber-500/35 bg-amber-500/15 text-amber-400"
                                                : "border border-white/[0.06] bg-white/[0.02] text-stone-600 hover:text-stone-400"
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Users table / cards */}
                    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-20">
                                <Loader2 size={24} className="animate-spin text-amber-400" />
                                <p className="text-sm text-stone-600">Loading loyalty data…</p>
                            </div>
                        ) : sortedUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16">
                                <Users size={22} className="text-stone-700" />
                                <p className="text-sm font-bold text-stone-600">No users found</p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop */}
                                <div className="hidden overflow-x-auto md:block">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-white/[0.05] bg-white/[0.015]">
                                                {["Customer", "Balance", "Tier", "Ref Code", "Orders", "Joined", "Actions"].map((h) => (
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
                                            {sortedUsers.map((user) => (
                                                <tr
                                                    key={user.id}
                                                    className={`transition-all hover:bg-white/[0.025] ${updatedIds.has(user.id) ? "bg-amber-500/8" : ""
                                                        }`}
                                                >
                                                    <td className="px-4 py-3.5">
                                                        <p className="font-bold text-stone-200">{user.name}</p>
                                                        <p className="text-[10px] text-stone-600">{user.email}</p>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <PointsBadge pts={user.loyaltyPoints} />
                                                        <p className="mt-0.5 text-[10px] text-stone-700">
                                                            ≈ ₹{(user.loyaltyPoints * 0.5).toFixed(0)}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <TierBadge pts={user.loyaltyPoints} />
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
                                                        <span className="text-[11px] text-stone-600">
                                                            {fmtDate(user.joinedAt)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => openModal(user, "admin_credit")}
                                                                className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1.5 text-[10px] font-black text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                                            >
                                                                <Plus size={10} strokeWidth={3} /> Credit
                                                            </button>
                                                            <button
                                                                onClick={() => openModal(user, "admin_debit")}
                                                                disabled={user.loyaltyPoints === 0}
                                                                className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/8 px-2.5 py-1.5 text-[10px] font-black text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                            >
                                                                <Minus size={10} strokeWidth={3} /> Debit
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile cards */}
                                <div className="divide-y divide-white/[0.04] md:hidden">
                                    {sortedUsers.map((user) => (
                                        <div
                                            key={user.id}
                                            className={`px-4 py-4 transition-colors ${updatedIds.has(user.id) ? "bg-amber-500/8" : ""
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <p className="font-bold text-white">{user.name}</p>
                                                        <TierBadge pts={user.loyaltyPoints} />
                                                    </div>
                                                    <p className="truncate text-[11px] text-stone-600">{user.email}</p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <PointsBadge pts={user.loyaltyPoints} />
                                                    <p className="mt-0.5 text-[10px] text-stone-700">
                                                        ≈ ₹{(user.loyaltyPoints * 0.5).toFixed(0)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between">
                                                <div className="flex items-center gap-3 text-[10px] text-stone-600">
                                                    <span>{user.deliveredOrderCount} orders</span>
                                                    {user.referralCode && (
                                                        <span className="font-mono font-bold text-amber-400">
                                                            {user.referralCode}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={() => openModal(user, "admin_credit")}
                                                        className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1.5 text-[10px] font-black text-emerald-400"
                                                    >
                                                        <Plus size={9} strokeWidth={3} /> Credit
                                                    </button>
                                                    <button
                                                        onClick={() => openModal(user, "admin_debit")}
                                                        disabled={user.loyaltyPoints === 0}
                                                        className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/8 px-2.5 py-1.5 text-[10px] font-black text-rose-400 disabled:opacity-30"
                                                    >
                                                        <Minus size={9} strokeWidth={3} /> Debit
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] text-stone-600">
                                Page {page} of {totalPages} · {total} users
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    aria-label="Previous page"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-stone-400 disabled:opacity-40 hover:text-white transition-colors"
                                >
                                    <ChevronLeft size={13} />
                                </button>
                                {Array.from(
                                    { length: Math.min(5, totalPages) },
                                    (_, i) => Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                                ).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        aria-label={`Page ${p}`}
                                        aria-current={p === page ? "page" : undefined}
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition-colors ${p === page
                                                ? "border border-amber-500/30 bg-amber-500/15 text-amber-400"
                                                : "border border-white/[0.07] bg-white/[0.03] text-stone-500 hover:text-white"
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    aria-label="Next page"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-stone-400 disabled:opacity-40 hover:text-white transition-colors"
                                >
                                    <ChevronRight size={13} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right: Recent transactions panel ─────────────────── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Activity size={11} className="text-stone-600" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-600">
                            Recent Adjustments
                        </h3>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14]">
                        {transactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                <Gift size={20} className="text-stone-700" strokeWidth={1.5} />
                                <p className="text-xs text-stone-700">No recent adjustments</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/[0.04]">
                                {transactions.map((tx) => {
                                    const isCredit = tx.type === "admin_credit" || tx.type === "earned";
                                    return (
                                        <div key={tx.id} className="px-4 py-3.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2.5 min-w-0">
                                                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${isCredit ? "bg-emerald-500/15" : "bg-rose-500/15"
                                                        }`}>
                                                        {isCredit
                                                            ? <ArrowUpRight size={11} className="text-emerald-400" />
                                                            : <ArrowDownRight size={11} className="text-rose-400" />
                                                        }
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-[12px] font-bold text-stone-300">
                                                            {tx.userName}
                                                        </p>
                                                        <p className="truncate text-[10px] text-stone-700">{tx.note}</p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className={`font-mono text-[13px] font-black ${isCredit ? "text-emerald-400" : "text-rose-400"
                                                        }`}>
                                                        {isCredit ? "+" : "−"}{tx.points}
                                                    </p>
                                                    <p className="text-[9px] text-stone-700">{fmtTime(tx.createdAt)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Tier legend */}
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                        <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-stone-700">
                            Balance Tiers
                        </p>
                        <div className="space-y-1.5">
                            {[
                                { label: "VIP", range: "200+ pts", color: "text-yellow-300 border-yellow-500/30 bg-yellow-500/10" },
                                { label: "Active", range: "100–199 pts", color: "text-amber-300 border-amber-500/25 bg-amber-500/10" },
                                { label: "Low", range: "1–99 pts", color: "text-stone-400 border-stone-600/30 bg-stone-700/20" },
                                { label: "Zero", range: "0 pts", color: "text-stone-600 border-stone-700/20 bg-stone-800/20" },
                            ].map(({ label, range, color }) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${color}`}>
                                        <Star size={8} className="fill-current" />{label}
                                    </span>
                                    <span className="text-[10px] text-stone-700">{range}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}