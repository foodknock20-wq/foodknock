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
    Star, AlertTriangle, Loader2, ImageOff, Power, Check, X as XIcon,
} from "lucide-react";
import { cdnImage } from "@/lib/cdnImage";
import { LOW_STOCK_THRESHOLD } from "@/lib/catalogConstants";

// Phase 15A: search is now server-side (AdminListSearchBar on the parent
// page, filtering via Product.find({$or:[...]}) before pagination) — this
// component only ever receives the current page's rows and renders them
// as-is. No client-side filtering/search state lives here anymore.

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
            : stock <= LOW_STOCK_THRESHOLD
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-stone-800/60 text-stone-500 border-stone-700/40";

    return (
        <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-bold ${style}`}>
            {stock}
        </span>
    );
}

// ─── Stock quick-adjust — click to edit, Enter/blur to save ────────────────
function StockEditor({ productId, stock, onSaved }: { productId: string; stock: number; onSaved: (next: number) => void }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(String(stock));
    const [saving, setSaving] = useState(false);

    const save = async () => {
        const next = Number(value);
        if (!Number.isFinite(next) || next < 0 || !Number.isInteger(next)) {
            toast.error("Enter a valid stock quantity");
            return;
        }
        if (next === stock) { setEditing(false); return; }
        setSaving(true);
        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stock: next }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message ?? "Failed to update stock"); return; }
            toast.success("Stock updated");
            onSaved(next);
            setEditing(false);
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <button onClick={() => { setValue(String(stock)); setEditing(true); }} title="Click to adjust stock">
                <StockBadge stock={stock} />
            </button>
        );
    }

    return (
        <div className="flex items-center gap-1">
            <input
                type="number"
                min={0}
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                disabled={saving}
                className="h-7 w-16 rounded-lg border border-amber-500/40 bg-white/[0.05] px-2 text-[12px] font-bold text-stone-200 focus:outline-none"
            />
            <button onClick={save} disabled={saving} className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={12} />}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-stone-300 hover:text-stone-100">
                <XIcon size={12} />
            </button>
        </div>
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-stone-300 transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-stone-300 transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
        >
            <Trash2 size={12} strokeWidth={2} />
        </button>
    );
}

function ToggleBtn({ isAvailable, loading, onClick }: { isAvailable: boolean; loading: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            title={isAvailable ? "Deactivate" : "Activate"}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all disabled:opacity-50 ${isAvailable
                    ? "border-white/[0.06] bg-white/[0.02] text-stone-300 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
                    : "border-white/[0.06] bg-white/[0.02] text-stone-300 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400"
                }`}
        >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} strokeWidth={2} />}
        </button>
    );
}

// ─── Component ────────────────────────────────────────────────────────────
export default function ProductTable({ products: initialProducts }: Props) {
    const router = useRouter();
    const products = initialProducts; // Phase 15A: one server-rendered page, no local copy needed
    const [deleting, setDeleting] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(deleteTarget._id);
        try {
            const res = await fetch(`/api/products/${deleteTarget._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message ?? "Failed to delete"); return; }
            toast.success("Product deleted");
            router.refresh();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setDeleting(null);
            setDeleteTarget(null);
        }
    };

    const handleToggleAvailable = async (product: ProductRow) => {
        setToggling(product._id);
        try {
            const res = await fetch(`/api/products/${product._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isAvailable: !product.isAvailable }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message ?? "Failed to update"); return; }
            toast.success(product.isAvailable ? "Product deactivated" : "Product activated");
            router.refresh();
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setToggling(null);
        }
    };

    const toggleSelected = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleBulkStatus = async (isAvailable: boolean) => {
        if (selected.size === 0) return;
        setBulkLoading(true);
        try {
            const res = await fetch("/api/admin/products/bulk-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [...selected], isAvailable }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message ?? "Bulk update failed"); return; }
            toast.success(`${data.updatedCount} product${data.updatedCount !== 1 ? "s" : ""} ${isAvailable ? "activated" : "deactivated"}`);
            setSelected(new Set());
            router.refresh();
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setBulkLoading(false);
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

            {selected.size > 0 && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5">
                    <span className="text-[12px] font-bold text-amber-400">{selected.size} selected</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleBulkStatus(true)}
                            disabled={bulkLoading}
                            className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                            Activate
                        </button>
                        <button
                            onClick={() => handleBulkStatus(false)}
                            disabled={bulkLoading}
                            className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-400 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
                        >
                            Deactivate
                        </button>
                        <button
                            onClick={() => setSelected(new Set())}
                            disabled={bulkLoading}
                            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold text-stone-300 hover:text-stone-100"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {products.length === 0 ? (
                <EmptyState />
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
                                    <th className="w-10 px-4 py-3.5" />
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
                                {products.map((product) => (
                                    <tr
                                        key={product._id}
                                        className="group transition-colors hover:bg-white/[0.018]"
                                    >
                                        <td className="px-4 py-3.5">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(product._id)}
                                                onChange={() => toggleSelected(product._id)}
                                                className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-amber-500"
                                            />
                                        </td>
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
                                            <StockEditor
                                                productId={product._id}
                                                stock={product.stock}
                                                onSaved={() => router.refresh()}
                                            />
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
                                                    <span title="Featured">
                                                        <Star size={13} className="fill-amber-400 text-amber-400" />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <ToggleBtn
                                                    isAvailable={product.isAvailable}
                                                    loading={toggling === product._id}
                                                    onClick={() => handleToggleAvailable(product)}
                                                />
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
                        {products.map((product) => (
                            <div
                                key={product._id}
                                className="rounded-2xl border border-white/[0.055] bg-gradient-to-b from-[#111118] to-[#0d0d14] overflow-hidden"
                            >
                                <div className="flex items-start gap-3 p-3.5">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(product._id)}
                                        onChange={() => toggleSelected(product._id)}
                                        className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-white/[0.05] accent-amber-500"
                                    />
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
                                            <StockEditor
                                                productId={product._id}
                                                stock={product.stock}
                                                onSaved={() => router.refresh()}
                                            />
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
                                        <ToggleBtn
                                            isAvailable={product.isAvailable}
                                            loading={toggling === product._id}
                                            onClick={() => handleToggleAvailable(product)}
                                        />
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

                </>
            )}
        </>
    );
}