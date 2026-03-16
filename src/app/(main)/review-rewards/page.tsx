"use client";
export const dynamic = "force-dynamic";


// src/app/(main)/review-reward/page.tsx
// FoodKnock — Instagram Review Reward
// Warm ember palette · Playfair Display · mobile-first
// Post a reel → get a free burger 🍔

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import Link   from "next/link";
import {
    Instagram, Gift, CheckCircle2, Clock, XCircle,
    ExternalLink, ArrowRight, Loader2, AlertTriangle,
    Star, Flame, Play,
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

// ─── Status card ─────────────────────────────────────────────────────────────
function StatusCard({ sub }: { sub: Submission }) {
    const isPending  = sub.status === "pending";
    const isApproved = sub.status === "approved";
    const isRejected = sub.status === "rejected";
    const isUsed     = sub.rewardUsed;

    const cfg = isApproved && !isUsed
        ? { bg: "from-emerald-50 to-green-50", border: "border-emerald-200", icon: <CheckCircle2 size={22} className="text-emerald-500" />, title: "Reward Ready! 🎉", sub: `Your FREE ${sub.rewardItem === "pizza" ? "Pizza 🍕" : "Burger 🍔"} will be added automatically on your next order (₹150+).` }
        : isApproved && isUsed
        ? { bg: "from-stone-50 to-slate-50",   border: "border-stone-200",   icon: <CheckCircle2 size={22} className="text-stone-400"   />, title: "Reward Used ✓",   sub: "You've already redeemed your free item. Thanks for the love!" }
        : isPending
        ? { bg: "from-amber-50 to-orange-50",  border: "border-amber-200",   icon: <Clock size={22} className="text-amber-500"       />, title: "Under Review 🔍",  sub: "We've received your submission! Verification usually takes 24 hours."   }
        : { bg: "from-rose-50  to-red-50",     border: "border-rose-200",    icon: <XCircle size={22} className="text-rose-500"        />, title: "Not Approved",    sub: "This submission was rejected. Make sure your reel is publicly visible and clearly features FoodKnock." };

    return (
        <div className={`rounded-3xl border ${cfg.border} bg-gradient-to-br ${cfg.bg} p-5`}>
            <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${cfg.border} bg-white`}>
                    {cfg.icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-black text-stone-900">{cfg.title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-stone-600">{cfg.sub}</p>
                    {sub.instagramLink && (
                        <a href={sub.instagramLink} target="_blank" rel="noopener noreferrer"
                           className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-white px-3 py-1 text-[11px] font-bold text-pink-600 transition-colors hover:bg-pink-50">
                            <Instagram size={11} /> View your reel
                            <ExternalLink size={10} />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Approved reviews wall ───────────────────────────────────────────────────
function ReviewWall({ reviews }: { reviews: ApprovedReview[] }) {
    if (!reviews.length) return null;
    return (
        <section className="mt-12">
            {/* Section header */}
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-500">Real Reviews</p>
                    <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif" }}
                        className="text-xl font-black text-stone-900">
                        FoodKnock Fans on Instagram
                    </h2>
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl border border-pink-100 bg-pink-50 px-3 py-2">
                    <Instagram size={13} className="text-pink-500" />
                    <span className="text-[11px] font-black text-pink-600">{reviews.length} reels</span>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reviews.map((r) => (
                    <a key={r.id} href={r.instagramLink} target="_blank" rel="noopener noreferrer"
                       className="group flex flex-col overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition-all duration-200 hover:border-pink-200 hover:shadow-md hover:shadow-pink-50">
                        {/* Gradient thumb */}
                        <div className="relative flex h-28 items-center justify-center overflow-hidden"
                             style={{ background:"linear-gradient(135deg,#f43f5e15,#ec489920,#a855f715)" }}>
                            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-pink-200/60 bg-white/80 shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                                <Play size={22} className="ml-1 text-pink-500" fill="currentColor" />
                            </div>
                            <div className="pointer-events-none absolute inset-0"
                                 style={{ background:"linear-gradient(to bottom,transparent 60%,rgba(0,0,0,0.08))" }} />
                            <span className="absolute right-3 top-3 rounded-full border border-pink-200 bg-white px-2 py-0.5 text-[9px] font-black text-pink-600">
                                REEL
                            </span>
                        </div>

                        <div className="flex flex-1 items-center justify-between gap-2 px-4 py-3">
                            <div className="min-w-0">
                                <p className="truncate text-[13px] font-black text-stone-800">{r.userName}</p>
                                <p className="mt-0.5 text-[10px] text-stone-400">
                                    Got Free {r.rewardItem === "pizza" ? "Pizza 🍕" : "Burger 🍔"}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-pink-500">
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

    // ── Load user status + approved reviews ──────────────────────────────
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

    return (
        <>
            <Navbar />
            <main className="min-h-screen" style={{ background:"#FFFBF5" }}>

                {/* ══════════════════════════════════════
                    HERO
                ══════════════════════════════════════ */}
                <section className="relative overflow-hidden">
                    <div className="absolute inset-0"
                         style={{ background:"linear-gradient(160deg,#fff0f3 0%,#fff7ed 45%,#fff9f4 100%)" }} />
                    <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
                         style={{ backgroundImage:"radial-gradient(circle,#9d174d 1px,transparent 1px)", backgroundSize:"22px 22px" }} />
                    <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-20 blur-3xl"
                         style={{ background:"radial-gradient(circle,#ec4899,transparent 70%)" }} />
                    <div className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full opacity-10 blur-3xl"
                         style={{ background:"radial-gradient(circle,#f97316,transparent 70%)" }} />

                    <div className="relative mx-auto max-w-3xl px-4 pb-8 pt-10 text-center md:px-8 md:pb-10 md:pt-14">

                        {/* Eyebrow */}
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white px-4 py-1.5 shadow-sm">
                            <Instagram size={13} className="text-pink-500" />
                            <span className="text-[10.5px] font-black uppercase tracking-[0.24em] text-pink-600">
                                Instagram Review Reward
                            </span>
                        </div>

                        {/* Headline */}
                        <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif" }}
                            className="text-[2rem] font-black leading-[1.07] tracking-tight text-stone-900 md:text-5xl">
                            Post a Reel,{" "}
                            <span style={{
                                background:"linear-gradient(135deg,#ec4899 0%,#f97316 60%,#dc2626 100%)",
                                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                            }}>
                                Eat for Free
                            </span>
                            <span className="ml-2">🍔</span>
                        </h1>

                        <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-stone-500">
                            Share your honest FoodKnock experience on Instagram and we'll add a{" "}
                            <span className="font-black text-orange-600">FREE Burger</span> to your next order.
                            Zero catches. Just real love for real reviews.
                        </p>

                        {/* Chips */}
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                            {[
                                { icon:"🎁", text:"Free Burger on Next Order",     c:"bg-orange-50 border-orange-200 text-orange-700"  },
                                { icon:"✅", text:"Verified within 24 hrs",        c:"bg-emerald-50 border-emerald-200 text-emerald-700"},
                                { icon:"💯", text:"One reward per account",        c:"bg-pink-50 border-pink-200 text-pink-700"         },
                            ].map(b => (
                                <span key={b.text} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${b.c}`}>
                                    <span>{b.icon}</span>{b.text}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════
                    BODY
                ══════════════════════════════════════ */}
                <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-10">

                    {/* ── How it works ── */}
                    <div className="mb-8 overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
                        <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50/70 to-pink-50/40 px-5 py-4">
                            <p className="text-[13px] font-black text-stone-900">How it works</p>
                            <p className="text-[11px] text-stone-500">4 simple steps to your free item</p>
                        </div>
                        <div className="grid gap-px bg-stone-100 sm:grid-cols-4">
                            {STEPS.map((s, i) => (
                                <div key={i} className="flex flex-col gap-2 bg-white px-4 py-4">
                                    <span className="text-2xl">{s.emoji}</span>
                                    <p className="text-[12px] font-black text-stone-900">{s.title}</p>
                                    <p className="text-[11px] leading-relaxed text-stone-500">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Submission / status area ── */}
                    {loadingStatus ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={28} className="animate-spin text-orange-400" />
                        </div>
                    ) : alreadySubmitted ? (
                        <div className="space-y-4">
                            <StatusCard sub={submission!} />
                            {submission?.status !== "rejected" && (
                                <div className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3">
                                    <p className="text-[11.5px] text-stone-500">
                                        Each account can submit once. Questions?{" "}
                                        <Link href="/contact" className="font-bold text-orange-600 hover:underline">
                                            Contact us
                                        </Link>
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : success ? (
                        <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-6 text-center shadow-sm">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-white shadow-sm">
                                <CheckCircle2 size={32} className="text-emerald-500" />
                            </div>
                            <h3 style={{ fontFamily:"'Playfair Display',Georgia,serif" }}
                                className="text-xl font-black text-stone-900">
                                Submitted Successfully! 🎉
                            </h3>
                            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-stone-600">
                                Your review is under verification. Once approved, a{" "}
                                <span className="font-black text-orange-600">FREE Burger 🍔</span> will be
                                automatically added to your next order of ₹150+.
                            </p>
                            <div className="mt-5 flex flex-wrap justify-center gap-3">
                                <Link href="/menu"
                                      className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2.5 text-[13px] font-black text-white shadow-md shadow-orange-200 transition-all hover:brightness-110 active:scale-95">
                                    Browse Menu <ArrowRight size={13} />
                                </Link>
                            </div>
                        </div>
                    ) : (
                        /* ── Submit form ── */
                        <div className="overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-sm">
                            <div className="border-b border-pink-100 bg-gradient-to-r from-pink-50/70 to-orange-50/40 px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-sm shadow-pink-200">
                                        <Instagram size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-black text-stone-900">Submit Your Instagram Reel</p>
                                        <p className="text-[11px] text-stone-500">Paste the link to your FoodKnock review reel</p>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="p-5 space-y-4">

                                {/* Requirements */}
                                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 space-y-1.5">
                                    <p className="text-[11px] font-black text-amber-800">Before you submit, make sure:</p>
                                    {[
                                        "Your reel is publicly visible (not private)",
                                        "FoodKnock is clearly visible in the video",
                                        "Link format: instagram.com/reel/... or instagram.com/p/...",
                                    ].map(t => (
                                        <div key={t} className="flex items-start gap-2">
                                            <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-amber-600" />
                                            <p className="text-[11px] text-amber-700">{t}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Input */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                                        Instagram Reel Link <span className="text-pink-500">*</span>
                                    </label>
                                    <div className="relative flex items-center">
                                        <Instagram size={15} strokeWidth={2} className="pointer-events-none absolute left-3.5 text-stone-400" />
                                        <input
                                            type="url"
                                            value={link}
                                            onChange={e => { setLink(e.target.value); setError(""); }}
                                            placeholder="https://www.instagram.com/reel/ABC123/"
                                            className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 py-3.5 pl-10 pr-4 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all focus:border-pink-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-100 hover:border-stone-300"
                                        />
                                    </div>
                                    {error && (
                                        <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                                            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-500" />
                                            <p className="text-[11px] font-medium text-red-600">{error}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="group flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 py-4 text-[15px] font-black text-white shadow-lg shadow-pink-200/60 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {submitting
                                        ? <><Loader2 size={17} className="animate-spin" /> Submitting…</>
                                        : <><Gift size={17} strokeWidth={2.5} /> Submit & Claim Free Burger</>}
                                </button>

                                <p className="text-center text-[10.5px] text-stone-400">
                                    By submitting you agree that the review is genuine and the reel is publicly visible.
                                </p>
                            </form>
                        </div>
                    )}

                    {/* ── Social proof wall ── */}
                    <ReviewWall reviews={reviews} />

                    {/* ── FAQ strip ── */}
                    <div className="mt-10 space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-stone-400">FAQ</p>
                        {[
                            { q:"How long does verification take?",          a:"Usually within 24 hours. We check that the reel is genuine and publicly visible."  },
                            { q:"Which item is free?",                       a:"A Free Burger (₹0) is automatically added to your cart on your next order of ₹150+."},
                            { q:"Can I choose Free Pizza instead?",          a:"By default it's a burger — the admin can switch it to pizza when approving."         },
                            { q:"What if my reel gets rejected?",            a:"Make sure your reel is public and clearly shows FoodKnock. Contact us if you think it was a mistake."},
                        ].map((f, i) => (
                            <div key={i} className="rounded-2xl border border-stone-100 bg-white px-4 py-3.5">
                                <p className="text-[12.5px] font-black text-stone-800">{f.q}</p>
                                <p className="mt-1 text-[11.5px] text-stone-500">{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}