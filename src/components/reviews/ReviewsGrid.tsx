"use client";

// src/components/reviews/ReviewsGrid.tsx
// FoodKnock Reviews 2.0 — premium two-column reviews experience.
//
// Owns the whole page body below the compact header in page.tsx: the real
// desktop two-column grid (sticky rating-summary panel + review feed) and
// every piece of interactive state (write-review flow, login nudge, the
// "read more" modal, Load More). The summary panel's CTA and the feed's
// own CTAs need to open the SAME modal — keeping all of it in one client
// component avoids prop-drilling modal state across a server/client
// boundary split between two columns.
//
// Business logic preserved byte-for-byte from the previous version:
// auth check via /api/auth/me, POST /api/reviews, router.refresh() on
// success, the 10-char minimum, the rate-limited public submit endpoint.
//
// Real-data fixes this pass:
//   - Removed a fabricated "Verified" badge that previously rendered on
//     EVERY review card with zero backing data — src/models/Review.ts has
//     no purchase/order linkage at all, so there was never a real
//     verified-purchase signal to show. See src/app/(main)/reviews/
//     page.tsx's header comment for the matching `totalApproved` fix.
//   - avgRating/distribution now explicitly guarded to "No ratings yet"
//     when there are zero reviews — never a fabricated 5.0 fallback.
//   - Removed the duplicate bottom marketing CTA band (same two actions —
//     write a review / browse menu — were already offered in the summary
//     panel and feed header; a second loud gradient band repeating them
//     was decoration, not function).

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Star, MessageSquarePlus, Loader2, Send,
    CheckCircle2, LogIn, Lock, ChevronRight, Quote,
} from "lucide-react";
import Link from "next/link";
import BottomSheet from "@/components/ui/BottomSheet";
import type { PublicReview } from "@/app/(main)/reviews/page";

// ─── Avatar gradient palette — warm FoodKnock tones only ──────────────────
const AVATAR_GRADS: [string, string][] = [
    ["#ff5c1a", "#f97316"],
    ["#f97316", "#fbbf24"],
    ["#dc2626", "#f97316"],
    ["#d97706", "#fbbf24"],
    ["#ea580c", "#facc15"],
    ["#b45309", "#f59e0b"],
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

// ─── Stars — accessible, not color-only ──────────────────────────────────
function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
    return (
        <div role="img" aria-label={`${rating} out of 5 stars`} className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
                <Star
                    key={s}
                    size={size}
                    aria-hidden="true"
                    className={s <= rating ? "fill-[var(--fk-accent)] text-[var(--fk-accent)]" : "fill-fk-surface-interactive text-fk-surface-interactive"}
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
                        className="transition-transform motion-reduce:transition-none hover:scale-125 motion-reduce:hover:scale-100 active:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fk-accent)] focus-visible:ring-offset-2 rounded-fk-sm"
                        aria-label={`Rate ${s} star${s === 1 ? "" : "s"}`}
                    >
                        <Star
                            size={32}
                            aria-hidden="true"
                            className={s <= (hov || value) ? "fill-[var(--fk-accent)] text-[var(--fk-accent)]" : "fill-fk-surface-interactive text-fk-border"}
                        />
                    </button>
                ))}
            </div>
            {(hov || value) > 0 && (
                <p className="mt-2 text-sm font-bold text-[var(--fk-accent)]">{labels[hov || value]}</p>
            )}
        </div>
    );
}

