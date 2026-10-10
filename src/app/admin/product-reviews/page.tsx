export const dynamic = "force-dynamic";

// src/app/admin/product-reviews/page.tsx
//
// Pre-Phase 17 — Phase 1: Reviews 2.0 admin moderation page. Mirrors the
// existing /admin/reviews (testimonials) page's server-side pagination +
// search + filter pattern — true bounded queries, never an unbounded fetch.

import { connectDB } from "@/lib/db";
import ProductReview from "@/models/ProductReview";
import ProductReviewTable, { type ProductReviewRow } from "@/components/admin/productReviews/ProductReviewTable";
import Pagination from "@/components/admin/shared/Pagination";
import AdminListSearchBar from "@/components/admin/shared/AdminListSearchBar";
import { parseAdminPagination, buildPaginationMeta } from "@/lib/adminPagination";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import { Star } from "lucide-react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function getProductReviews(searchParams: Awaited<SearchParams>) {
    await connectDB();

    const { page, limit, skip } = parseAdminPagination(searchParams, { defaultLimit: 25, maxLimit: 100 });
    const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
    const status = searchParams.status === "visible" || searchParams.status === "hidden" ? searchParams.status : "all";
    const verified = searchParams.verified === "true" || searchParams.verified === "false" ? searchParams.verified : "all";
    const rating = typeof searchParams.rating === "string" && ["1", "2", "3", "4", "5"].includes(searchParams.rating)
        ? searchParams.rating
        : "all";

    const filter: Record<string, unknown> = {};
    if (status === "hidden") filter.isHidden = true;
    if (status === "visible") filter.isHidden = false;
    if (verified === "true") filter.verifiedPurchase = true;
    if (verified === "false") filter.verifiedPurchase = false;
    if (rating !== "all") filter.rating = Number(rating);
    if (search) {
        filter.$or = [
            { userName: { $regex: search, $options: "i" } },
            { comment: { $regex: search, $options: "i" } },
        ];
    }

    const [rows, total, statsAgg] = await Promise.all([
        ProductReview.find(filter)
            .populate("productId", "name slug")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ProductReview.countDocuments(filter),
        // Bounded single-document output regardless of collection size.
        ProductReview.aggregate<{ total: number; verified: number; hidden: number; ratingSum: number }>([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    verified: { $sum: { $cond: ["$verifiedPurchase", 1, 0] } },
                    hidden: { $sum: { $cond: ["$isHidden", 1, 0] } },
                    ratingSum: { $sum: "$rating" },
                },
            },
        ]),
    ]);

    const reviews: ProductReviewRow[] = rows.map((r: {
        _id: { toString(): string };
        productId?: { name?: string; slug?: string } | null;
        userName?: string;
        rating?: number;
        comment?: string;
        verifiedPurchase?: boolean;
        isHidden?: boolean;
        createdAt?: Date | string;
    }) => ({
        _id: String(r._id),
        productName: r.productId?.name ?? "Deleted product",
        productSlug: r.productId?.slug ?? null,
        userName: r.userName ?? "Customer",
        rating: r.rating ?? 5,
        comment: r.comment ?? "",
        verifiedPurchase: Boolean(r.verifiedPurchase),
        isHidden: Boolean(r.isHidden),
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    const agg = statsAgg[0] ?? { total: 0, verified: 0, hidden: 0, ratingSum: 0 };

    return {
        reviews,
        meta: buildPaginationMeta(total, page, limit),
        stats: {
            total: agg.total,
            verified: agg.verified,
            hidden: agg.hidden,
            avgRating: agg.total > 0 ? (agg.ratingSum / agg.total).toFixed(1) : "—",
        },
        filters: { search, status, verified, rating },
    };
}

export default async function AdminProductReviewsPage({ searchParams }: { searchParams: SearchParams }) {
    const resolvedSearchParams = await searchParams;
    const { reviews, meta, stats, filters } = await getProductReviews(resolvedSearchParams);

    return (
        <div className="space-y-6">

            <AdminPageHeader
                icon={Star}
                title="Product Reviews"
                description={`${stats.total} total review${stats.total !== 1 ? "s" : ""} — real customer feedback on menu items`}
            />

            {/* ── Stats strip ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Total", value: stats.total, color: "text-white" },
                    { label: "Verified Purchase", value: stats.verified, color: "text-emerald-400" },
                    { label: "Hidden", value: stats.hidden, color: stats.hidden > 0 ? "text-amber-400" : "text-stone-600" },
                    { label: "Avg Rating", value: stats.avgRating, color: "text-amber-400" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-white/[0.06] bg-[#111118] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-600">{label}</p>
                        <p className={`mt-1 font-serif text-2xl font-black ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Table card ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <div className="mb-5 flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <AdminListSearchBar placeholder="Search by customer or review text…" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <FilterGroup
                            label="Status"
                            paramKey="status"
                            current={filters.status}
                            options={[
                                { value: "all", label: "All" },
                                { value: "visible", label: "Visible" },
                                { value: "hidden", label: "Hidden" },
                            ]}
                            filters={filters}
                        />
                        <FilterGroup
                            label="Verified"
                            paramKey="verified"
                            current={filters.verified}
                            options={[
                                { value: "all", label: "All" },
                                { value: "true", label: "Verified" },
                                { value: "false", label: "Unverified" },
                            ]}
                            filters={filters}
                        />
                        <FilterGroup
                            label="Rating"
                            paramKey="rating"
                            current={filters.rating}
                            options={[
                                { value: "all", label: "All" },
                                { value: "5", label: "5★" },
                                { value: "4", label: "4★" },
                                { value: "3", label: "3★" },
                                { value: "2", label: "2★" },
                                { value: "1", label: "1★" },
                            ]}
                            filters={filters}
                        />
                    </div>
                </div>

                <ProductReviewTable reviews={reviews} />

                <Pagination
                    meta={meta}
                    basePath="/admin/product-reviews"
                    searchParams={{
                        search: filters.search || undefined,
                        status: filters.status !== "all" ? filters.status : undefined,
                        verified: filters.verified !== "all" ? filters.verified : undefined,
                        rating: filters.rating !== "all" ? filters.rating : undefined,
                    }}
                    itemLabel="reviews"
                />
            </div>
        </div>
    );
}

// ── Filter group — plain links, server-rendered, URL-driven ────────────────
function FilterGroup({
    label, paramKey, current, options, filters,
}: {
    label: string;
    paramKey: "status" | "verified" | "rating";
    current: string;
    options: { value: string; label: string }[];
    filters: { search: string; status: string; verified: string; rating: string };
}) {
    return (
        <div className="flex shrink-0 items-center gap-1.5">
            <span className="mr-0.5 text-[10.5px] font-bold uppercase tracking-wider text-stone-600">{label}</span>
            {options.map((o) => {
                const params = new URLSearchParams();
                if (filters.search) params.set("search", filters.search);
                if (paramKey !== "status" && filters.status !== "all") params.set("status", filters.status);
                if (paramKey !== "verified" && filters.verified !== "all") params.set("verified", filters.verified);
                if (paramKey !== "rating" && filters.rating !== "all") params.set("rating", filters.rating);
                if (o.value !== "all") params.set(paramKey, o.value);
                params.set("page", "1");
                const href = `/admin/product-reviews?${params.toString()}`;
                const active = current === o.value;
                return (
                    <Link
                        key={o.value}
                        href={href}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${active
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
