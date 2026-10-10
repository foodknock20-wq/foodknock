"use client";

// src/components/admin/reviews/ReviewTable.tsx
// Premium dark review management table — FoodKnock

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
    MessageSquare, Star, CheckCircle2,
    XCircle, Trash2, Loader2,
} from "lucide-react";

// Phase 15A: search + status filter are now server-side (AdminListSearchBar
// + ReviewStatusFilter on the parent page) — this component only ever
// receives the current page's rows.

// ─── Types ────────────────────────────────────────────────────────────────
export type ReviewRow = {
    _id:        string;
    userName:   string;
    rating:     number;
    comment:    string;
    isApproved: boolean;
    createdAt:  string;
};

type Props = { reviews: ReviewRow[] };

// ─── Sub-components ───────────────────────────────────────────────────────
function ReviewAvatar({ name }: { name: string }) {
    return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-[11px] font-black text-amber-300 ring-1 ring-amber-500/15">
            {name.trim()[0]?.toUpperCase() ?? "?"}
        </div>
    );
}

function StarRow({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
                <Star
                    key={s}
                    size={11}
                    className={s <= rating ? "fill-amber-400 text-amber-400" : "text-stone-700"}
                />
            ))}
            <span className="ml-1.5 text-[11px] font-bold text-stone-600">{rating}/5</span>
        </div>
    );
}

function ApprovalBadge({ isApproved }: { isApproved: boolean }) {
    if (isApproved) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                <CheckCircle2 size={9} strokeWidth={3} /> Approved
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400">
            <XCircle size={9} strokeWidth={3} /> Pending
        </span>
    );
}

function ActionButtons({
    review, onApprove, onUnapprove, onDelete, loadingApprove, loadingDelete,
}: {
    review:         ReviewRow;
    onApprove:      () => void;
    onUnapprove:    () => void;
    onDelete:       () => void;
    loadingApprove: boolean;
    loadingDelete:  boolean;
}) {
    return (
        <div className="flex items-center gap-1.5">
            {review.isApproved ? (
                <button
                    onClick={onUnapprove}
                    disabled={loadingApprove}
                    title="Unapprove"
                    className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/8 px-2.5 py-1.5 text-[11px] font-bold text-amber-400 transition-all duration-200 hover:border-amber-500/30 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loadingApprove ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                    <span className="hidden sm:inline">Unapprove</span>
                </button>
            ) : (
                <button
                    onClick={onApprove}
                    disabled={loadingApprove}
                    title="Approve"
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 transition-all duration-200 hover:border-emerald-500/30 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loadingApprove ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                    <span className="hidden sm:inline">Approve</span>
                </button>
            )}

            <button
                onClick={onDelete}
                disabled={loadingDelete}
                title="Delete review"
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/8 px-2.5 py-1.5 text-[11px] font-bold text-rose-400 transition-all duration-200 hover:border-rose-500/30 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loadingDelete ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                <span className="hidden sm:inline">Delete</span>
            </button>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function ReviewTable({ reviews }: Props) {
    const router = useRouter();
    const [loadingId,  setLoadingId]  = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleToggleApprove = async (review: ReviewRow, approve: boolean) => {
        setLoadingId(review._id);
        try {
            const res  = await fetch(`/api/reviews/${review._id}`, {
                method:  "PATCH",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ isApproved: approve }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message ?? "Failed to update review"); return; }
            toast.success(approve ? "Review approved" : "Review unapproved", {
                style: {
                    background: "#0f0f16", color: "#e7e5e4",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "14px", fontSize: "13px", fontWeight: "700",
                },
            });
            router.refresh();
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setLoadingId(null);
        }
    };

    const handleDelete = async (id: string, userName: string) => {
        if (!confirm(`Delete review by "${userName}"? This cannot be undone.`)) return;
        setDeletingId(id);
        try {
            const res  = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message ?? "Failed to delete"); return; }
            toast.success("Review deleted", {
                style: {
                    background: "#0f0f16", color: "#e7e5e4",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "14px", fontSize: "13px", fontWeight: "700",
                },
            });
            router.refresh();
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            {/* ── Empty state ── */}
            {reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                        <MessageSquare size={26} className="text-stone-600" strokeWidth={1.5} />
                    </div>
                    <p className="text-base font-black text-white">No reviews found</p>
                    <p className="mt-1.5 text-sm text-stone-600">
                        Try changing the status filter or search term.
                    </p>
                </div>
            ) : (
                <>
                    {/* ── Desktop table ── */}
                    <div className="hidden overflow-hidden rounded-2xl border border-white/[0.06] md:block">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                    {["Customer", "Rating", "Comment", "Status", "Date", "Actions"].map((h) => (
                                        <th key={h} className="px-4 py-3.5 text-left text-[10px] font-black uppercase tracking-[0.18em] text-stone-600">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {reviews.map((review) => (
                                    <tr key={review._id} className="group transition-colors hover:bg-white/[0.02]">

                                        {/* Customer */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <ReviewAvatar name={review.userName} />
                                                <span className="font-semibold text-stone-200">{review.userName}</span>
                                            </div>
                                        </td>

                                        {/* Rating */}
                                        <td className="px-4 py-3.5"><StarRow rating={review.rating} /></td>

                                        {/* Comment */}
                                        <td className="px-4 py-3.5">
                                            <p className="max-w-xs truncate text-stone-500">{review.comment}</p>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3.5"><ApprovalBadge isApproved={review.isApproved} /></td>

                                        {/* Date */}
                                        <td className="px-4 py-3.5">
                                            <span className="text-[11px] text-stone-600">
                                                {new Date(review.createdAt).toLocaleDateString("en-IN", {
                                                    day: "2-digit", month: "short", year: "numeric",
                                                })}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3.5">
                                            <ActionButtons
                                                review={review}
                                                onApprove={() => handleToggleApprove(review, true)}
                                                onUnapprove={() => handleToggleApprove(review, false)}
                                                onDelete={() => handleDelete(review._id, review.userName)}
                                                loadingApprove={loadingId === review._id}
                                                loadingDelete={deletingId === review._id}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Mobile cards ── */}
                    <div className="space-y-3 md:hidden">
                        {reviews.map((review) => (
                            <div key={review._id} className="rounded-2xl border border-white/[0.06] bg-[#0f0f16] p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <ReviewAvatar name={review.userName} />
                                        <div>
                                            <p className="font-bold text-white">{review.userName}</p>
                                            <StarRow rating={review.rating} />
                                        </div>
                                    </div>
                                    <ApprovalBadge isApproved={review.isApproved} />
                                </div>

                                <p className="mt-3 text-sm leading-relaxed text-stone-500">
                                    &quot;{review.comment}&quot;
                                </p>

                                <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
                                    <span className="text-[11px] text-stone-600">
                                        {new Date(review.createdAt).toLocaleDateString("en-IN", {
                                            day: "2-digit", month: "short", year: "numeric",
                                        })}
                                    </span>
                                    <ActionButtons
                                        review={review}
                                        onApprove={() => handleToggleApprove(review, true)}
                                        onUnapprove={() => handleToggleApprove(review, false)}
                                        onDelete={() => handleDelete(review._id, review.userName)}
                                        loadingApprove={loadingId === review._id}
                                        loadingDelete={deletingId === review._id}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                </>
            )}
        </>
    );
}