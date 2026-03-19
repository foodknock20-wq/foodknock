"use client";

// src/components/reviews/ReviewsGrid.tsx
// Premium light-theme review grid for FoodKnock.
// Preserves all existing logic: auth check, POST /api/reviews, router.refresh, modals.

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Star, X, MessageSquarePlus, Loader2, Send,
    CheckCircle2, LogIn, Lock, ChevronRight, Quote,
} from "lucide-react";
import Link from "next/link";
import type { PublicReview } from "@/app/(main)/reviews/page";

// ─── Avatar gradient palette (warm food tones) ────────────────────────────
const AVATAR_GRADS = [
    ["#f97316", "#ef4444"],
    ["#fbbf24", "#f97316"],
    ["#34d399", "#059669"],
    ["#60a5fa", "#3b82f6"],
    ["#fb923c", "#fcd34d"],
    ["#f472b6", "#ec4899"],
    ["#a3e635", "#65a30d"],
    ["#38bdf8", "#0ea5e9"],
    ["#c084fc", "#9333ea"],
    ["#fb7185", "#f43f5e"],
];

const getGrad = (i: number) => AVATAR_GRADS[i % AVATAR_GRADS.length];

function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function timeAgo(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60)    return `${s}s ago`;
    if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    const d = Math.floor(s / 86400);
    if (d < 7)     return `${d}d ago`;
    if (d < 30)    return `${Math.floor(d / 7)}w ago`;
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── 12-word truncation ───────────────────────────────────────────────────
const WORD_LIMIT = 12;

function truncateWords(text: string): { preview: string; isTruncated: boolean } {
    const words = text.trim().split(/\s+/);
    if (words.length <= WORD_LIMIT) return { preview: text, isTruncated: false };
    return { preview: words.slice(0, WORD_LIMIT).join(" ") + "…", isTruncated: true };
}

// ─── Stars ────────────────────────────────────────────────────────────────
function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
                <Star
                    key={s}
                    size={size}
                    className={s <= rating ? "fill-amber-400 text-amber-400" : "fill-amber-100 text-amber-100"}
                />
            ))}
        </div>
    );
}

// ─── Interactive star input ───────────────────────────────────────────────
function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
    const [hov, setHov] = useState(0);
    const labels = ["", "Poor 😞", "Fair 😐", "Good 😊", "Great 😍", "Excellent! 🤩"];
    return (
        <div>
            <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => onChange(s)}
                        onMouseEnter={() => setHov(s)}
                        onMouseLeave={() => setHov(0)}
                        className="transition-transform hover:scale-125 active:scale-110 focus:outline-none"
                        aria-label={`Rate ${s} stars`}
                    >
                        <Star
                            size={32}
                            className={
                                s <= (hov || value)
                                    ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                                    : "fill-amber-100 text-amber-200"
                            }
                        />
                    </button>
                ))}
            </div>
            {(hov || value) > 0 && (
                <p className="mt-2 text-sm font-bold text-orange-500">
                    {labels[hov || value]}
                </p>
            )}
        </div>
    );
}

// ─── Full review modal ────────────────────────────────────────────────────
function ReviewModal({ review, idx, onClose }: { review: PublicReview; idx: number; onClose: () => void }) {
    const [from, to] = getGrad(idx);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm md:items-center md:p-4"
            onClick={onClose}
        >
            {/* Bottom sheet on mobile, centered card on desktop */}
            <div
                className="relative w-full rounded-t-3xl bg-white px-6 pb-8 pt-6 shadow-2xl shadow-orange-100/60 md:max-w-md md:rounded-3xl md:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag handle (mobile) */}
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-stone-200 md:hidden" />

                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-stone-100 bg-stone-50 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                >
                    <X size={15} />
                </button>

                {/* Avatar + name */}
                <div className="flex items-center gap-4">
                    <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-md"
                        style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
                    >
                        {initials(review.userName)}
                    </div>
                    <div>
                        <p className="text-lg font-black text-stone-900">{review.userName}</p>
                        <div className="mt-1 flex items-center gap-2">
                            <Stars rating={review.rating} size={13} />
                            <span className="text-[11px] text-stone-400">{timeAgo(review.createdAt)}</span>
                        </div>
                    </div>
                </div>

                {/* Full comment */}
                <div className="relative mt-5 rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
                    <div className="absolute left-0 top-4 bottom-4 w-1 rounded-full bg-gradient-to-b from-orange-400 to-amber-400 ml-0" style={{ left: "-1px", borderRadius: "0 4px 4px 0" }} />
                    <Quote size={18} className="mb-2 text-amber-300" />
                    <p className="text-sm leading-7 text-stone-700">{review.comment}</p>
                </div>

                <p className="mt-3 text-right text-[11px] text-stone-400">
                    {new Date(review.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "long", year: "numeric",
                    })}
                </p>
            </div>
        </div>
    );
}

