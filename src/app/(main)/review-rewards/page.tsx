"use client";
export const dynamic = "force-dynamic";

// src/app/(main)/review-reward/page.tsx
// FoodKnock — Instagram Review Reward
// Post a reel → get a free burger 🍔
//
// Final customer-pages polish — full rewrite of the PRESENTATION layer
// only. Every piece of business logic is byte-for-byte unchanged from the
// previous version: the Instagram-URL regex, the STEPS copy, handleSubmit,
// the status/approved-reviews fetch effect, and all real data shapes
// (Submission/ApprovedReview). What changed:
//   1. Restyled from a one-off pink/rose/stone palette + Playfair Display
//      to FoodKnock's locked `--fk-*` light design system (orange/gold/
//      charcoal), matching the rest of the redesigned customer app.
//   2. Trimmed the hero from 3 stacked decorative blur layers + a large
//      serif headline to one subtle gradient band — "premium does not
//      mean tall" (spec §25).
//   3. Restructured the body into a genuine two-column layout at lg+:
//      LEFT = content + action (how it works, the submission form),
//      RIGHT = status + reward information (sticky). Below both: the
//      real-data social-proof wall and FAQ, full width. On mobile this
//      collapses to one deliberately ordered column (hero → how it
//      works → status/reward → action → supporting info), not a blind
//      shrink of the desktop grid.
//   4. Added a RewardInfoCard for the right column's "nothing submitted
//      yet" state — this reuses the SAME real copy already on the page
//      (the hero chips / StatusCard's own approved-state message
//      template), not a new invented claim.

