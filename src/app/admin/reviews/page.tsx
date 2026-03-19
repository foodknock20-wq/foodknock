export const dynamic = "force-dynamic";

// src/app/admin/reviews/page.tsx

import { connectDB } from "@/lib/db";
import Review from "@/models/Review";
import ReviewTable, { type ReviewRow } from "@/components/admin/reviews/ReviewTable";
import { MessageSquare } from "lucide-react";

async function getReviews(): Promise<ReviewRow[]> {
    await connectDB();

    const reviews = await Review.find()
        .sort({ createdAt: -1 })
        .lean();

    return (reviews as any[]).map((r) => ({
        _id: String(r._id),
        userName: r.userName ?? "Anonymous",
        rating: r.rating ?? 5,
        comment: r.comment ?? "",
        isApproved: r.isApproved ?? false,
        createdAt: r.createdAt
            ? new Date(r.createdAt).toISOString()
            : new Date().toISOString(),
    }));
}

export default async function AdminReviewsPage() {
    const reviews = await getReviews();

    // Derived stats
    const totalReviews = reviews.length;
    const approvedReviews = reviews.filter((r) => r.isApproved).length;
    const pendingReviews = reviews.filter((r) => !r.isApproved).length;
    const avgRating = totalReviews > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
        : "—";

    return (
        <div className="space-y-6">

            {/* ── Page header ── */}
            <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                    <MessageSquare size={11} className="text-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                        Reviews
                    </span>
                </div>
                <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">
                    Review Management
                </h1>
                <p className="mt-1 text-sm text-stone-600">
                    {totalReviews} total review{totalReviews !== 1 ? "s" : ""} — moderate customer feedback
                </p>
            </div>

            {/* ── Stats strip ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    {
                        label: "Total",
                        value: totalReviews,
                        color: "text-white",
                    },
                    {
                        label: "Approved",
                        value: approvedReviews,
                        color: "text-emerald-400",
                    },
                    {
                        label: "Pending",
                        value: pendingReviews,
                        color: pendingReviews > 0 ? "text-amber-400" : "text-stone-600",
                    },
                    {
                        label: "Avg Rating",
                        value: avgRating,
                        color: "text-amber-400",
                    },
                ].map(({ label, value, color }) => (
                    <div
                        key={label}
                        className="rounded-xl border border-white/[0.06] bg-[#111118] px-4 py-3"
                    >
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-600">
                            {label}
                        </p>
                        <p className={`mt-1 font-serif text-2xl font-black ${color}`}>
                            {value}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── Pending alert strip ── */}
            {pendingReviews > 0 && (
                <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-5 py-3">
                    <p className="text-xs text-stone-500">
                        <span className="font-bold text-amber-400">{pendingReviews}</span>
                        {" "}review{pendingReviews !== 1 ? "s are" : " is"} awaiting approval — they will not be visible to customers until approved.
                    </p>
                </div>
            )}

            {/* ── Table card ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <ReviewTable reviews={reviews} />
            </div>
        </div>
    );
}