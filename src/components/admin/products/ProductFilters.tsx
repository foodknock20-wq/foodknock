"use client";

// src/components/admin/products/ProductFilters.tsx
//
// Phase 15E — Catalog 2.0. Server-side quick filters + category/sort
// selects for the admin Products list. Every control only ever writes to
// the URL (router.push, scroll:false) — the server component re-queries
// Mongo with the new filter; there is no client-side filtering of an
// already-fetched page. Changing ANY filter resets `page` to 1, exactly
// like AdminListSearchBar already does for `search`.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SORT_OPTIONS } from "@/lib/catalogConstants";

type QuickFilter = { label: string; status?: string; stock?: string };

const QUICK_FILTERS: QuickFilter[] = [
    { label: "All" },
    { label: "Active", status: "active" },
    { label: "Inactive", status: "inactive" },
    { label: "Low Stock", stock: "low" },
    { label: "Out of Stock", stock: "out" },
];

export default function ProductFilters({
    categories,
    lowStockCount,
}: {
    categories: string[];
    lowStockCount: number;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentStatus = searchParams.get("status") ?? "";
    const currentStock = searchParams.get("stock") ?? "";
    const currentCategory = searchParams.get("category") ?? "";
    const currentSort = searchParams.get("sort") ?? "newest";

    const push = (updates: Record<string, string | undefined>) => {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            if (value) params.set(key, value);
            else params.delete(key);
        }
        params.set("page", "1");
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const isQuickActive = (qf: QuickFilter) =>
        (qf.status ?? "") === currentStatus && (qf.stock ?? "") === currentStock;

    return (
        <div className="flex flex-col gap-3">
            {/* Quick filter chips */}
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
                {QUICK_FILTERS.map((qf) => (
                    <button
                        key={qf.label}
                        onClick={() => push({ status: qf.status, stock: qf.stock })}
                        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold transition-all ${isQuickActive(qf)
                                ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                                : "border-white/[0.07] bg-white/[0.02] text-stone-300 hover:border-white/[0.12] hover:text-stone-100"
                            }`}
                    >
                        {qf.label}
                        {qf.label === "Low Stock" && lowStockCount > 0 && (
                            <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] text-rose-400">
                                {lowStockCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Category + sort selects */}
            <div className="flex flex-wrap gap-2.5">
                <select
                    value={currentCategory}
                    onChange={(e) => push({ category: e.target.value || undefined })}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-[12px] text-stone-300 focus:border-amber-500/40 focus:outline-none"
                >
                    <option value="" className="bg-[#0d0d14]">All Categories</option>
                    {categories.map((c) => (
                        <option key={c} value={c} className="bg-[#0d0d14]">{c}</option>
                    ))}
                </select>

                <select
                    value={currentSort}
                    onChange={(e) => push({ sort: e.target.value === "newest" ? undefined : e.target.value })}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-[12px] text-stone-300 focus:border-amber-500/40 focus:outline-none"
                >
                    {SORT_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value} className="bg-[#0d0d14]">{s.label}</option>
                    ))}
                </select>

                {(currentStatus || currentStock || currentCategory || (currentSort && currentSort !== "newest")) && (
                    <button
                        onClick={() => push({ status: undefined, stock: undefined, category: undefined, sort: undefined })}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-semibold text-stone-300 transition-colors hover:text-stone-100"
                    >
                        Clear filters
                    </button>
                )}
            </div>
        </div>
    );
}