import { useEffect, useRef, useState } from "react";
import Footer from "@/components/shared/Footer";
import Link   from "next/link";
import {
    Instagram, Gift, CheckCircle2, Clock, XCircle,
    ExternalLink, ArrowRight, Loader2, AlertTriangle,
    Play, Sparkles,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Submission = {
    status:        "pending" | "approved" | "rejected";
    rewardItem:    string;
    rewardUsed:    boolean;
    instagramLink: string;
    submittedAt:   string;
};

type ApprovedReview = {
    id:            string;
    userName:      string;
    instagramLink: string;
    rewardItem:    string;
    approvedAt:    string;
};

// ─── Instagram URL validator ──────────────────────────────────────────────────
const INSTAGRAM_RE =
    /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+\/?(\?.*)?$/i;

// ─── Steps list ──────────────────────────────────────────────────────────────
const STEPS = [
    { emoji: "📱", title: "Post a Reel",   desc: "Upload a genuine video review of FoodKnock on Instagram."                   },
    { emoji: "🔗", title: "Submit Link",   desc: "Paste your reel link below and hit Submit."                                   },
    { emoji: "✅", title: "Get Verified",  desc: "Our team reviews it within 24 hrs — no fake reviews, only real ones."         },
    { emoji: "🍔", title: "Free Item!",   desc: "Approved? Your next order (₹150+) gets a FREE Burger automatically added."     },
];

// ─── Status card (right column — real submission status) ────────────────────
function StatusCard({ sub }: { sub: Submission }) {
    const isPending  = sub.status === "pending";
    const isApproved = sub.status === "approved";
    const isUsed     = sub.rewardUsed;

    const cfg = isApproved && !isUsed
        ? { bg: "bg-fk-success/10", border: "border-fk-success/30", icon: <CheckCircle2 size={22} className="text-fk-success" />, title: "Reward Ready! 🎉", sub: `Your FREE ${sub.rewardItem === "pizza" ? "Pizza 🍕" : "Burger 🍔"} will be added automatically on your next order (₹150+).` }
        : isApproved && isUsed
        ? { bg: "bg-fk-surface-selected", border: "border-fk-border",   icon: <CheckCircle2 size={22} className="text-fk-text-tertiary" />, title: "Reward Used ✓",   sub: "You've already redeemed your free item. Thanks for the love!" }
        : isPending
        ? { bg: "bg-fk-gold-soft",        border: "border-fk-gold/30",  icon: <Clock size={22} className="text-fk-gold" />, title: "Under Review 🔍",  sub: "We've received your submission! Verification usually takes 24 hours."   }
        : { bg: "bg-fk-danger/10",        border: "border-fk-danger/30", icon: <XCircle size={22} className="text-fk-danger" />, title: "Not Approved",    sub: "This submission was rejected. Make sure your reel is publicly visible and clearly features FoodKnock." };

    return (
        <div className={`rounded-fk-lg border ${cfg.border} ${cfg.bg} p-5`}>
            <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-fk-md border ${cfg.border} bg-fk-surface-elevated`}>
                    {cfg.icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-black text-fk-text">{cfg.title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-fk-text-secondary">{cfg.sub}</p>
                    {sub.instagramLink && (
                        <a href={sub.instagramLink} target="_blank" rel="noopener noreferrer"
                           className="mt-2.5 inline-flex items-center gap-1.5 rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-3 py-1 text-[11px] font-bold text-[var(--fk-accent)] transition-colors hover:bg-fk-surface-selected">
                            <Instagram size={11} /> View your reel
                            <ExternalLink size={10} />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Reward info card (right column — before any submission exists) ─────────
// Purely a restatement of real copy that already exists elsewhere on this
// page (hero chips, StatusCard's own approved-state template) — no new
// claim is introduced here.
function RewardInfoCard() {
    return (
        <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
            <div className="border-b border-fk-border bg-fk-surface-selected px-5 py-4">
                <p className="text-[13px] font-black text-fk-text">Your Reward</p>
                <p className="text-[11px] text-fk-text-secondary">What you get once approved</p>
            </div>
            <div className="space-y-3 p-5">
                <div className="flex items-start gap-3 rounded-fk-md border border-fk-border bg-fk-gold-soft px-4 py-3">
                    <Gift size={18} className="mt-0.5 shrink-0 text-[var(--fk-accent)]" />
                    <div>
                        <p className="text-[13px] font-black text-fk-text">Free Burger 🍔</p>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-fk-text-secondary">
                            Added automatically to your next order of ₹150+ once your reel is approved.
                        </p>
                    </div>
                </div>
                {[
                    { icon: <CheckCircle2 size={14} className="text-fk-success" />, text: "Verified within 24 hrs" },
                    { icon: <Sparkles size={14} className="text-[var(--fk-accent)]" />, text: "One reward per account" },
                ].map((r) => (
                    <div key={r.text} className="flex items-center gap-2.5 px-1">
                        {r.icon}
                        <p className="text-[12.5px] font-semibold text-fk-text-secondary">{r.text}</p>
                    </div>
                ))}
                <p className="pt-1 text-[11px] leading-relaxed text-fk-text-tertiary">
                    Submit your reel below — once it&apos;s in review, your real status will appear right here.
                </p>
            </div>
        </div>
    );
}

// ─── Approved reviews wall (real data only) ──────────────────────────────────
function ReviewWall({ reviews }: { reviews: ApprovedReview[] }) {
    if (!reviews.length) return null;
    return (
        <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--fk-accent)]">Real Reviews</p>
                    <h2 className="text-lg font-black text-fk-text">FoodKnock Fans on Instagram</h2>
                </div>
                <div className="flex items-center gap-1.5 rounded-fk-pill border border-fk-border bg-fk-surface-selected px-3 py-1.5">
                    <Instagram size={13} className="text-[var(--fk-accent)]" />
                    <span className="text-[11px] font-black text-fk-text">{reviews.length} reels</span>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reviews.map((r) => (
                    <a key={r.id} href={r.instagramLink} target="_blank" rel="noopener noreferrer"
                       className="group flex flex-col overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm transition-all duration-150 hover:border-[var(--fk-accent)]/30 hover:shadow-md">
                        <div className="relative flex h-24 items-center justify-center overflow-hidden bg-fk-gold-soft">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-fk-border bg-fk-surface-elevated/90 shadow-md transition-transform duration-150 group-hover:scale-110">
                                <Play size={18} className="ml-0.5 text-[var(--fk-accent)]" fill="currentColor" />
                            </div>
                            <span className="absolute right-2.5 top-2.5 rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-2 py-0.5 text-[9px] font-black text-[var(--fk-accent)]">
                                REEL
                            </span>
                        </div>

                        <div className="flex flex-1 items-center justify-between gap-2 px-4 py-3">
                            <div className="min-w-0">
                                <p className="truncate text-[13px] font-black text-fk-text">{r.userName}</p>
                                <p className="mt-0.5 text-[10px] text-fk-text-tertiary">
                                    Got Free {r.rewardItem === "pizza" ? "Pizza 🍕" : "Burger 🍔"}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--fk-accent)]">
                                Watch <ExternalLink size={10} />
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </section>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ReviewRewardPage() {
    const [link,        setLink]        = useState("");
    const [submitting,  setSubmitting]  = useState(false);
    const [error,       setError]       = useState("");
    const [success,     setSuccess]     = useState(false);
    const [submission,  setSubmission]  = useState<Submission | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [reviews,     setReviews]     = useState<ApprovedReview[]>([]);
    const fetched = useRef(false);

    // ── Load user status + approved reviews — UNCHANGED ──────────────────
    useEffect(() => {
        if (fetched.current) return;
        fetched.current = true;

        Promise.all([
            fetch("/api/review-reward/status",   { credentials: "include" }).then(r => r.json()).catch(() => ({})),
            fetch("/api/review-reward/approved").then(r => r.json()).catch(() => ({ reviews: [] })),
        ]).then(([statusData, approvedData]) => {
            if (statusData?.submission) setSubmission(statusData.submission);
            if (approvedData?.reviews)  setReviews(approvedData.reviews);
        }).finally(() => setLoadingStatus(false));
    }, []);

    // ── Submit handler — UNCHANGED ────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!link.trim()) { setError("Please enter your Instagram reel link."); return; }
        if (!INSTAGRAM_RE.test(link.trim())) {
            setError("Please enter a valid Instagram reel URL (e.g. https://www.instagram.com/reel/ABC123/)");
            return;
        }

        setSubmitting(true);
        try {
            const res  = await fetch("/api/review-reward/submit", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body:    JSON.stringify({ instagramLink: link.trim() }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.message || "Submission failed. Please try again.");
            } else {
                setSuccess(true);
                setSubmission({
                    status:        "pending",
                    rewardItem:    "burger",
                    rewardUsed:    false,
                    instagramLink: link.trim(),
                    submittedAt:   new Date().toISOString(),
                });
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const alreadySubmitted = !!submission;
    const showForm = !loadingStatus && !alreadySubmitted && !success;

    return (
        <>
            <main className="min-h-screen bg-fk-bg">

                {/* ── Compact hero ── */}
                <section className="relative overflow-hidden border-b border-fk-border bg-fk-surface-elevated">
                    <div className="pointer-events-none absolute inset-0"
                         style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, var(--fk-gold-soft) 0%, transparent 70%)" }} />
                    <div className="relative mx-auto max-w-6xl px-4 py-8 text-center md:px-8 md:py-10">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-fk-pill border border-fk-border bg-fk-surface-selected px-4 py-1.5">
                            <Instagram size={13} className="text-[var(--fk-accent)]" />
                            <span className="text-[10.5px] font-black uppercase tracking-[0.22em] text-[var(--fk-accent)]">
                                Instagram Review Reward
                            </span>
                        </div>

                        <h1 className="text-2xl font-black leading-tight text-fk-text md:text-3xl">
                            Post a Reel, Eat for Free <span aria-hidden="true">🍔</span>
                        </h1>

                        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-fk-text-secondary">
                            Share your honest FoodKnock experience on Instagram and we&apos;ll add a{" "}
                            <span className="font-black text-[var(--fk-accent)]">FREE Burger</span> to your next order.
                        </p>

                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                            {[
                                { icon: "🎁", text: "Free Burger on Next Order" },
                                { icon: "✅", text: "Verified within 24 hrs" },
                                { icon: "💯", text: "One reward per account" },
                            ].map((b) => (
                                <span key={b.text} className="flex items-center gap-1.5 rounded-fk-pill border border-fk-border bg-fk-surface-selected px-3 py-1 text-[11px] font-bold text-fk-text-secondary">
                                    <span>{b.icon}</span>{b.text}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Body — genuine 2-column at lg+, deliberate mobile order ── */}
                <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
                    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">

                        {/* LEFT — content + action */}
                        <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1">
                            <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
                                <div className="border-b border-fk-border bg-fk-surface-selected px-5 py-4">
                                    <p className="text-[13px] font-black text-fk-text">How it works</p>
                                    <p className="text-[11px] text-fk-text-secondary">4 simple steps to your free item</p>
                                </div>
                                <div className="grid gap-px bg-fk-border sm:grid-cols-4">
                                    {STEPS.map((s, i) => (
                                        <div key={i} className="flex flex-col gap-2 bg-fk-surface-elevated px-4 py-4">
                                            <span className="text-2xl">{s.emoji}</span>
                                            <p className="text-[12px] font-black text-fk-text">{s.title}</p>
                                            <p className="text-[11px] leading-relaxed text-fk-text-secondary">{s.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {showForm && (
                                <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
                                    <div className="border-b border-fk-border bg-fk-surface-selected px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-fk-md bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] shadow-sm">
                                                <Instagram size={18} className="text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-black text-fk-text">Submit Your Instagram Reel</p>
                                                <p className="text-[11px] text-fk-text-secondary">Paste the link to your FoodKnock review reel</p>
                                            </div>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-4 p-5">
                                        <div className="space-y-1.5 rounded-fk-md border border-fk-border bg-fk-gold-soft px-4 py-3">
                                            <p className="text-[11px] font-black text-fk-text">Before you submit, make sure:</p>
                                            {[
                                                "Your reel is publicly visible (not private)",
                                                "FoodKnock is clearly visible in the video",
                                                "Link format: instagram.com/reel/... or instagram.com/p/...",
                                            ].map((t) => (
                                                <div key={t} className="flex items-start gap-2">
                                                    <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-[var(--fk-accent)]" />
                                                    <p className="text-[11px] text-fk-text-secondary">{t}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[11px] font-black uppercase tracking-[0.18em] text-fk-text-secondary">
                                                Instagram Reel Link <span className="text-[var(--fk-accent)]">*</span>
                                            </label>
                                            <div className="relative flex items-center">
                                                <Instagram size={15} strokeWidth={2} className="pointer-events-none absolute left-3.5 text-fk-text-tertiary" />
                                                <input
                                                    type="url"
                                                    value={link}
                                                    onChange={(e) => { setLink(e.target.value); setError(""); }}
                                                    placeholder="https://www.instagram.com/reel/ABC123/"
                                                    aria-invalid={!!error}
                                                    className={`w-full rounded-fk-md border bg-fk-surface-interactive py-3.5 pl-10 pr-4 text-sm font-medium text-fk-text placeholder:text-fk-text-tertiary transition-all focus:bg-fk-surface-elevated focus:outline-none focus:ring-2 ${
                                                        error
                                                            ? "border-fk-danger focus:border-fk-danger focus:ring-fk-danger/15"
                                                            : "border-fk-border focus:border-[var(--fk-accent)] focus:ring-[var(--fk-accent)]/15"
                                                    }`}
                                                />
                                            </div>
                                            {error && (
                                                <div className="flex items-start gap-2 rounded-fk-md border border-fk-danger/30 bg-fk-danger/10 px-3 py-2">
                                                    <AlertTriangle size={12} className="mt-0.5 shrink-0 text-fk-danger" />
                                                    <p className="text-[11px] font-semibold text-fk-danger">{error}</p>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="group flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-fk-lg bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] py-4 text-[15px] font-black text-white shadow-fk-md transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            {submitting
                                                ? <><Loader2 size={17} className="animate-spin" /> Submitting…</>
                                                : <><Gift size={17} strokeWidth={2.5} /> Submit &amp; Claim Free Burger</>}
                                        </button>

                                        <p className="text-center text-[10.5px] text-fk-text-tertiary">
                                            By submitting you agree that the review is genuine and the reel is publicly visible.
                                        </p>
                                    </form>
                                </div>
                            )}
                        </div>

                        {/* RIGHT — status + reward info (sticky on desktop) */}
                        <div className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-24 lg:self-start">
                            {loadingStatus ? (
                                <div className="flex items-center justify-center rounded-fk-lg border border-fk-border bg-fk-surface-elevated py-16">
                                    <Loader2 size={24} className="animate-spin text-[var(--fk-accent)]" />
                                </div>
                            ) : alreadySubmitted ? (
                                <div className="space-y-3">
                                    <StatusCard sub={submission!} />
                                    {submission?.status !== "rejected" && (
                                        <div className="rounded-fk-md border border-fk-border bg-fk-surface-selected px-4 py-3">
                                            <p className="text-[11.5px] text-fk-text-secondary">
                                                Each account can submit once. Questions?{" "}
                                                <Link href="/contact" className="font-bold text-[var(--fk-accent)] hover:underline">
                                                    Contact us
                                                </Link>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : success ? (
                                <div className="overflow-hidden rounded-fk-lg border border-fk-success/30 bg-fk-success/10 p-6 text-center shadow-sm">
                                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-fk-md border border-fk-success/30 bg-fk-surface-elevated shadow-sm">
                                        <CheckCircle2 size={28} className="text-fk-success" />
                                    </div>
                                    <h3 className="text-lg font-black text-fk-text">Submitted Successfully! 🎉</h3>
                                    <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-fk-text-secondary">
                                        Your review is under verification. Once approved, a{" "}
                                        <span className="font-black text-[var(--fk-accent)]">FREE Burger 🍔</span> will be
                                        automatically added to your next order of ₹150+.
                                    </p>
                                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                                        <Link href="/menu"
                                              className="flex items-center gap-2 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-5 py-2.5 text-[13px] font-black text-white shadow-fk-md transition-all hover:brightness-110 active:scale-95">
                                            Browse Menu <ArrowRight size={13} />
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <RewardInfoCard />
                            )}
                        </div>
                    </div>

                    {/* ── Supporting info — full width ── */}
                    <ReviewWall reviews={reviews} />

                    <div className="mt-8 space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-fk-text-tertiary">FAQ</p>
                        {[
                            { q: "How long does verification take?",  a: "Usually within 24 hours. We check that the reel is genuine and publicly visible." },
                            { q: "Which item is free?",                a: "A Free Burger (₹0) is automatically added to your cart on your next order of ₹150+." },
                            { q: "Can I choose Free Pizza instead?",   a: "By default it's a burger — the admin can switch it to pizza when approving." },
                            { q: "What if my reel gets rejected?",     a: "Make sure your reel is public and clearly shows FoodKnock. Contact us if you think it was a mistake." },
                        ].map((f, i) => (
                            <div key={i} className="rounded-fk-md border border-fk-border bg-fk-surface-elevated px-4 py-3.5">
                                <p className="text-[12.5px] font-black text-fk-text">{f.q}</p>
                                <p className="mt-1 text-[11.5px] text-fk-text-secondary">{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
