"use client";

// src/components/orders/RateOrderSection.tsx
//
// "Rate Your Order" — reuses the EXISTING ProductReview system end to end:
// WriteReviewSheet for submission, POST /api/products/[id]/reviews for the
// write (server-side verifiedPurchase via findQualifyingOrder — untouched),
// and the new bounded GET /api/products/reviews/mine read-helper just to
// know which of this order's products the customer already reviewed, so a
// reviewed product shows "✓ Reviewed" instead of a second "Write a review"
// prompt. No second review system, no edit flow (the existing API has no
// PATCH/PUT — the unique {productId,userId} index makes a second POST
// 409 "already reviewed", so editing isn't something this system safely
// supports yet; out of scope here).

import { useEffect, useState } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import { UtensilsCrossed } from "lucide-react";
import WriteReviewSheet, { type SubmittedReview } from "@/components/products/WriteReviewSheet";
import { toastSuccess } from "@/lib/toast";

type ReorderableItem = { productId: string | null; name: string; image?: string };

export default function RateOrderSection({
    items,
    status,
}: {
    items: ReorderableItem[];
    status: string;
}) {
    // Dedupe by productId — a product normally appears once per order
    // (cart merges by _id at checkout time), but this guards against any
    // historical edge case rather than rendering the same row twice.
    const reviewable = Array.from(
        new Map(
            items
                .filter((i): i is ReorderableItem & { productId: string } => !!i.productId)
                .map((i) => [i.productId, i])
        ).values()
    );

    const [reviewed, setReviewed] = useState<Record<string, number>>({});
    const [loaded, setLoaded] = useState(false);
    const [sheetItem, setSheetItem] = useState<{ productId: string; name: string } | null>(null);

    useEffect(() => {
        if (status !== "delivered" || reviewable.length === 0) { setLoaded(true); return; }
        const ids = reviewable.map((i) => i.productId).join(",");
        fetch(`/api/products/reviews/mine?ids=${encodeURIComponent(ids)}`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!data?.success) return;
                const map: Record<string, number> = {};
                for (const r of data.reviews as { productId: string; rating: number }[]) map[r.productId] = r.rating;
                setReviewed(map);
            })
            .catch(() => {})
            .finally(() => setLoaded(true));
        // orderId intentionally omitted — the product set for a given order never changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, reviewable.map((i) => i.productId).join(",")]);

    if (status !== "delivered" || reviewable.length === 0 || !loaded) return null;

    const allReviewed = reviewable.every((i) => reviewed[i.productId] !== undefined);

    function handleSubmitted(review: SubmittedReview, message: string) {
        if (sheetItem) setReviewed((prev) => ({ ...prev, [sheetItem.productId]: review.rating }));
        setSheetItem(null);
        toastSuccess(message);
    }

    return (
        <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
            <div className="border-b border-fk-border bg-fk-surface-selected px-5 py-3.5">
                <h2 className="text-xs font-black uppercase tracking-wider text-fk-text-secondary">Rate Your Order</h2>
            </div>

            {allReviewed ? (
                <div className="flex items-center gap-3 p-5">
                    <CheckCircle2 size={20} className="shrink-0 text-fk-success" />
                    <p className="text-sm font-bold text-fk-text">Thanks for rating your order!</p>
                </div>
            ) : (
                <div className="divide-y divide-fk-border">
                    {reviewable.map((item) => {
                        const rating = reviewed[item.productId];
                        return (
                            <div key={item.productId} className="flex items-center gap-3 px-5 py-3.5">
                                {item.image ? (
                                    <img src={item.image} alt={item.name} className="h-10 w-10 shrink-0 rounded-fk-md border border-fk-border object-cover" />
                                ) : (
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-fk-md bg-fk-gold-soft">
                                        <UtensilsCrossed size={14} className="text-amber-500" />
                                    </div>
                                )}
                                <p className="line-clamp-1 flex-1 text-sm font-bold text-fk-text">{item.name}</p>
                                {rating !== undefined ? (
                                    <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-fk-success">
                                        <CheckCircle2 size={13} /> Reviewed
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => setSheetItem({ productId: item.productId, name: item.name })}
                                        aria-label={`Rate ${item.name}`}
                                        className="flex shrink-0 items-center gap-1.5 rounded-fk-pill border border-[var(--fk-accent)]/30 bg-fk-surface-selected px-3.5 py-2 text-xs font-black text-[var(--fk-accent)] transition-all hover:brightness-105"
                                    >
                                        <Star size={12} strokeWidth={2.5} /> Rate
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {sheetItem && (
                <WriteReviewSheet
                    open={!!sheetItem}
                    onClose={() => setSheetItem(null)}
                    productId={sheetItem.productId}
                    productName={sheetItem.name}
                    onSubmitted={handleSubmitted}
                />
            )}
        </div>
    );
}
