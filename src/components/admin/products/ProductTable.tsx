"use client";

// src/components/admin/products/ProductTable.tsx
// FIXED: Mobile layout surgery — no overflow, no card cutoffs, clean modal
// PERF: Next/Image replaced with native <img> + cdnImage() for thumbnails

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
    Pencil, Trash2, Package, CheckCircle2, XCircle,
    Star, AlertTriangle, Loader2, Search, ImageOff,
} from "lucide-react";
import { cdnImage } from "@/lib/cdnImage";

// ─── Types ────────────────────────────────────────────────────────────────
export type ProductRow = {
    _id: string;
    name: string;
    slug?: string;
    category: string;
    price: number;
    compareAtPrice?: number | null;
    stock: number;
    isAvailable: boolean;
    isFeatured: boolean;
    image?: string;
};

type Props = { products: ProductRow[] };

// ─── Helpers ──────────────────────────────────────────────────────────────
function hasDiscount(price: number, compareAtPrice?: number | null): compareAtPrice is number {
    return typeof compareAtPrice === "number" && compareAtPrice > price;
}

function PriceCell({ price, compareAtPrice }: { price: number; compareAtPrice?: number | null }) {
    const discount = hasDiscount(price, compareAtPrice);
    return (
        <div className="flex flex-col gap-0.5 leading-none">
            <span className="text-[13px] font-black text-amber-400">
                ₹{price.toLocaleString("en-IN")}
            </span>
            {discount && (
                <span className="text-[10px] text-stone-600 line-through">
                    ₹{compareAtPrice!.toLocaleString("en-IN")}
                </span>
            )}
        </div>
    );
}

