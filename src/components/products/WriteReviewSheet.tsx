"use client";

// src/components/products/WriteReviewSheet.tsx
//
// Pre-Phase 17 — Phase 1: Reviews 2.0 submission UI. Server does the real
// validation (rating 1-5 integer, comment length, auth, duplicate,
// verifiedPurchase) — this form's client-side checks only exist to give
// immediate feedback, never as the only protection.

import { useState } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { toastError } from "@/lib/toast";

const MAX_LENGTH = 1000;

export type SubmittedReview = {
    _id: string;
    userName: string;
    rating: number;
    comment: string;
    verifiedPurchase: boolean;
    createdAt: string;
};

export default function WriteReviewSheet({
    open,
    onClose,
    productId,
    productName,
    onSubmitted,
}: {
    open: boolean;
    onClose: () => void;
    productId: string;
    productName: string;
    onSubmitted: (review: SubmittedReview, message: string) => void;
}) {
    const router = useRouter();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setRating(0);
        setHoverRating(0);
        setComment("");
        setError(null);
    };

    const handleClose = () => {
        if (submitting) return;
        reset();
        onClose();
    };

    const handleSubmit = async () => {
        setError(null);

        if (rating < 1 || rating > 5) {
            setError("Please select a star rating");
            return;
        }
        const trimmed = comment.trim();
        if (trimmed.length < 3) {
            setError("Please share a few words about your experience");
            return;
        }
        if (trimmed.length > MAX_LENGTH) {
            setError(`Review must be ${MAX_LENGTH} characters or fewer`);
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/products/${productId}/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, comment: trimmed }),
            });
            const data = await res.json();

            if (res.status === 401) {
                toastError("Please sign in to write a review");
                reset();
                onClose();
                router.push("/auth");
                return;
            }
            if (!res.ok) {
                setError(data.message ?? "Failed to submit review");
                return;
            }

            onSubmitted(data.review, data.message ?? "Thanks for your review!");
            reset();
            onClose();
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <BottomSheet open={open} onClose={handleClose} title="Write a Review" ariaLabel={`Write a review for ${productName}`}>
            <div className="space-y-4">
                <div>
                    <p className="mb-1.5 text-xs font-black uppercase tracking-wider text-fk-text-secondary">
                        Rate this product
                    </p>
                    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((s) => {
                            const filled = (hoverRating || rating) >= s;
                            return (
                                <button
                                    key={s}
                                    type="button"
                                    role="radio"
                                    aria-checked={rating === s}
                                    aria-label={`${s} star${s > 1 ? "s" : ""}`}
                                    onMouseEnter={() => setHoverRating(s)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => setRating(s)}
                                    className="flex h-11 w-11 items-center justify-center rounded-fk-sm transition-transform active:scale-90"
                                >
                                    <Star
                                        size={26}
                                        strokeWidth={2}
                                        className={filled ? "fill-fk-gold text-fk-gold" : "text-fk-border"}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <label htmlFor="review-comment" className="mb-1.5 block text-xs font-black uppercase tracking-wider text-fk-text-secondary">
                        Share your experience
                    </label>
                    <textarea
                        id="review-comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value.slice(0, MAX_LENGTH))}
                        rows={4}
                        maxLength={MAX_LENGTH}
                        placeholder="What did you think of this dish?"
                        className="w-full resize-none rounded-fk-md border border-fk-border bg-fk-surface-elevated px-3.5 py-3 text-sm text-fk-text placeholder:text-fk-text-tertiary focus:border-[var(--fk-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--fk-accent)]/15"
                    />
                    <p className="mt-1 text-right text-[10.5px] text-fk-text-tertiary">{comment.length}/{MAX_LENGTH}</p>
                </div>

                {error && (
                    <p role="alert" className="rounded-fk-sm bg-fk-danger/10 px-3 py-2 text-xs font-semibold text-fk-danger">
                        {error}
                    </p>
                )}

                <Button variant="primary" size="lg" fullWidth loading={submitting} onClick={handleSubmit}>
                    Submit Review
                </Button>
            </div>
        </BottomSheet>
    );
}
