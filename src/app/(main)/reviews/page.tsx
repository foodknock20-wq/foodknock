export const dynamic = "force-dynamic";

// src/app/(main)/reviews/page.tsx
// Server component — fetches real approved reviews from MongoDB.
// Light warm premium theme for FoodKnock.

import type { Metadata } from "next";
import { connectDB } from "@/lib/db";

export const metadata: Metadata = {
    title:       "Customer Reviews — FoodKnock",
    description: "See what our customers say about FoodKnock. Real reviews from real people who love our burgers, pizza, momos & more.",
    alternates:  { canonical: "https://www.foodknock.com/reviews" },
    openGraph: {
        title:       "FoodKnock Reviews — What Our Customers Say",
        description: "Real customer reviews for FoodKnock food delivery.",
        url:         "https://www.foodknock.com/reviews",
    },
};
import Review from "@/models/Review";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import ReviewsGrid from "@/components/reviews/ReviewsGrid";
import { Star, BadgeCheck, Users } from "lucide-react";

export type PublicReview = {
    _id: string;
    userName: string;
    rating: number;
    comment: string;
    createdAt: string;
};

async function getApprovedReviews(): Promise<PublicReview[]> {
    await connectDB();
    const docs = await Review.find({ isApproved: true })
        .sort({ createdAt: -1 })
        .lean();

    return (docs as any[]).map((r) => ({
        _id:       String(r._id),
        userName:  r.userName ?? "Anonymous",
        rating:    r.rating   ?? 5,
        comment:   r.comment  ?? "",
        createdAt: r.createdAt
            ? new Date(r.createdAt).toISOString()
            : new Date().toISOString(),
    }));
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
                <Star
                    key={s}
                    size={size}
                    className={
                        s <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-amber-100 text-amber-100"
                    }
                />
            ))}
        </div>
    );
}

export default async function ReviewsPage() {
    const reviews = await getApprovedReviews();
    const total   = reviews.length;
    const avgNum  = total > 0
        ? reviews.reduce((s, r) => s + r.rating, 0) / total
        : 5;
    const avgRating = avgNum.toFixed(1);

    const breakdown = [5, 4, 3, 2, 1].map((star) => {
        const count = reviews.filter((r) => r.rating === star).length;
        return { star, pct: total > 0 ? Math.round((count / total) * 100) : 0, count };
    });

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FFFBF5]">

                {/* ── HERO ─────────────────────────────────────────────── */}
                <section className="relative overflow-hidden border-b border-amber-100">

                    {/* Background texture */}
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 via-[#FFFBF5] to-orange-50/60" />
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)",
                            backgroundSize: "24px 24px",
                        }}
                    />
                    {/* Warm glow */}
                    <div
                        className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full opacity-25 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }}
                    />
                    <div
                        className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full opacity-15 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #fcd34d, transparent 70%)" }}
                    />

                    <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-12 md:px-8 md:pb-14 md:pt-16">
                        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">

                            {/* Left — copy */}
                            <div className="max-w-lg">
                                {/* Eyebrow */}
                                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-1.5 shadow-sm">
                                    <span className="flex h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.7)]" />
                                    <span className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-600">
                                        Real Customer Love
                                    </span>
                                </div>

                                <h1 className="text-3xl font-black leading-[1.08] tracking-tight text-stone-900 md:text-4xl lg:text-5xl">
                                    Taste people{" "}
                                    <span
                                        className="bg-clip-text text-transparent"
                                        style={{ backgroundImage: "linear-gradient(135deg, #ea580c 0%, #d97706 60%, #dc2626 100%)" }}
                                    >
                                        keep coming back for
                                    </span>
                                </h1>

                                <p className="mt-4 text-base leading-relaxed text-stone-500">
                                    Every review here is unedited, unfiltered, and entirely genuine —
                                    honest words from customers who ordered and loved what arrived.
                                </p>

                                {/* Trust chips */}
                                <div className="mt-5 flex flex-wrap gap-2.5">
                                    {[
                                        { icon: <BadgeCheck size={12} />, text: "Verified customers", bg: "bg-green-50 border-green-200 text-green-700" },
                                        { icon: <Users size={12} />, text: `${total} total reviews`, bg: "bg-amber-50 border-amber-200 text-amber-700" },
                                        { icon: <Star size={12} className="fill-current" />, text: `${avgRating} avg rating`, bg: "bg-orange-50 border-orange-200 text-orange-700" },
                                    ].map((c) => (
                                        <span key={c.text} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${c.bg}`}>
                                            {c.icon}
                                            {c.text}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Right — score card */}
                            <div className="w-full shrink-0 rounded-3xl border border-amber-200 bg-white p-6 shadow-lg shadow-amber-100/60 md:w-64">
                                {/* Big score */}
                                <div className="mb-1 flex items-end gap-2">
                                    <p className="font-black text-6xl leading-none text-stone-900">{avgRating}</p>
                                    <p className="mb-2 text-sm font-semibold text-stone-400">out of 5</p>
                                </div>
                                <StarRow rating={Math.round(avgNum)} size={18} />
                                <p className="mt-1.5 text-xs font-semibold text-stone-400">
                                    Based on {total} review{total !== 1 ? "s" : ""}
                                </p>

                                {/* Breakdown bars */}
                                {total > 0 && (
                                    <div className="mt-5 space-y-2">
                                        {breakdown.map(({ star, pct, count }) => (
                                            <div key={star} className="flex items-center gap-2.5">
                                                <span className="w-3 shrink-0 text-right text-[11px] font-black text-stone-500">{star}</span>
                                                <Star size={9} className="shrink-0 fill-amber-400 text-amber-400" />
                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-50 border border-amber-100">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="w-5 shrink-0 text-[10px] font-semibold text-stone-400">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Divider + cta hint */}
                                <div className="mt-5 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-amber-100 px-4 py-3 text-center">
                                    <p className="text-[11px] font-bold text-amber-700">🌟 Love our food?</p>
                                    <p className="text-[10px] text-amber-600/80 mt-0.5">Share your honest review!</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── GRID + MODALS (client island) ─────────────────────── */}
                <ReviewsGrid reviews={reviews} />

            </main>
            <Footer />
        </>
    );
}