export const dynamic = "force-dynamic";

// src/app/(main)/reviews/page.tsx
// Server component — fetches real approved reviews from MongoDB.
// FoodKnock light `--fk-*` design system — Reviews 2.0.
//
// Reviews 2.0 — previous version ran a decorative, multi-layer marketing
// hero + a single-column "testimonial wall". Rewritten per the Reviews 2.0
// spec: compact premium header here, the real two-column (summary + feed)
// architecture now lives inside <ReviewsGrid> (it owns the CTA/modal state
// that both columns need to share — see that file's header comment for
// why the split landed there instead of here).
//
// Real-data additions this pass:
//   1. `totalApproved` — a genuine `Review.countDocuments({isApproved:true})`
//      run alongside the existing bounded `.limit(200)` fetch (one extra
//      cheap boolean-field count, NOT an expensive aggregation) so the
//      displayed review count is authoritative even if approved reviews
//      ever exceed the 200-row page cap. Previously `reviews.length` (the
//      loaded-page size) was the only number shown — correct today, but
//      silently wrong once the business has 201+ approved reviews.
//   2. avgRating/breakdown remain derived from the same bounded, already-
//      fetched array (unchanged) — recomputing them via a separate DB
//      aggregation would cost real database work just for cosmetic stats,
//      which the spec explicitly says not to do.

import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import Review from "@/models/Review";
import Footer from "@/components/shared/Footer";
import ReviewsGrid from "@/components/reviews/ReviewsGrid";

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

export type PublicReview = {
    _id: string;
    userName: string;
    rating: number;
    comment: string;
    createdAt: string;
};

type ReviewDoc = { _id: unknown; userName?: string; rating?: number; comment?: string; createdAt?: Date };

async function getReviewsData(): Promise<{ reviews: PublicReview[]; totalApproved: number }> {
    await connectDB();

    // Two cheap, bounded operations in parallel — no N+1, no unbounded
    // fetch, no expensive aggregation. The count is a single boolean-field
    // index scan; the find is capped at 200 (see file header).
    const [docs, totalApproved] = await Promise.all([
        Review.find({ isApproved: true }).sort({ createdAt: -1 }).limit(200).lean(),
        Review.countDocuments({ isApproved: true }),
    ]);

    const reviews = (docs as ReviewDoc[]).map((r) => ({
        _id:       String(r._id),
        userName:  r.userName ?? "Anonymous",
        rating:    r.rating   ?? 5,
        comment:   r.comment  ?? "",
        createdAt: r.createdAt
            ? new Date(r.createdAt).toISOString()
            : new Date().toISOString(),
    }));

    return { reviews, totalApproved };
}

export default async function ReviewsPage() {
    const { reviews, totalApproved } = await getReviewsData();

    return (
        <>
            <main className="min-h-screen bg-fk-bg">
                {/* ── Compact header — no decorative marketing hero (spec §20) ── */}
                <div className="border-b border-fk-border bg-fk-surface-elevated">
                    <div className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-6">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--fk-accent)]">Customer Reviews</p>
                        <h1 className="mt-0.5 text-2xl font-black text-fk-text md:text-[28px]">Real experiences from FoodKnock customers</h1>
                    </div>
                </div>

                {/* Two-column architecture + feed — all in ReviewsGrid (owns CTA/modal state) */}
                <ReviewsGrid reviews={reviews} totalApproved={totalApproved} />
            </main>
            <Footer />
        </>
    );
}