function StockBadge({ stock }: { stock: number }) {
    const style =
        stock === 0
            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
            : stock <= 5
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-stone-800/60 text-stone-500 border-stone-700/40";

    return (
        <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-bold ${style}`}>
            {stock}
        </span>
    );
}

// PERF: native img + cdnImage at 36px — admin thumbnails are tiny
function ProductThumb({ image, name }: { image?: string; name: string }) {
    return (
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
            {image ? (
                <img
                    src={cdnImage(image, 48)}
                    alt={name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center">
                    <Package size={13} className="text-stone-700" />
                </div>
            )}
        </div>
    );
}

// PERF: native img + cdnImage at 72px for mobile card thumbnail
function ProductThumbLarge({ image, name }: { image?: string; name: string }) {
    return (
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
            {image ? (
                <img
                    src={cdnImage(image, 80)}
                    alt={name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center">
                    <ImageOff size={16} className="text-stone-700" />
                </div>
            )}
        </div>
    );
}

// ─── Delete dialog ────────────────────────────────────────────────────────
function DeleteDialog({
    name, onConfirm, onCancel, loading,
}: {
    name: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
            <div
                className="w-full max-w-sm rounded-3xl border border-white/[0.07] p-6 shadow-2xl"
                style={{ background: "linear-gradient(160deg, #15151f 0%, #111118 100%)" }}
            >
                <div className="mb-5 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
                        <AlertTriangle size={18} className="text-rose-400" strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-black text-white">Delete Product</h3>
                        <p className="text-[11px] text-stone-600">This action cannot be undone</p>
                    </div>
                </div>

                <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] px-4 py-3">
                    <p className="text-[13px] leading-relaxed text-stone-400">
                        You&apos;re about to delete{" "}
                        <span className="font-black text-white">&quot;{name}&quot;</span>.
                        All associated data will be permanently removed.
                    </p>
                </div>

                <div className="mt-4 flex gap-2.5">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 text-[13px] font-semibold text-stone-400 transition-colors hover:bg-white/[0.06] hover:text-stone-200 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 py-2.5 text-[13px] font-black text-white transition-all hover:bg-rose-600 active:scale-[0.98] disabled:opacity-60"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.05] bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
                <Package size={24} className="text-stone-700" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-black text-stone-300">No products yet</h3>
            <p className="mt-1.5 max-w-xs text-[13px] text-stone-600">
                Add your first product to start building your menu.
            </p>
            <Link
                href="/admin/products/new"
                className="mt-5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-[13px] font-black text-stone-950 shadow-lg shadow-amber-500/20 transition-all hover:brightness-110"
            >
                Add First Product
            </Link>
        </div>
    );
}

function EditBtn({ href }: { href: string }) {
    return (
        <Link
            href={href}
            title="Edit"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-stone-600 transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
        >
            <Pencil size={12} strokeWidth={2} />
        </Link>
    );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            title="Delete"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-stone-600 transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
        >
            <Trash2 size={12} strokeWidth={2} />
        </button>
    );
}

// ─── Component ────────────────────────────────────────────────────────────
export default function ProductTable({ products: initialProducts }: Props) {
    const router = useRouter();
    const [products, setProducts] = useState<ProductRow[]>(initialProducts);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
    const [search, setSearch] = useState("");

    const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(deleteTarget._id);
        try {
            const res = await fetch(`/api/products/${deleteTarget._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message ?? "Failed to delete"); return; }
            setProducts((prev) => prev.filter((p) => p._id !== deleteTarget._id));
            toast.success("Product deleted");
            router.refresh();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setDeleting(null);
            setDeleteTarget(null);
        }
    };

    return (
        <>
            {deleteTarget && (
                <DeleteDialog
                    name={deleteTarget.name}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={deleting === deleteTarget._id}
                />
            )}

            {/* ── Search bar ── */}
            <div className="mb-5">
                <div className="relative w-full max-w-sm">
                    <Search
                        size={13}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-600"
                        strokeWidth={2}
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search products…"
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.035] py-2.5 pl-9 pr-9 text-[13px] text-stone-300 placeholder:text-stone-700 transition-all focus:border-amber-500/40 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-amber-500/12"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-400"
                        >
                            <XCircle size={13} />
                        </button>
                    )}
                </div>
                {search && (
                    <p className="mt-1.5 text-[11px] text-stone-600">
                        {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                    </p>
                )}
            </div>

            {filtered.length === 0 ? (
                products.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                        <Search size={20} className="text-stone-700" />
                        <p className="text-[13px] text-stone-600">
                            No products match <span className="text-stone-400">&quot;{search}&quot;</span>
                        </p>
                        <button onClick={() => setSearch("")} className="text-[12px] text-amber-500 hover:text-amber-400">
                            Clear search
                        </button>
                    </div>
                )
            ) : (
                <>
                    {/* ══ Desktop table ══ */}
                    <div className="hidden overflow-x-auto rounded-2xl border border-white/[0.055] md:block">
                        <table className="w-full min-w-[600px] text-sm">
                            <thead>
                                <tr
                                    className="border-b border-white/[0.055]"
                                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.015) 100%)" }}
                                >
                                    {["Product", "Category", "Price", "Stock", "Status", "Actions"].map((h) => (
                                        <th
                                            key={h}
                                            className="px-4 py-3.5 text-left text-[9.5px] font-black uppercase tracking-[0.2em] text-stone-600 whitespace-nowrap"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {filtered.map((product) => (
                                    <tr
                                        key={product._id}
                                        className="group transition-colors hover:bg-white/[0.018]"
                                    >
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <ProductThumb image={product.image} name={product.name} />
                                                <div className="min-w-0">
                                                    <p className="truncate text-[13px] font-semibold text-stone-200 max-w-[160px]">
                                                        {product.name}
                                                    </p>
                                                    {product.slug && (
                                                        <p className="truncate text-[10px] text-stone-700 max-w-[160px]">
                                                            /{product.slug}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.07] px-2.5 py-0.5 text-[11px] font-bold text-amber-400 whitespace-nowrap">
                                                {product.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <PriceCell price={product.price} compareAtPrice={product.compareAtPrice} />
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <StockBadge stock={product.stock} />
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${product.isAvailable
                                                        ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400"
                                                        : "border-white/[0.05] bg-white/[0.02] text-stone-600"
                                                        }`}
                                                >
                                                    {product.isAvailable
                                                        ? <CheckCircle2 size={10} strokeWidth={2.5} />
                                                        : <XCircle size={10} strokeWidth={2} />
                                                    }
                                                    {product.isAvailable ? "Live" : "Off"}
                                                </span>
                                                {product.isFeatured && (
                                                    <Star size={13} className="fill-amber-400 text-amber-400" title="Featured" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <EditBtn href={`/admin/products/edit/${product._id}`} />
                                                <DeleteBtn onClick={() => setDeleteTarget(product)} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ══ Mobile cards ══ */}
                    <div className="space-y-3 md:hidden">
                        {filtered.map((product) => (
                            <div
                                key={product._id}
                                className="rounded-2xl border border-white/[0.055] bg-gradient-to-b from-[#111118] to-[#0d0d14] overflow-hidden"
                            >
                                <div className="flex items-start gap-3 p-3.5">
                                    <ProductThumbLarge image={product.image} name={product.name} />

                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-black text-white leading-snug line-clamp-1">
                                            {product.name}
                                        </p>

                                        <div className="mt-1 flex items-baseline gap-2">
                                            <span className="text-[13px] font-black text-amber-400">
                                                ₹{product.price.toLocaleString("en-IN")}
                                            </span>
                                            {hasDiscount(product.price, product.compareAtPrice) && (
                                                <span className="text-[11px] text-stone-600 line-through">
                                                    ₹{product.compareAtPrice}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.07] px-2 py-0.5 text-[10px] font-bold text-amber-400">
                                                {product.category}
                                            </span>
                                            <StockBadge stock={product.stock} />
                                            <span
                                                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${product.isAvailable
                                                    ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400"
                                                    : "border-white/[0.05] bg-white/[0.02] text-stone-600"
                                                    }`}
                                            >
                                                {product.isAvailable
                                                    ? <><CheckCircle2 size={9} strokeWidth={2.5} /> Live</>
                                                    : <><XCircle size={9} /> Off</>
                                                }
                                            </span>
                                            {product.isFeatured && (
                                                <span className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/[0.07] px-2 py-0.5 text-[10px] font-bold text-amber-400">
                                                    <Star size={9} className="fill-amber-400" /> Featured
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 flex-col gap-1.5">
                                        <EditBtn href={`/admin/products/edit/${product._id}`} />
                                        <DeleteBtn onClick={() => setDeleteTarget(product)} />
                                    </div>
                                </div>

                                {product.slug && (
                                    <div className="border-t border-white/[0.04] px-3.5 py-2">
                                        <p className="truncate text-[10px] text-stone-700">/{product.slug}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <p className="mt-4 text-right text-[11px] text-stone-700">
                        Showing <span className="text-stone-500">{filtered.length}</span> of{" "}
                        <span className="text-stone-500">{products.length}</span> product{products.length !== 1 ? "s" : ""}
                    </p>
                </>
            )}
        </>
    );
}