// ─── Full review modal ────────────────────────────────────────────────────
// Reviews 2.1 — migrated from a hand-rolled `fixed z-50` div to the shared
// <BottomSheet> primitive. ROOT-CAUSE FIX: BottomNavigation is ALSO
// `fixed z-50` (src/components/shell/BottomNavigation.tsx) and renders
// AFTER page content in CustomerShell's DOM order — with equal z-index,
// later-in-DOM wins, so this modal (same z-50, but earlier in the tree)
// was rendering UNDERNEATH BottomNavigation. BottomSheet is portaled to
// document.body at z-[60]/z-[70], genuinely above everything else in the
// shell, fixing this at the correct shared-primitive level instead of
// picking an arbitrary bigger number here.
function ReviewModal({ review, idx, onClose }: { review: PublicReview; idx: number; onClose: () => void }) {
    const [from, to] = getGrad(idx);

    return (
        <BottomSheet open onClose={onClose} ariaLabel={`Review by ${review.userName}`}>
            <div className="flex items-center gap-4">
                <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-fk-md text-lg font-black text-white shadow-md"
                    style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
                    aria-hidden="true"
                >
                    {initials(review.userName)}
                </div>
                <div>
                    <p className="text-lg font-black text-fk-text">{review.userName}</p>
                    <div className="mt-1 flex items-center gap-2">
                        <Stars rating={review.rating} size={13} />
                        <span className="text-[11px] text-fk-text-tertiary">{timeAgo(review.createdAt)}</span>
                    </div>
                </div>
            </div>

            <div className="relative mt-5 rounded-fk-md border border-fk-border bg-fk-gold-soft p-5">
                <Quote size={18} className="mb-2 text-fk-gold" aria-hidden="true" />
                <p className="text-sm leading-7 text-fk-text-secondary">{review.comment}</p>
            </div>

            <p className="mt-3 text-right text-[11px] text-fk-text-tertiary">
                {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
        </BottomSheet>
    );
}

// ─── Add review modal ─────────────────────────────────────────────────────
// Reviews 2.1 — migrated to <BottomSheet>, same root-cause reasoning as
// ReviewModal above. ALSO fixes a second real bug: the submit button used
// to live inside the same scrollable block as the form (long comment text
// + mobile keyboard could push it out of view, with no guarantee it was
// reachable). It now lives in BottomSheet's `footer` slot, which is a
// fixed flex sibling OUTSIDE the scrollable content region (see
// src/components/ui/BottomSheet.tsx) — never scrolls away, always above
// BottomNavigation, always safe-area aware. The button submits the form
// via the standard HTML `form` attribute (same cross-DOM-distance pattern
// already used for Checkout's sticky CTA) rather than duplicating the
// submit handler.
function AddReviewModal({ userName, onClose }: { userName: string; onClose: () => void }) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [form,    setForm]    = useState({ rating: 0, comment: "" });
    const [loading, setLoading] = useState(false);
    const [done,    setDone]    = useState(false);
    const [err,     setErr]     = useState("");

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
        <BottomSheet
            open
            onClose={onClose}
            title={done ? undefined : "Write a Review"}
            ariaLabel="Write a review"
            footer={!done && (
                <button
                    type="submit"
                    form="write-review-form"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] py-3.5 text-sm font-black text-white shadow-fk-md transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <><Send size={14} strokeWidth={2.5} /> Submit Review</>}
                </button>
            )}
        >
            {done ? (
                <div className="flex flex-col items-center py-6 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-fk-lg border border-fk-success/30 bg-fk-success/10">
                        <CheckCircle2 size={32} className="text-fk-success" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-black text-fk-text">Thank you! 🎉</h3>
                    <p className="mt-2 text-sm leading-relaxed text-fk-text-secondary">
                        Your review is now live on FoodKnock. We truly appreciate your feedback!
                    </p>
                    <button
                        onClick={onClose}
                        className="mt-6 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-8 py-3 text-sm font-black text-white shadow-fk-md transition-all hover:brightness-110"
                    >
                        Awesome, done!
                    </button>
                </div>
            ) : (
                <>
                    <div className="mb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-fk-md bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] shadow-sm">
                                <MessageSquarePlus size={18} className="text-white" strokeWidth={2} />
                            </div>
                            <p className="text-xs text-fk-text-tertiary">
                                Posting as <span className="font-bold text-fk-text-secondary">{userName}</span> — your honest words help other foodies decide.
                            </p>
                        </div>
                    </div>

                    <form id="write-review-form" onSubmit={submit} noValidate className="space-y-5">
                        <div>
                            <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-fk-text-tertiary">
                                How was your experience? *
                            </p>
                            <StarInput value={form.rating} onChange={(n) => setForm((f) => ({ ...f, rating: n }))} />
                        </div>

                        <div>
                            <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-fk-text-tertiary">
                                Tell us more *
                            </p>
                            <textarea
                                value={form.comment}
                                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                                placeholder="How was the food, delivery, taste? Tell us honestly…"
                                rows={4}
                                maxLength={500}
                                aria-invalid={!!err}
                                className="w-full resize-none rounded-fk-md border border-fk-border bg-fk-surface-interactive px-4 py-3 text-sm text-fk-text placeholder:text-fk-text-tertiary transition-all focus:border-[var(--fk-accent)] focus:bg-fk-surface-elevated focus:outline-none focus:ring-2 focus:ring-[var(--fk-accent)]/15"
                            />
                            <p className="mt-1 text-right text-[10px] text-fk-text-tertiary">{form.comment.length}/500</p>
                        </div>

                        {err && (
                            <div role="alert" className="rounded-fk-md border border-fk-danger/30 bg-fk-danger/10 px-4 py-2.5 text-xs font-semibold text-fk-danger">
                                {err}
                            </div>
                        )}
                    </form>
                </>
            )}
        </BottomSheet>
    );
}

