"use client";

// src/components/products/ProductReviews.tsx
//
// Pre-Phase 17 — Phase 1: Reviews 2.0 product-page section. Compact by
// construction: average + distribution + a bounded first page of reviews,
// "Load more" for the rest — never the full review set in one payload. All
// rating/count values come from the API (backed by real ProductReview
// documents) — truthful empty state when there are none, no fabricated
// fallback.

import { useEffect, useState, useCallback } from "react";
import { Star, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { toastSuccess, toastError } from "@/lib/toast";
import WriteReviewSheet, { type SubmittedReview } from "./WriteReviewSheet";

type ReviewItem = {
    _id: string;
    userName: string;
    rating: number;
    comment: string;
    verifiedPurchase: boolean;
    createdAt: string;
};

type Distribution = Record<1 | 2 | 3 | 4 | 5, number>;
type SortKey = "newest" | "highest" | "lowest";

const EMPTY_DISTRIBUTION: Distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const PAGE_LIMIT = 12;

function timeAgo(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 1) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
    return (
        <div className="flex items-center gap-0.5" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={size} className={s <= rating ? "fill-fk-gold text-fk-gold" : "text-fk-border"} />
            ))}
        </div>
    );
}

function DistributionBars({ distribution, total }: { distribution: Distribution; total: number }) {
    return (
        <div className="flex-1 space-y-1">
            {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = distribution[star];
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                    <div key={star} className="flex items-center gap-2 text-[11px]">
                        <span className="w-6 shrink-0 font-bold text-fk-text-secondary">{star}★</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-fk-pill bg-fk-surface-interactive">
                            <div className="h-full rounded-fk-pill bg-fk-gold" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 shrink-0 text-right text-fk-text-tertiary">{count}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default function ProductReviews({
    productId,
    productName,
    summary,
    onSummaryChange,
}: {
    productId: string;
    productName: string;
    summary: { average: number | null; count: number };
    onSummaryChange: (s: { average: number | null; count: number }) => void;
}) {
    const router = useRouter();
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [distribution, setDistribution] = useState<Distribution>(EMPTY_DISTRIBUTION);
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [sort, setSort] = useState<SortKey>("newest");
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);

    const fetchReviews = useCallback(
        async (targetPage: number, targetSort: SortKey, append: boolean) => {
            if (append) setLoadingMore(true);
            else setLoading(true);
            try {
                const res = await fetch(
                    `/api/products/${productId}/reviews?page=${targetPage}&limit=${PAGE_LIMIT}&sort=${targetSort}`
                );
                const data = await res.json();
                if (!res.ok) return;

                setReviews((prev) => (append ? [...prev, ...data.reviews] : data.reviews));
                setHasNextPage(data.meta.hasNextPage);
                setPage(targetPage);
                setDistribution(data.summary.distribution);
                onSummaryChange({ average: data.summary.average, count: data.summary.count });
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [productId, onSummaryChange]
    );

    useEffect(() => {
        fetchReviews(1, sort, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId, sort]);

    const handleWriteReviewClick = () => {
        if (isLoggedIn === false) {
            toastError("Please sign in to write a review");
            router.push("/auth");
            return;
        }
        setSheetOpen(true);
    };

    const handleSubmitted = (review: SubmittedReview, message: string) => {
        toastSuccess(message);
        if (sort !== "newest") {
            setSort("newest");
        } else {
            setReviews((prev) => [review, ...prev]);
            onSummaryChange({
                average: summary.average, // authoritative value arrives on next fetch; avoid guessing the new average client-side
                count: summary.count + 1,
            });
            // Refresh in the background so the average/distribution reflect the new review exactly.
            fetchReviews(1, "newest", false);
        }
    };

    const average = summary.average;
    const count = summary.count;

    return (
        <section className="mt-16">
            <div className="mb-5 flex items-center gap-3">
                <div>
                    <h2 className="font-display text-lg font-black text-fk-text md:text-xl">Ratings &amp; Reviews</h2>
                    <p className="mt-0.5 text-xs text-fk-text-tertiary">What customers are saying about {productName}</p>
                </div>
                <div className="h-px flex-1 bg-fk-border" />
            </div>

            {/* Summary */}
            <div className="mb-6 flex flex-col gap-5 rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex shrink-0 flex-col items-center justify-center sm:w-32">
                    <span className="font-display text-3xl font-black text-fk-text">
                        {typeof average === "number" ? average.toFixed(1) : "—"}
                    </span>
                    <StarRow rating={average ? Math.round(average) : 0} size={14} />
                    <span className="mt-1 text-[11px] font-bold text-fk-text-tertiary">
                        {count} review{count !== 1 ? "s" : ""}
                    </span>
                </div>

                {count > 0 ? (
                    <DistributionBars distribution={distribution} total={count} />
                ) : (
                    <div className="flex-1">
                        <p className="text-sm font-black text-fk-text">No reviews yet</p>
                        <p className="mt-0.5 text-xs text-fk-text-secondary">Be the first to share your experience.</p>
                    </div>
                )}

                <button
                    onClick={handleWriteReviewClick}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-4 py-2.5 text-xs font-black text-white shadow-fk-md transition-all active:scale-95 sm:self-center"
                >
                    <PenLine size={13} strokeWidth={2.5} />
                    Write a Review
                </button>
            </div>

            {/* Sort controls */}
            {count > 1 && (
                <div className="mb-3 flex items-center gap-1.5">
                    {([
                        { key: "newest", label: "Newest" },
                        { key: "highest", label: "Highest Rated" },
                        { key: "lowest", label: "Lowest Rated" },
                    ] as { key: SortKey; label: string }[]).map((opt) => (
                        <button
                            key={opt.key}
                            onClick={() => setSort(opt.key)}
                            className={`rounded-fk-pill px-3 py-1.5 text-[11px] font-bold transition-colors ${sort === opt.key
                                ? "bg-fk-surface-selected text-[var(--fk-accent)]"
                                : "text-fk-text-tertiary hover:text-fk-text-secondary"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Review list */}
            {loading ? (
                <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-20 animate-pulse rounded-fk-md bg-fk-surface-interactive" />
                    ))}
                </div>
            ) : reviews.length === 0 ? null : (
                <div className="space-y-3">
                    {reviews.map((review) => (
                        <div key={review._id} className="rounded-fk-md border border-fk-border bg-fk-surface-elevated p-3.5">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-black text-fk-text">{review.userName}</span>
                                    {review.verifiedPurchase && (
                                        <span className="inline-flex items-center gap-1 rounded-fk-pill bg-fk-success/10 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-fk-success">
                                            Verified Purchase
                                        </span>
                                    )}
                                </div>
                                <span className="shrink-0 text-[10.5px] text-fk-text-tertiary">{timeAgo(review.createdAt)}</span>
                            </div>
                            <div className="mt-1">
                                <StarRow rating={review.rating} />
                            </div>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-fk-text-secondary">{review.comment}</p>
                        </div>
                    ))}
                </div>
            )}

            {hasNextPage && (
                <button
                    onClick={() => fetchReviews(page + 1, sort, true)}
                    disabled={loadingMore}
                    className="mx-auto mt-4 block rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-5 py-2 text-xs font-bold text-fk-text-secondary transition-colors hover:text-fk-text disabled:opacity-50"
                >
                    {loadingMore ? "Loading…" : "Load more reviews"}
                </button>
            )}

            <WriteReviewSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                productId={productId}
                productName={productName}
                onSubmitted={handleSubmitted}
            />
        </section>
    );
}
