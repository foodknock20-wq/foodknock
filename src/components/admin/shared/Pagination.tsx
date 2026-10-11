"use client";

// src/components/admin/shared/Pagination.tsx
//
// Phase 15A — THE single Admin 2.0 pagination control, reused by every
// paginated admin list (Products, Reviews, Users, and future sections).
//
// Deliberately link-based, not fetch-based: each page/limit control is a
// plain Next.js <Link> with updated query params. Next.js server-renders
// the destination page (prefetched on hover/viewport-enter) — no client
// API waterfall, no extra loading state to hand-roll, and the browser's
// native back/forward + refresh all just work because the page number
// lives in the URL, not in ephemeral React state.
//
// basePath + searchParams are provided by the caller so this component
// never has to guess the current route or re-derive filters — it only
// ever changes the `page` key, preserving everything else (search,
// status, category, etc.) exactly as-is.

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AdminPaginationMeta } from "@/lib/adminPagination";

function hrefForPage(basePath: string, searchParams: Record<string, string | undefined>, page: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
        if (value !== undefined && value !== "" && key !== "page") params.set(key, value);
    }
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
}

// Phase 2 — additive, opt-in page-size control. Only rendered when a
// caller passes `pageSizeOptions`; every existing caller (Products,
// Reviews, Users) omits it and renders byte-for-byte as before. Changing
// the page size always resets to page 1 — the current page number has no
// defined meaning under a different limit.
function hrefForLimit(basePath: string, searchParams: Record<string, string | undefined>, limit: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
        if (value !== undefined && value !== "" && key !== "page" && key !== "limit") params.set(key, value);
    }
    params.set("limit", String(limit));
    params.set("page", "1");
    return `${basePath}?${params.toString()}`;
}

/** Compact page-number list: always shows first/last, a window around the current page, and "…" gaps — never renders more than ~7 page links regardless of totalPages. */
function visiblePages(current: number, total: number): Array<number | "…"> {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
    if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "…", current - 1, current, current + 1, "…", total];
}

export default function Pagination({
    meta,
    basePath,
    searchParams,
    itemLabel = "items",
    pageSizeOptions,
}: {
    meta: AdminPaginationMeta;
    basePath: string;
    searchParams: Record<string, string | undefined>;
    itemLabel?: string;
    /** Optional — when provided, renders a page-size selector (e.g. [20, 50, 100]). Omit to keep this component's existing behavior unchanged. */
    pageSizeOptions?: number[];
}) {
    const { page, totalPages, total, limit, hasNextPage, hasPreviousPage } = meta;

    if (total === 0) return null;

    const rangeStart = (page - 1) * limit + 1;
    const rangeEnd = Math.min(page * limit, total);

    return (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-4 sm:flex-row">
            <div className="flex items-center gap-3">
                <p className="text-[11px] text-stone-600">
                    Showing <span className="font-semibold text-stone-400">{rangeStart}–{rangeEnd}</span> of{" "}
                    <span className="font-semibold text-stone-400">{total}</span> {itemLabel}
                </p>
                {pageSizeOptions && pageSizeOptions.length > 0 && (
                    <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
                        {pageSizeOptions.map((size) => (
                            <Link
                                key={size}
                                href={hrefForLimit(basePath, searchParams, size)}
                                aria-current={size === limit ? "true" : undefined}
                                className={`rounded-md px-2 py-1 text-[10.5px] font-bold transition-colors ${
                                    size === limit
                                        ? "bg-amber-500/20 text-amber-300"
                                        : "text-stone-400 hover:bg-white/[0.05] hover:text-stone-100"
                                }`}
                            >
                                {size}
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Mobile — compact prev/next, no page-number row (no horizontal overflow) */}
            <div className="flex items-center gap-2 sm:hidden">
                {hasPreviousPage ? (
                    <Link
                        href={hrefForPage(basePath, searchParams, page - 1)}
                        className="flex h-9 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-bold text-stone-300"
                    >
                        <ChevronLeft size={13} /> Prev
                    </Link>
                ) : (
                    <span className="flex h-9 cursor-not-allowed items-center gap-1 rounded-xl border border-white/[0.04] bg-white/[0.01] px-3 text-[12px] font-bold text-stone-700">
                        <ChevronLeft size={13} /> Prev
                    </span>
                )}
                <span className="text-[12px] font-bold text-stone-500">Page {page} / {totalPages}</span>
                {hasNextPage ? (
                    <Link
                        href={hrefForPage(basePath, searchParams, page + 1)}
                        className="flex h-9 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-bold text-stone-300"
                    >
                        Next <ChevronRight size={13} />
                    </Link>
                ) : (
                    <span className="flex h-9 cursor-not-allowed items-center gap-1 rounded-xl border border-white/[0.04] bg-white/[0.01] px-3 text-[12px] font-bold text-stone-700">
                        Next <ChevronRight size={13} />
                    </span>
                )}
            </div>

            {/* Desktop — Prev | 1 2 3 … N | Next */}
            <div className="hidden items-center gap-1.5 sm:flex">
                {hasPreviousPage ? (
                    <Link
                        href={hrefForPage(basePath, searchParams, page - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-stone-400 transition-colors hover:bg-white/[0.07]"
                    >
                        <ChevronLeft size={14} />
                    </Link>
                ) : (
                    <span className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg border border-white/[0.04] bg-white/[0.01] text-stone-700">
                        <ChevronLeft size={14} />
                    </span>
                )}

                {visiblePages(page, totalPages).map((p, i) =>
                    p === "…" ? (
                        <span key={`e${i}`} className="px-1 text-[12px] text-stone-700">…</span>
                    ) : (
                        <Link
                            key={p}
                            href={hrefForPage(basePath, searchParams, p)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition-colors ${p === page
                                ? "bg-amber-500 text-stone-950"
                                : "border border-white/[0.06] bg-white/[0.02] text-stone-400 hover:bg-white/[0.07]"
                                }`}
                        >
                            {p}
                        </Link>
                    )
                )}

                {hasNextPage ? (
                    <Link
                        href={hrefForPage(basePath, searchParams, page + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-stone-400 transition-colors hover:bg-white/[0.07]"
                    >
                        <ChevronRight size={14} />
                    </Link>
                ) : (
                    <span className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg border border-white/[0.04] bg-white/[0.01] text-stone-700">
                        <ChevronRight size={14} />
                    </span>
                )}
            </div>
        </div>
    );
}
