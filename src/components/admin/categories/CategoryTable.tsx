"use client";

// src/components/admin/categories/CategoryTable.tsx
//
// Phase 15E — category list + rename. The underlying list is small and
// bounded (one category row per distinct Product.category value — in
// production this is ~21 rows, never catalog-sized), so client-side search
// filtering of THIS list is fine; it is never the product catalog itself.
// Rename calls the server (/api/admin/categories/rename), which runs one
// bounded updateMany scoped to the matched category — this component never
// loops per-product.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Search, Pencil, Package, Loader2, AlertTriangle, ArrowUpRight } from "lucide-react";
import type { CategoryWithCount } from "@/lib/catalogCategories";

function RenameModal({
    category, onClose, onRenamed,
}: {
    category: CategoryWithCount; onClose: () => void; onRenamed: () => void;
}) {
    const [value, setValue] = useState(category.category);
    const [loading, setLoading] = useState(false);

    const handleRename = async () => {
        const trimmed = value.trim();
        if (!trimmed) { toast.error("Category name is required"); return; }
        if (trimmed === category.category) { onClose(); return; }

        setLoading(true);
        try {
            const res = await fetch("/api/admin/categories/rename", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ oldName: category.category, newName: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message ?? "Rename failed"); return; }
            toast.success(`${data.updatedCount} product${data.updatedCount !== 1 ? "s" : ""} updated`);
            onRenamed();
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
            <div
                className="w-full max-w-sm rounded-3xl border border-white/[0.07] p-6 shadow-2xl"
                style={{ background: "linear-gradient(160deg, #15151f 0%, #111118 100%)" }}
            >
                <div className="mb-5 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
                        <Pencil size={16} className="text-amber-400" strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-black text-white">Rename Category</h3>
                        <p className="text-[11px] text-stone-600">
                            Updates all {category.count} product{category.count !== 1 ? "s" : ""} in &quot;{category.category}&quot;
                        </p>
                    </div>
                </div>

                <input
                    type="text"
                    autoFocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-2.5 text-[13px] text-stone-200 focus:border-amber-500/45 focus:outline-none focus:ring-2 focus:ring-amber-500/12"
                />

                {value.trim() && value.trim() !== category.category && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2.5">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-400" />
                        <p className="text-[11px] leading-relaxed text-amber-400/90">
                            This renames the category everywhere it&apos;s used — customer-facing menu sections, filters, and future orders will show &quot;{value.trim()}&quot; instead of &quot;{category.category}&quot;.
                        </p>
                    </div>
                )}

                <div className="mt-4 flex gap-2.5">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 text-[13px] font-semibold text-stone-400 transition-colors hover:bg-white/[0.06] hover:text-stone-200 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleRename}
                        disabled={loading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-[13px] font-black text-stone-950 transition-all hover:bg-amber-600 active:scale-[0.98] disabled:opacity-60"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                        Rename
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CategoryTable({ categories }: { categories: CategoryWithCount[] }) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [renaming, setRenaming] = useState<CategoryWithCount | null>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return categories;
        return categories.filter((c) => c.category.toLowerCase().includes(q));
    }, [categories, search]);

    return (
        <>
            {renaming && (
                <RenameModal
                    category={renaming}
                    onClose={() => setRenaming(null)}
                    onRenamed={() => { setRenaming(null); router.refresh(); }}
                />
            )}

            <div className="relative mb-5 max-w-sm">
                <Search size={13} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-600" strokeWidth={2} />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search categories…"
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.035] py-2.5 pl-9 pr-3 text-[13px] text-stone-300 placeholder:text-stone-700 focus:border-amber-500/40 focus:outline-none"
                />
            </div>

            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Package size={24} className="mb-3 text-stone-700" strokeWidth={1.5} />
                    <p className="text-[13px] text-stone-600">No categories match &quot;{search}&quot;</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((c) => (
                        <div
                            key={c.category}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/[0.07]">
                                    <Package size={14} className="text-amber-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-[13px] font-bold text-stone-200">{c.category}</p>
                                    <p className="text-[11px] text-stone-600">{c.count} product{c.count !== 1 ? "s" : ""}</p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                <Link
                                    href={`/admin/products?category=${encodeURIComponent(c.category)}`}
                                    title="View products in this category"
                                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] font-bold text-stone-300 transition-all hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-stone-100"
                                >
                                    View
                                    <ArrowUpRight size={11} />
                                </Link>
                                <button
                                    onClick={() => setRenaming(c)}
                                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] font-bold text-stone-300 transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
                                >
                                    <Pencil size={11} />
                                    Rename
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