// ─── Add review modal ─────────────────────────────────────────────────────
function AddReviewModal({ userName, onClose }: { userName: string; onClose: () => void }) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [form,    setForm]    = useState({ rating: 0, comment: "" });
    const [loading, setLoading] = useState(false);
    const [done,    setDone]    = useState(false);
    const [err,     setErr]     = useState("");

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr("");
        if (!form.rating)                    return setErr("Please pick a star rating ✨");
        if (form.comment.trim().length < 10) return setErr("Review must be at least 10 characters");

        setLoading(true);
        try {
            const res  = await fetch("/api/reviews", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                    userName: userName.trim(),
                    rating:   form.rating,
                    comment:  form.comment.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) { setErr(data.message ?? "Something went wrong"); return; }
            setDone(true);
            startTransition(() => router.refresh());
        } catch {
            setErr("Network error — please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm md:items-center md:p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full rounded-t-3xl bg-white px-6 pb-8 pt-6 shadow-2xl md:max-w-md md:rounded-3xl md:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-stone-200 md:hidden" />

                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-stone-100 bg-stone-50 text-stone-400 transition-colors hover:bg-stone-100"
                >
                    <X size={15} />
                </button>

                {done ? (
                    <div className="flex flex-col items-center py-6 text-center">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-green-50 border border-green-100">
                            <CheckCircle2 size={36} className="text-green-500" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl font-black text-stone-900">Thank you! 🎉</h3>
                        <p className="mt-2 text-sm text-stone-500 leading-relaxed">
                            Your review has been submitted. We truly appreciate your feedback!
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 text-sm font-black text-white shadow-md shadow-orange-200 transition-all hover:brightness-110"
                        >
                            Awesome, done!
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-md shadow-orange-200">
                                    <MessageSquarePlus size={18} className="text-white" strokeWidth={2} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-stone-900">Write a Review</h3>
                                    <p className="text-xs text-stone-400">
                                        Posting as <span className="font-bold text-stone-600">{userName}</span>
                                    </p>
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-stone-400 leading-relaxed">
                                Your honest words help others decide and help us improve. 💛
                            </p>
                        </div>

                        <form onSubmit={submit} noValidate className="space-y-5">
                            <div>
                                <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-stone-400">
                                    How was your experience? *
                                </p>
                                <StarInput
                                    value={form.rating}
                                    onChange={(n) => setForm((f) => ({ ...f, rating: n }))}
                                />
                            </div>

                            <div>
                                <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-stone-400">
                                    Tell us more *
                                </p>
                                <textarea
                                    value={form.comment}
                                    onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                                    placeholder="How was the food, delivery, taste? Tell us honestly…"
                                    rows={4}
                                    maxLength={500}
                                    className="w-full resize-none rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-3 text-sm text-stone-700 placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all"
                                />
                                <p className="mt-1 text-right text-[10px] text-stone-400">
                                    {form.comment.length}/500
                                </p>
                            </div>

                            {err && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
                                    {err}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200 transition-all hover:brightness-110 disabled:opacity-60"
                            >
                                {loading
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : <><Send size={14} strokeWidth={2.5} /> Submit My Review</>
                                }
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Login nudge modal ────────────────────────────────────────────────────
function LoginNudgeModal({ onClose }: { onClose: () => void }) {
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm md:items-center md:p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full rounded-t-3xl bg-white px-6 pb-8 pt-6 text-center shadow-2xl md:max-w-sm md:rounded-3xl md:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-stone-200 md:hidden" />

                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-stone-100 bg-stone-50 text-stone-400 transition-colors hover:bg-stone-100"
                >
                    <X size={15} />
                </button>

                <div className="mb-4 mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
                    <Lock size={30} className="text-amber-500" strokeWidth={1.8} />
                </div>
                <h3 className="text-xl font-black text-stone-900">Join the FoodKnock family 🍕</h3>
                <p className="mt-2 text-sm text-stone-500 leading-relaxed">
                    Sign in to share your food experience with fellow foodies!
                </p>

                <div className="mt-6 flex gap-3">
                    <Link
                        href="/auth"
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-black text-white shadow-md shadow-orange-200 transition-all hover:brightness-110"
                    >
                        <LogIn size={14} strokeWidth={2.5} />
                        Sign In
                    </Link>
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-2xl border border-stone-200 bg-stone-50 py-3 text-sm font-semibold text-stone-500 transition-all hover:bg-stone-100 hover:text-stone-700"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Single review card ───────────────────────────────────────────────────
function ReviewCard({
    review, idx, onExpand,
}: {
    review: PublicReview;
    idx: number;
    onExpand: () => void;
}) {
    const [from, to] = getGrad(idx);
    const { preview, isTruncated } = truncateWords(review.comment);

    return (
        <article className="group flex flex-col rounded-3xl border border-amber-100 bg-white p-5 shadow-sm transition-all duration-200 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-100/60">

            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white shadow-md"
                    style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
                >
                    {initials(review.userName)}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-stone-900">{review.userName}</p>
                    <p className="text-[10px] font-semibold text-stone-400">{timeAgo(review.createdAt)}</p>
                </div>
                <div className="shrink-0">
                    <Stars rating={review.rating} size={11} />
                </div>
            </div>

            {/* Comment */}
            <div className="flex-1">
                <p className="text-[13px] leading-6 text-stone-600">{preview}</p>
                {isTruncated && (
                    <button
                        onClick={onExpand}
                        className="mt-1.5 flex items-center gap-0.5 text-[12px] font-bold text-orange-500 transition-colors hover:text-orange-600"
                    >
                        Read more <ChevronRight size={12} strokeWidth={2.5} />
                    </button>
                )}
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between border-t border-amber-50 pt-3">
                <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-600">
                    ★ {review.rating}.0
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-stone-300">
                    Verified
                </span>
            </div>
        </article>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyState({ onWrite }: { onWrite: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-amber-100 bg-white px-6 py-20 text-center shadow-sm">
            <div className="mb-5 text-6xl">🌟</div>
            <h3 className="text-xl font-black text-stone-900">Be the first to review!</h3>
            <p className="mt-2 max-w-xs text-sm text-stone-500 leading-relaxed">
                No reviews yet — but that&apos;s about to change. Tried our food? Tell the world!
            </p>
            <button
                onClick={onWrite}
                className="mt-6 flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-7 py-3 text-sm font-black text-white shadow-md shadow-orange-200 transition-all hover:brightness-110 active:scale-95"
            >
                <MessageSquarePlus size={15} strokeWidth={2.5} />
                Write First Review
            </button>
        </div>
    );
}

// ─── Constants ────────────────────────────────────────────────────────────
const INITIAL_COUNT = 9;
const LOAD_MORE_COUNT = 6;

// ─── Main exported component ──────────────────────────────────────────────
export default function ReviewsGrid({ reviews }: { reviews: PublicReview[] }) {
    const [expanded,     setExpanded]     = useState<{ review: PublicReview; idx: number } | null>(null);
    const [showAdd,      setShowAdd]      = useState(false);
    const [showLogin,    setShowLogin]    = useState(false);
    const [loggedUser,   setLoggedUser]   = useState<string | null>(null);
    const [authChecked,  setAuthChecked]  = useState(false);
    const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

    useEffect(() => {
        fetch("/api/auth/me", { credentials: "include" })
            .then((r) => r.json())
            .then((d) => { if (d.success && d.user?.name) setLoggedUser(d.user.name); })
            .catch(() => {})
            .finally(() => setAuthChecked(true));
    }, []);

    const handleAddClick = () => {
        if (!authChecked) return;
        if (loggedUser)   setShowAdd(true);
        else              setShowLogin(true);
    };

    const visibleReviews = reviews.slice(0, visibleCount);
    const hasMore        = visibleCount < reviews.length;
    const remaining      = reviews.length - visibleCount;

    return (
        <>
            {/* Modals */}
            {expanded && (
                <ReviewModal
                    review={expanded.review}
                    idx={expanded.idx}
                    onClose={() => setExpanded(null)}
                />
            )}
            {showAdd && loggedUser && (
                <AddReviewModal userName={loggedUser} onClose={() => setShowAdd(false)} />
            )}
            {showLogin && (
                <LoginNudgeModal onClose={() => setShowLogin(false)} />
            )}

            {/* ── Grid section ── */}
            <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">

                {/* Section header */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-500 mb-1">
                            Testimonials
                        </p>
                        <h2 className="text-2xl font-black text-stone-900 md:text-3xl">
                            Fresh from our customers
                        </h2>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                        {reviews.length > 0 && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                                {reviews.length} reviews
                            </span>
                        )}
                        <button
                            onClick={handleAddClick}
                            disabled={!authChecked}
                            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-orange-200 transition-all hover:brightness-110 hover:shadow-lg disabled:opacity-60 active:scale-95"
                        >
                            <MessageSquarePlus size={14} strokeWidth={2.5} />
                            Write a Review
                        </button>
                    </div>
                </div>

                {/* Reviews grid */}
                {reviews.length === 0 ? (
                    <EmptyState onWrite={handleAddClick} />
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
                            {visibleReviews.map((review, i) => (
                                <ReviewCard
                                    key={review._id}
                                    review={review}
                                    idx={i}
                                    onExpand={() => setExpanded({ review, idx: i })}
                                />
                            ))}
                        </div>

                        {/* ── Load More ── */}
                        {hasMore && (
                            <div className="mt-10 flex flex-col items-center gap-3">
                                {/* Progress indicator */}
                                <div className="flex items-center gap-3 text-xs text-stone-400">
                                    <div className="h-px w-16 bg-amber-100" />
                                    <span className="font-semibold">
                                        Showing <span className="font-black text-stone-600">{visibleCount}</span> of{" "}
                                        <span className="font-black text-stone-600">{reviews.length}</span> reviews
                                    </span>
                                    <div className="h-px w-16 bg-amber-100" />
                                </div>

                                {/* Progress bar */}
                                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-amber-100">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                                        style={{ width: `${(visibleCount / reviews.length) * 100}%` }}
                                    />
                                </div>

                                <button
                                    onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
                                    className="mt-1 flex items-center gap-2 rounded-full border-2 border-amber-200 bg-white px-7 py-3 text-sm font-black text-amber-700 shadow-sm transition-all duration-200 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-600 hover:shadow-md hover:shadow-orange-100 active:scale-95"
                                >
                                    Load {Math.min(remaining, LOAD_MORE_COUNT)} more reviews
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-black text-amber-700">
                                        +{Math.min(remaining, LOAD_MORE_COUNT)}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* All loaded state */}
                        {!hasMore && reviews.length > INITIAL_COUNT && (
                            <div className="mt-10 flex flex-col items-center gap-2">
                                <div className="flex items-center gap-3 text-xs text-stone-400">
                                    <div className="h-px w-16 bg-amber-100" />
                                    <span className="font-semibold text-stone-400">
                                        All {reviews.length} reviews loaded ✓
                                    </span>
                                    <div className="h-px w-16 bg-amber-100" />
                                </div>
                                <button
                                    onClick={handleAddClick}
                                    className="mt-2 flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-2.5 text-sm font-black text-white shadow-md shadow-orange-200 transition-all hover:brightness-110 active:scale-95"
                                >
                                    <MessageSquarePlus size={13} strokeWidth={2.5} />
                                    Add yours too!
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* ── Bottom CTA ─────────────────────────────────────────────── */}
            <section className="mx-auto max-w-7xl px-4 pb-14 md:px-8">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 p-8 md:p-10">
                    {/* Texture overlay */}
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.07]"
                        style={{
                            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                            backgroundSize: "20px 20px",
                        }}
                    />
                    {/* Glow blob */}
                    <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/20 blur-2xl" />

                    <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70 mb-1">
                                Your voice matters 💛
                            </p>
                            <h3 className="text-xl font-black text-white md:text-2xl">
                                Loved your order? Share it!
                            </h3>
                            <p className="mt-1.5 text-sm text-white/80 leading-relaxed max-w-md">
                                Your honest review helps other foodies discover our best dishes — and helps us serve you even better.
                            </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-3">
                            <button
                                onClick={handleAddClick}
                                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-orange-600 shadow-lg shadow-orange-700/20 transition-all hover:bg-orange-50 active:scale-95"
                            >
                                <MessageSquarePlus size={15} strokeWidth={2.5} />
                                Write a Review
                            </button>
                            <Link
                                href="/menu"
                                className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/60"
                            >
                                Explore Menu
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}