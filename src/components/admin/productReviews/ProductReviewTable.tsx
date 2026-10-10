"use client";

// src/components/admin/productReviews/ProductReviewTable.tsx
//
// Pre-Phase 17 — Phase 1: Reviews 2.0 admin table. Same desktop-table /
// mobile-card dual layout and dark Admin 2.0 styling as the existing
// src/components/admin/reviews/ReviewTable.tsx (testimonials), adapted for
// per-product reviews: adds a Product column + Verified Purchase badge, and
// replaces Approve/Unapprove with Hide/Unhide (soft moderation — delete is
// still a separate, confirmed, hard-delete action).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
    Star, CheckCircle2, EyeOff, Eye, Trash2, Loader2, BadgeCheck, MessageSquare,
} from "lucide-react";

export type ProductReviewRow = {
    _id: string;
    productName: string;
    productSlug: string | null;
    userName: string;
    rating: number;
    comment: string;
    verifiedPurchase: boolean;
    isHidden: boolean;
    createdAt: string;
};

type Props = { reviews: ProductReviewRow[] };

const TOAST_STYLE = {
    background: "#0f0f16", color: "#e7e5e4",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "14px", fontSize: "13px", fontWeight: "700",
};

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
                <Star key={s} size={11} className={s <= rating ? "fill-amber-400 text-amber-400" : "text-stone-700"} />
            ))}
            <span className="ml-1.5 text-[11px] font-bold text-stone-600">{rating}/5</span>
        </div>
    );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
    if (!verified) {
        return <span className="text-[10.5px] font-bold text-stone-600">Customer review</span>;
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
            <BadgeCheck size={9} strokeWidth={3} /> Verified
        </span>
    );
}

function VisibilityBadge({ isHidden }: { isHidden: boolean }) {
    if (isHidden) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-400">
                <EyeOff size={9} strokeWidth={3} /> Hidden
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
            <CheckCircle2 size={9} strokeWidth={3} /> Visible
        </span>
    );
}

function ActionButtons({
    review, onToggleHidden, onDelete, loadingHide, loadingDelete,
}: {
    review: ProductReviewRow;
    onToggleHidden: () => void;
    onDelete: () => void;
    loadingHide: boolean;
    loadingDelete: boolean;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <button
                onClick={onToggleHidden}
                disabled={loadingHide}
                title={review.isHidden ? "Unhide" : "Hide"}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/8 px-2.5 py-1.5 text-[11px] font-bold text-amber-400 transition-all duration-200 hover:border-amber-500/30 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loadingHide ? <Loader2 size={11} className="animate-spin" /> : review.isHidden ? <Eye size={11} /> : <EyeOff size={11} />}
                <span className="hidden sm:inline">{review.isHidden ? "Unhide" : "Hide"}</span>
            </button>

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

export default function ProductReviewTable({ reviews }: Props) {
    const router = useRouter();
    const [hidingId, setHidingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleToggleHidden = async (review: ProductReviewRow) => {
        setHidingId(review._id);
        try {
            const res = await fetch(`/api/admin/product-reviews/${review._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isHidden: !review.isHidden }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message ?? "Failed to update review"); return; }
            toast.success(review.isHidden ? "Review unhidden" : "Review hidden", { style: TOAST_STYLE });
            router.refresh();
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setHidingId(null);
        }
    };

    const handleDelete = async (review: ProductReviewRow) => {
        if (!confirm(`Permanently delete this review by "${review.userName}"? This cannot be undone.`)) return;
        setDeletingId(review._id);
        try {
            const res = await fetch(`/api/admin/product-reviews/${review._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message ?? "Failed to delete"); return; }
            toast.success("Review deleted", { style: TOAST_STYLE });
            router.refresh();
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    if (reviews.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                    <MessageSquare size={26} className="text-stone-600" strokeWidth={1.5} />
                </div>
                <p className="text-base font-black text-white">No reviews found</p>
                <p className="mt-1.5 text-sm text-stone-600">Try changing the filters or search term.</p>
            </div>
        );
    }

    return (
        <>
            {/* ── Desktop table ── */}
            <div className="hidden overflow-hidden rounded-2xl border border-white/[0.06] md:block">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                            {["Product", "Customer", "Rating", "Review", "Verified", "Status", "Date", "Actions"].map((h) => (
                                <th key={h} className="px-4 py-3.5 text-left text-[10px] font-black uppercase tracking-[0.18em] text-stone-600">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                        {reviews.map((review) => (
                            <tr key={review._id} className="group transition-colors hover:bg-white/[0.02]">
                                <td className="px-4 py-3.5">
                                    <p className="max-w-[140px] truncate font-semibold text-stone-200">{review.productName}</p>
                                </td>
                                <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <ReviewAvatar name={review.userName} />
                                        <span className="font-semibold text-stone-200">{review.userName}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3.5"><StarRow rating={review.rating} /></td>
                                <td className="px-4 py-3.5">
                                    <p className="max-w-xs truncate text-stone-500">{review.comment}</p>
                                </td>
                                <td className="px-4 py-3.5"><VerifiedBadge verified={review.verifiedPurchase} /></td>
                                <td className="px-4 py-3.5"><VisibilityBadge isHidden={review.isHidden} /></td>
                                <td className="px-4 py-3.5">
                                    <span className="text-[11px] text-stone-600">
                                        {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5">
                                    <ActionButtons
                                        review={review}
                                        onToggleHidden={() => handleToggleHidden(review)}
                                        onDelete={() => handleDelete(review)}
                                        loadingHide={hidingId === review._id}
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
                            <VisibilityBadge isHidden={review.isHidden} />
                        </div>

                        <p className="mt-2 text-[11.5px] font-bold text-amber-400">{review.productName}</p>
                        <p className="mt-1 text-sm leading-relaxed text-stone-500">&quot;{review.comment}&quot;</p>

                        <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
                            <div className="flex flex-col gap-1">
                                <VerifiedBadge verified={review.verifiedPurchase} />
                                <span className="text-[11px] text-stone-600">
                                    {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                            </div>
                            <ActionButtons
                                review={review}
                                onToggleHidden={() => handleToggleHidden(review)}
                                onDelete={() => handleDelete(review)}
                                loadingHide={hidingId === review._id}
                                loadingDelete={deletingId === review._id}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