// ─── Login nudge modal ────────────────────────────────────────────────────
function LoginNudgeModal({ onClose }: { onClose: () => void }) {
    return (
        <BottomSheet open onClose={onClose} ariaLabel="Sign in to write a review">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-fk-lg border border-fk-border bg-fk-gold-soft">
                    <Lock size={28} className="text-fk-gold" strokeWidth={1.8} />
                </div>
                <h3 className="text-xl font-black text-fk-text">Join the FoodKnock family 🍕</h3>
                <p className="mt-2 text-sm leading-relaxed text-fk-text-secondary">
                    Sign in to share your food experience with fellow foodies!
                </p>

                <div className="mt-6 flex gap-3">
                    <Link
                        href="/auth?mode=login"
                        className="flex flex-1 items-center justify-center gap-2 rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] py-3 text-sm font-black text-white shadow-fk-md transition-all hover:brightness-110"
                    >
                        <LogIn size={14} strokeWidth={2.5} /> Sign In
                    </Link>
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-fk-md border border-fk-border bg-fk-surface-selected py-3 text-sm font-semibold text-fk-text-secondary transition-all hover:bg-fk-surface-interactive"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </BottomSheet>
    );
}

// ─── Single review card — real fields only ────────────────────────────────
// No "Verified" badge — src/models/Review.ts has no purchase/order
// linkage, so there is no real signal to back that claim with. See file
// header comment.
function ReviewCard({ review, idx, onExpand }: { review: PublicReview; idx: number; onExpand: () => void }) {
    const [from, to] = getGrad(idx);
    const { preview, isTruncated } = truncateWords(review.comment);

    return (
        // Reviews 2.2 — redesigned for 2-column mobile (spec: mobile MUST
        // show 2 columns, so cards are now genuinely narrow — ~155-185px at
        // 360-412px viewports — not a shrunk single-column desktop card).
        // Avatar+name on row 1, time+stars on row 2 (stars no longer forced
        // onto the same cramped row as the name) — matches the spec's own
        // mobile mockup. `min-h` + flex + a reserved bottom slot (same
        // reasoning as before) keep every card the same footprint
        // regardless of comment length.
        <article className="flex h-full min-h-[146px] flex-col rounded-fk-md border border-fk-border bg-fk-surface-elevated p-3 shadow-sm transition-all duration-150 motion-reduce:transition-none hover:border-[var(--fk-accent)]/30 hover:shadow-md sm:min-h-[168px] sm:rounded-fk-lg sm:p-4">
            <div className="flex items-center gap-2">
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm text-xs font-black text-white shadow-sm sm:h-10 sm:w-10 sm:rounded-fk-md sm:text-sm"
                    style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
                    aria-hidden="true"
                >
                    {initials(review.userName)}
                </div>
                <p className="min-w-0 flex-1 truncate text-[13px] font-black text-fk-text sm:text-sm">{review.userName}</p>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-semibold text-fk-text-tertiary">{timeAgo(review.createdAt)}</span>
                <Stars rating={review.rating} size={14} />
            </div>

            <p className="mt-2 flex-1 text-[12.5px] leading-5 text-fk-text-secondary sm:text-[13px] sm:leading-6">{preview}</p>

            <div className="mt-1 h-4 sm:h-5">
                {isTruncated && (
                    <button
                        onClick={onExpand}
                        className="flex items-center gap-0.5 text-[10.5px] font-bold text-[var(--fk-accent)] transition-colors hover:brightness-110 sm:text-[12px]"
                    >
                        Read more <ChevronRight size={11} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                )}
            </div>
        </article>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────
// No loading skeleton gates this — `reviews` arrives fully resolved via
// SSR (src/app/(main)/reviews/page.tsx is a server component), so by the
// time this component mounts, "zero reviews" is already a known, final
// fact, not a pending fetch. A skeleton here would falsely imply more
// data might still arrive.
function EmptyState({ onWrite, disabled }: { onWrite: () => void; disabled: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-6 py-16 text-center shadow-sm">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-fk-lg bg-fk-gold-soft">
                <Star size={26} className="text-fk-gold" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-black text-fk-text">No reviews yet</h3>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-fk-text-secondary">
                FoodKnock&apos;s first review could be yours.
            </p>
            <button
                onClick={onWrite}
                disabled={disabled}
                className="mt-6 flex items-center gap-2 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-6 py-3 text-sm font-black text-white shadow-fk-md transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <MessageSquarePlus size={15} strokeWidth={2.5} />
                Share Your Experience
            </button>
        </div>
    );
}

// ─── Constants ────────────────────────────────────────────────────────────
const INITIAL_COUNT = 9;
const LOAD_MORE_COUNT = 6;

// ─── Main exported component ──────────────────────────────────────────────
export default function ReviewsGrid({ reviews, totalApproved }: { reviews: PublicReview[]; totalApproved: number }) {
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

    const hasReviews = reviews.length > 0;
    const avgNum = hasReviews ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    const avgRating = avgNum.toFixed(1);
    const breakdown = [5, 4, 3, 2, 1].map((star) => {
        const count = reviews.filter((r) => r.rating === star).length;
        return { star, pct: hasReviews ? Math.round((count / reviews.length) * 100) : 0, count };
    });

    const visibleReviews = reviews.slice(0, visibleCount);
    const hasMore        = visibleCount < reviews.length;
    const remaining      = reviews.length - visibleCount;

    return (
        <>
            {expanded && <ReviewModal review={expanded.review} idx={expanded.idx} onClose={() => setExpanded(null)} />}
            {showAdd && loggedUser && <AddReviewModal userName={loggedUser} onClose={() => setShowAdd(false)} />}
            {showLogin && <LoginNudgeModal onClose={() => setShowLogin(false)} />}

            {/* Reviews 2.2 — layout correction. The previous "0.8fr sidebar +
                1.6fr feed" grid left a tall empty gap under the (compact)
                summary card whenever the feed grew taller than it — a
                sidebar fundamentally doesn't grow to match adjacent content.
                Replaced with a single-column page flow: one WIDE overview
                bar (uses the full content width — no more lonely sidebar),
                then a review grid that spans the whole width too. Nothing
                about the real numbers changed, only how they're arranged. */}
            <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8 md:py-8">

                {/* ── Wide rating overview — avg | distribution | CTA ── */}
                <div className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
                        {hasReviews ? (
                            <div className="flex shrink-0 items-center gap-4">
                                <div>
                                    <p className="text-3xl font-black leading-none text-fk-text">{avgRating}</p>
                                    <p className="mt-0.5 text-[10px] font-semibold text-fk-text-tertiary">out of 5</p>
                                </div>
                                <div>
                                    <Stars rating={Math.round(avgNum)} size={14} />
                                    <p className="mt-1 text-[11px] font-semibold text-fk-text-tertiary">
                                        {totalApproved} review{totalApproved !== 1 ? "s" : ""}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex shrink-0 items-center gap-3">
                                <Star size={22} className="text-fk-gold" aria-hidden="true" />
                                <div>
                                    <p className="text-sm font-bold text-fk-text">No ratings yet</p>
                                    <p className="text-[11px] text-fk-text-tertiary">Be the first to share your experience.</p>
                                </div>
                            </div>
                        )}

                        {/* Distribution — now uses the full available width
                            instead of being squeezed into a narrow sidebar. */}
                        {hasReviews ? (
                            <div className="min-w-0 flex-1 space-y-1">
                                {breakdown.map(({ star, pct, count }) => (
                                    <div key={star} className="flex items-center gap-2">
                                        <span className="w-2 shrink-0 text-right text-[10px] font-black text-fk-text-secondary">{star}</span>
                                        <Star size={8} className="shrink-0 fill-[var(--fk-accent)] text-[var(--fk-accent)]" aria-hidden="true" />
                                        <div className="h-1 flex-1 overflow-hidden rounded-full border border-fk-border bg-fk-surface-interactive">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] transition-all duration-500 motion-reduce:transition-none"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="w-4 shrink-0 text-right text-[9px] font-semibold text-fk-text-tertiary">{count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="min-w-0 flex-1" />
                        )}

                        <button
                            onClick={handleAddClick}
                            disabled={!authChecked}
                            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-5 py-2.5 text-[13px] font-black text-white shadow-fk-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                        >
                            <MessageSquarePlus size={15} strokeWidth={2.5} aria-hidden="true" />
                            Share Your Experience
                        </button>
                    </div>
                </div>

                {/* ── Section header ── */}
                <div className="mb-3 mt-5 flex items-center justify-between">
                    <h2 className="text-base font-black text-fk-text">Customer Reviews</h2>
                    {hasReviews && (
                        <span className="rounded-fk-pill border border-fk-border bg-fk-surface-selected px-3 py-1 text-[11px] font-bold text-fk-text-secondary">
                            {totalApproved} review{totalApproved !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>

                {/* ── Review feed — full page width, 2 cols mobile/tablet,
                    3 cols desktop (spec: mobile MUST be 2 columns, not 1) ── */}
                {!hasReviews ? (
                    <EmptyState onWrite={handleAddClick} disabled={!authChecked} />
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
                            {visibleReviews.map((review, i) => (
                                <ReviewCard
                                    key={review._id}
                                    review={review}
                                    idx={i}
                                    onExpand={() => setExpanded({ review, idx: i })}
                                />
                            ))}
                        </div>

                        {hasMore && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
                                    className="flex items-center gap-2 rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-6 py-3 text-sm font-bold text-fk-text-secondary shadow-sm transition-all hover:border-[var(--fk-accent)]/40 hover:text-[var(--fk-accent)] active:scale-95"
                                >
                                    Load {Math.min(remaining, LOAD_MORE_COUNT)} more reviews
                                </button>
                            </div>
                        )}

                        {!hasMore && reviews.length > INITIAL_COUNT && (
                            <p className="mt-6 text-center text-xs font-semibold text-fk-text-tertiary">
                                You&apos;re all caught up — all {reviews.length} loaded reviews shown.
                            </p>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
