export const dynamic = "force-dynamic";

// src/app/admin/reviews/page.tsx
//
// Phase 15A — converted from an unbounded `Review.find()` (no limit at
// all) to true server-side pagination + search + status filter. The stats
// strip (Total/Approved/Pending/Avg Rating) is computed via
// `countDocuments()`/a bounded `$group` aggregation over the WHOLE
// collection — cheap, bounded output — so it stays accurate regardless of
// which page is being viewed.

import { connectDB } from "@/lib/db";
import Review from "@/models/Review";
import ReviewTable, { type ReviewRow } from "@/components/admin/reviews/ReviewTable";
import Pagination from "@/components/admin/shared/Pagination";
import AdminListSearchBar from "@/components/admin/shared/AdminListSearchBar";
import { parseAdminPagination, buildPaginationMeta } from "@/lib/adminPagination";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import { MessageSquare } from "lucide-react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function getReviews(searchParams: Awaited<SearchParams>) {
    await connectDB();

    const { page, limit, skip } = parseAdminPagination(searchParams, { defaultLimit: 25, maxLimit: 100 });
    const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
    const status = searchParams.status === "approved" || searchParams.status === "pending" ? searchParams.status : "all";

    const filter: Record<string, unknown> = {};
    if (status === "approved") filter.isApproved = true;
    if (status === "pending") filter.isApproved = false;
    if (search) {
        filter.$or = [{ userName: { $regex: search, $options: "i" } }, { comment: { $regex: search, $options: "i" } }];
    }

    const [rows, total, statsAgg] = await Promise.all([
        Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Review.countDocuments(filter),
        // Bounded single-document output regardless of collection size — never
        // fetches review documents, just the counts/sum needed for the strip.
        Review.aggregate<{ total: number; approved: number; ratingSum: number }>([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    approved: { $sum: { $cond: ["$isApproved", 1, 0] } },
                    ratingSum: { $sum: { $ifNull: ["$rating", 0] } },
                },
            },
        ]),
    ]);

    const reviews: ReviewRow[] = rows.map((r: {
        _id: { toString(): string }; userName?: string; rating?: number; comment?: string; isApproved?: boolean; createdAt?: Date | string;
    }) => ({
        _id: String(r._id),
        userName: r.userName ?? "Anonymous",
        rating: r.rating ?? 5,
        comment: r.comment ?? "",
        isApproved: r.isApproved ?? false,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    const agg = statsAgg[0] ?? { total: 0, approved: 0, ratingSum: 0 };

    return {
        reviews,
        meta: buildPaginationMeta(total, page, limit),
        stats: {
            total: agg.total,
            approved: agg.approved,
            pending: agg.total - agg.approved,
            avgRating: agg.total > 0 ? (agg.ratingSum / agg.total).toFixed(1) : "—",
        },
    };
}

export default async function AdminReviewsPage({ searchParams }: { searchParams: SearchParams }) {
    const resolvedSearchParams = await searchParams;
    const { reviews, meta, stats } = await getReviews(resolvedSearchParams);

    const search = typeof resolvedSearchParams.search === "string" ? resolvedSearchParams.search : undefined;
    const status = typeof resolvedSearchParams.status === "string" ? resolvedSearchParams.status : undefined;

    return (
        <div className="space-y-6">

            <AdminPageHeader
                icon={MessageSquare}
                title="Reviews"
                description={`${stats.total} total review${stats.total !== 1 ? "s" : ""} — moderate customer feedback`}
            />

            {/* ── Stats strip ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Total", value: stats.total, color: "text-white" },
                    { label: "Approved", value: stats.approved, color: "text-emerald-400" },
                    { label: "Pending", value: stats.pending, color: stats.pending > 0 ? "text-amber-400" : "text-stone-600" },
                    { label: "Avg Rating", value: stats.avgRating, color: "text-amber-400" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-white/[0.06] bg-[#111118] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-600">{label}</p>
                        <p className={`mt-1 font-serif text-2xl font-black ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Pending alert strip ── */}
            {stats.pending > 0 && (
                <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-5 py-3">
                    <p className="text-xs text-stone-500">
                        <span className="font-bold text-amber-400">{stats.pending}</span>
                        {" "}review{stats.pending !== 1 ? "s are" : " is"} awaiting approval — they will not be visible to customers until approved.
                    </p>
                </div>
            )}

            {/* ── Table card ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <AdminListSearchBar placeholder="Search by name or comment…" />
                    <ReviewStatusFilter current={status ?? "all"} search={search} />
                </div>

                <ReviewTable reviews={reviews} />

                <Pagination
                    meta={meta}
                    basePath="/admin/reviews"
                    searchParams={{ search, status }}
                    itemLabel="reviews"
                />
            </div>
        </div>
    );
}

// ── Status filter — plain links, server-rendered, URL-driven (same
//    pattern as Pagination) so it composes with search + page naturally. ──
function ReviewStatusFilter({ current, search }: { current: string; search?: string }) {
    const options: { value: string; label: string }[] = [
        { value: "all", label: "All Reviews" },
        { value: "approved", label: "Approved" },
        { value: "pending", label: "Pending" },
    ];
    return (
        <div className="flex shrink-0 gap-1.5">
            {options.map((o) => {
                const params = new URLSearchParams();
                if (search) params.set("search", search);
                if (o.value !== "all") params.set("status", o.value);
                params.set("page", "1");
                const href = `/admin/reviews?${params.toString()}`;
                const active = current === o.value;
                return (
                    <Link
                        key={o.value}
                        href={href}
                        className={`rounded-xl border px-3 py-2.5 text-[12px] font-bold transition-colors ${active
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                            : "border-white/[0.07] bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]"
                            }`}
                    >
                        {o.label}
                    </Link>
                );
            })}
        </div>
    );
}
