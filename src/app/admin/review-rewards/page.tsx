
"use client";
export const dynamic = "force-dynamic";

// src/app/admin/review-rewards/page.tsx
// Admin panel — Instagram Review Reward moderation
// Dark theme, matches existing admin aesthetic

import { useEffect, useState, useCallback } from "react";
import {
    Instagram, CheckCircle2, XCircle, Clock, ExternalLink,
    Loader2, RefreshCw, Gift, Trash2,
} from "lucide-react";

type Submission = {
    _id:           string;
    user:          { id: string; name: string; email: string; phone: string };
    instagramLink: string;
    status:        "pending" | "approved" | "rejected";
    rewardItem:    "burger" | "pizza";
    rewardUsed:    boolean;
    adminNote:     string;
    createdAt:     string;
    updatedAt:     string;
};

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Submission["status"] }) {
    const map = {
        pending:  "border-amber-500/20 bg-amber-500/10 text-amber-400",
        approved: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        rejected: "border-rose-500/20 bg-rose-500/10 text-rose-400",
    };
    return (
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status]}`}>
            {status}
        </span>
    );
}

// ─── Approve / Reject buttons ─────────────────────────────────────────────────
function ActionBtn({
    id, currentStatus, rewardItem, onDone,
}: {
    id: string; currentStatus: string; rewardItem: string;
    onDone: (id: string, newStatus: string, newRewardItem: string) => void;
}) {
    const [loading,    setLoading]    = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [note,       setNote]       = useState("");
    const [item,       setItem]       = useState<"burger" | "pizza">(rewardItem as "burger" | "pizza");

    if (currentStatus !== "pending") {
        return <span className="text-[11px] text-stone-600">—</span>;
    }

    const act = async (action: "approve" | "reject") => {
        setLoading(true);
        try {
            const res  = await fetch("/api/admin/review-rewards/approve", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ id, action, adminNote: note, rewardItem: item }),
            });
            const data = await res.json();
            if (data.success) onDone(id, action === "approve" ? "approved" : "rejected", item);
        } catch {}
        setLoading(false);
        setShowReject(false);
    };

    if (showReject) return (
        <div className="flex flex-col gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
            <textarea
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Reason for rejection (optional)"
                className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[11px] text-stone-300 placeholder:text-stone-600 focus:outline-none"
            />
            <div className="flex gap-2">
                <button onClick={() => act("reject")} disabled={loading}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 py-1.5 text-[11px] font-bold text-rose-400 transition-all hover:bg-rose-500/25 disabled:opacity-50">
                    {loading ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />} Confirm Reject
                </button>
                <button onClick={() => setShowReject(false)}
                    className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-stone-500 hover:text-stone-300">
                    Cancel
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-2">
            {/* Reward item selector */}
            <div className="flex gap-1.5">
                {(["burger", "pizza"] as const).map(v => (
                    <button key={v} onClick={() => setItem(v)}
                        className={`flex-1 rounded-lg border py-1 text-[10px] font-bold uppercase transition-all ${item === v ? "border-amber-500/40 bg-amber-500/15 text-amber-400" : "border-white/[0.06] text-stone-600 hover:text-stone-400"}`}>
                        {v === "burger" ? "🍔" : "🍕"} {v}
                    </button>
                ))}
            </div>
            <div className="flex gap-1.5">
                <button onClick={() => act("approve")} disabled={loading}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-bold text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-50">
                    {loading ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Approve
                </button>
                <button onClick={() => setShowReject(true)} disabled={loading}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 py-1.5 text-[11px] font-bold text-rose-400 transition-all hover:bg-rose-500/20 disabled:opacity-50">
                    <XCircle size={11} /> Reject
                </button>
            </div>
        </div>
    );
}

// ─── Delete button ────────────────────────────────────────────────────────────
function DeleteBtn({ id, onDeleted }: { id: string; onDeleted: (id: string) => void }) {
    const [confirm,  setConfirm]  = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res  = await fetch("/api/admin/review-rewards/delete", {
                method:  "DELETE",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ id }),
            });
            const data = await res.json();
            if (data.success) onDeleted(id);
        } catch {}
        setDeleting(false);
        setConfirm(false);
    };

    if (confirm) return (
        <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-stone-500">Sure?</span>
            <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold text-rose-400 transition-all hover:bg-rose-500/25 disabled:opacity-50"
            >
                {deleting ? <Loader2 size={10} className="animate-spin" /> : "Yes, Delete"}
            </button>
            <button
                onClick={() => setConfirm(false)}
                className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[10px] text-stone-600 hover:text-stone-400"
            >
                No
            </button>
        </div>
    );

    return (
        <button
            onClick={() => setConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
            title="Delete this submission permanently"
        >
            <Trash2 size={11} strokeWidth={2} />
            Delete
        </button>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminReviewRewardsPage() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [filter,      setFilter]      = useState<"all" | "pending" | "approved" | "rejected">("all");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res  = await fetch("/api/admin/review-rewards");
            const data = await res.json();
            if (data.success) setSubmissions(data.submissions);
        } catch {}
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDone = (id: string, newStatus: string, newRewardItem: string) => {
        setSubmissions(prev =>
            prev.map(s => s._id === id
                ? { ...s, status: newStatus as Submission["status"], rewardItem: newRewardItem as "burger" | "pizza" }
                : s
            )
        );
    };

    // Remove the entry from local state immediately after delete
    const handleDeleted = (id: string) => {
        setSubmissions(prev => prev.filter(s => s._id !== id));
    };

    const filtered = filter === "all" ? submissions : submissions.filter(s => s.status === filter);
    const counts   = {
        all:      submissions.length,
        pending:  submissions.filter(s => s.status === "pending").length,
        approved: submissions.filter(s => s.status === "approved").length,
        rejected: submissions.filter(s => s.status === "rejected").length,
    };

    const timeAgo = (d: string) => {
        const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
        if (s < 60)    return `${s}s ago`;
        if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
        if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
        return `${Math.floor(s / 86400)}d ago`;
    };

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/8 px-3 py-1">
                    <Instagram size={11} className="text-pink-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-400">Review Rewards</span>
                </div>
                <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">Instagram Review Rewards</h1>
                <p className="mt-1 text-sm text-stone-600">
                    Approve, reject, or delete user Instagram reel submissions
                </p>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                    { label: "Total",    key: "all",      color: "text-white"        },
                    { label: "Pending",  key: "pending",  color: "text-amber-400"    },
                    { label: "Approved", key: "approved", color: "text-emerald-400"  },
                    { label: "Rejected", key: "rejected", color: "text-rose-400"     },
                ] as const).map(s => (
                    <div key={s.key} className="rounded-xl border border-white/[0.06] bg-[#111118] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-600">{s.label}</p>
                        <p className={`mt-1 font-serif text-2xl font-black ${s.color}`}>{counts[s.key]}</p>
                    </div>
                ))}
            </div>

            {/* ── Filter tabs + refresh ── */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex gap-1.5 flex-wrap">
                    {(["all", "pending", "approved", "rejected"] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold capitalize transition-all ${filter === f ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-white/[0.06] text-stone-500 hover:text-stone-300"}`}>
                            {f}{f !== "all" ? ` (${counts[f]})` : ""}
                        </button>
                    ))}
                </div>
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-stone-500 transition-all hover:text-stone-300 disabled:opacity-50">
                    <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </div>

            {/* ── Table ── */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111118]">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={24} className="animate-spin text-stone-600" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-center">
                        <Gift size={32} className="text-stone-700" strokeWidth={1.5} />
                        <p className="text-sm text-stone-600">No submissions here</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {/* Desktop column headers */}
                        <div className="hidden grid-cols-[1fr_2fr_1fr_1fr_1.5fr_auto] gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 md:grid">
                            <span>User</span>
                            <span>Instagram Link</span>
                            <span>Status</span>
                            <span>Reward</span>
                            <span>Actions</span>
                            <span>Delete</span>
                        </div>

                        {filtered.map(sub => (
                            <div key={sub._id}
                                className="grid grid-cols-1 gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02] md:grid-cols-[1fr_2fr_1fr_1fr_1.5fr_auto] md:items-center">

                                {/* User */}
                                <div>
                                    <p className="text-sm font-semibold text-stone-200">{sub.user.name}</p>
                                    <p className="text-[10px] text-stone-600">{sub.user.email}</p>
                                    <p className="text-[10px] text-stone-600">{timeAgo(sub.createdAt)}</p>
                                </div>

                                {/* Instagram link */}
                                <div>
                                    <a href={sub.instagramLink} target="_blank" rel="noopener noreferrer"
                                        className="flex min-w-0 items-center gap-1.5 truncate rounded-xl border border-pink-500/20 bg-pink-500/8 px-3 py-1.5 text-[11px] font-semibold text-pink-400 transition-all hover:bg-pink-500/15">
                                        <Instagram size={11} />
                                        <span className="truncate">
                                            {sub.instagramLink.replace("https://www.", "").replace("https://", "")}
                                        </span>
                                        <ExternalLink size={9} className="shrink-0" />
                                    </a>
                                </div>

                                {/* Status */}
                                <div className="flex items-center gap-2">
                                    <StatusBadge status={sub.status} />
                                    {sub.rewardUsed && (
                                        <span className="rounded-full border border-stone-500/20 bg-stone-500/10 px-2 py-0.5 text-[9px] font-bold text-stone-500">
                                            USED
                                        </span>
                                    )}
                                </div>

                                {/* Reward item */}
                                <div className="text-sm text-stone-400">
                                    {sub.rewardItem === "pizza" ? "🍕 Pizza" : "🍔 Burger"}
                                </div>

                                {/* Approve / Reject */}
                                <div>
                                    <ActionBtn
                                        id={sub._id}
                                        currentStatus={sub.status}
                                        rewardItem={sub.rewardItem}
                                        onDone={handleDone}
                                    />
                                    {sub.adminNote && (
                                        <p className="mt-1.5 text-[10px] italic text-stone-600">
                                            Note: {sub.adminNote}
                                        </p>
                                    )}
                                </div>

                                {/* Delete */}
                                <div>
                                    <DeleteBtn id={sub._id} onDeleted={handleDeleted} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}