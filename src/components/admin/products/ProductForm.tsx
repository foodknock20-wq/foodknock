"use client";

// src/components/admin/products/ProductForm.tsx
// FIXED: Full mobile layout surgery — no phantom height, no overflow, true mobile-first

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
    Save, Loader2, Image as ImageIcon, Tag, Package,
    DollarSign, FileText, Hash, Eye, BadgePercent, Upload,
    ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────
export type ProductFormData = {
    name: string;
    slug: string;
    description: string;
    shortDescription: string;
    price: string;
    compareAtPrice: string;
    category: string;
    image: string;
    stock: string;
    isAvailable: boolean;
    isFeatured: boolean;
    tags: string;
};

type Props = {
    mode: "create" | "edit";
    productId?: string;
    initialData?: Partial<ProductFormData>;
};

const CATEGORIES = [
    "Coffee", "Cold Drinks", "Cold Coffee", "Tea", "Juice", "Shake",
    "Burger", "Pizza", "Sandwich", "Snacks", "Combos", "Ice Cream",
    "Momos", "Fries", "Pasta", "Noodles", "Maggi", "Chinese",
    "Pav Bhaji", "Patties", "Desserts", "Other",
];

const EMPTY: ProductFormData = {
    name: "", slug: "", description: "", shortDescription: "",
    price: "", compareAtPrice: "", category: "", image: "", stock: "",
    isAvailable: true, isFeatured: false, tags: "",
};

function parseTags(value: unknown): string[] {
    if (!value || typeof value !== "string") return [];
    return value.split(",").map((t) => t.trim()).filter(Boolean);
}

function toSlug(str: string): string {
    return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Sub-components ───────────────────────────────────────────────────────
function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
    return (
        <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">
                {children}
            </span>
            {optional && (
                <span className="rounded-full border border-stone-700/60 bg-stone-800/60 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-stone-600">
                    Optional
                </span>
            )}
        </div>
    );
}

const inputBase =
    "w-full rounded-xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-2.5 text-[13px] text-stone-200 placeholder:text-stone-700 transition-all duration-200 focus:border-amber-500/45 focus:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-amber-500/12 hover:border-white/[0.10]";

function Input({
    value, onChange, placeholder, type = "text", required,
}: {
    value: string; onChange: (v: string) => void;
    placeholder?: string; type?: string; required?: boolean;
}) {
    return (
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className={inputBase}
        />
    );
}

function Textarea({
    value, onChange, placeholder, rows = 3,
}: {
    value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className={`${inputBase} resize-none`}
        />
    );
}

function Toggle({
    checked, onChange, label, description,
}: {
    checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 transition-all duration-200 hover:border-amber-500/20 hover:bg-white/[0.04] active:scale-[0.99]"
        >
            <div className="text-left">
                <p className="text-[13px] font-semibold text-stone-200">{label}</p>
                {description && <p className="mt-0.5 text-[11px] text-stone-600">{description}</p>}
            </div>
            <div
                className={`relative ml-3 h-5 w-9 shrink-0 rounded-full transition-all duration-200 ${checked
                        ? "bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]"
                        : "bg-stone-800/80"
                    }`}
            >
                <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0.5"
                        }`}
                />
            </div>
        </button>
    );
}

function SectionCard({
    icon: Icon,
    title,
    children,
    className = "",
}: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`rounded-2xl border border-white/[0.055] bg-gradient-to-b from-[#111118] to-[#0d0d14] p-4 md:p-5 ${className}`}>
            <div className="mb-4 flex items-center gap-2.5 border-b border-white/[0.045] pb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/15 to-orange-500/8 text-amber-400 ring-1 ring-amber-500/15">
                    <Icon size={13} strokeWidth={2.5} />
                </div>
                <h3 className="text-[13px] font-black tracking-tight text-stone-300">{title}</h3>
            </div>
            {children}
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────
export default function ProductForm({ mode, productId, initialData }: Props) {
    const router = useRouter();
    const [form, setForm] = useState<ProductFormData>({ ...EMPTY, ...initialData });
    const [loading, setLoading] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [slugTouched, setSlugTouched] = useState(mode === "edit" && !!initialData?.slug);

    useEffect(() => {
        if (initialData) {
            setForm({ ...EMPTY, ...initialData });
            if (initialData.slug) setSlugTouched(true);
        }
    }, [initialData]);

    const set = (key: keyof ProductFormData) => (v: string | boolean) =>
        setForm((f) => ({ ...f, [key]: v }));

    const handleNameChange = (v: string) => {
        if (!slugTouched) {
            setForm((f) => ({ ...f, name: v, slug: toSlug(v) }));
        } else {
            set("name")(v);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Only JPEG, PNG, WEBP, or GIF images are allowed.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5 MB.");
            return;
        }

        setImageUploading(true);
        const toastId = toast.loading("Uploading image to Cloudinary…");

        try {
            const fd = new FormData();
            fd.append("file", file);

            const res = await fetch("/api/upload/image", { method: "POST", body: fd });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message ?? "Upload failed");

            setForm((prev) => ({ ...prev, image: data.url }));
            toast.success("Image uploaded!", { id: toastId });
        } catch (err: any) {
            toast.error(err.message ?? "Image upload failed. Please try again.", { id: toastId });
        } finally {
            setImageUploading(false);
            e.target.value = "";
        }
    };

    const priceParsed = Number(form.price);
    const compareAtPriceParsed = Number(form.compareAtPrice);
    const savingsPreview =
        form.compareAtPrice.trim() !== "" &&
            !isNaN(priceParsed) &&
            !isNaN(compareAtPriceParsed) &&
            compareAtPriceParsed > priceParsed
            ? Math.round(compareAtPriceParsed - priceParsed)
            : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.name.trim()) return toast.error("Product name is required");
        if (!form.slug.trim()) return toast.error("Slug is required");
        if (!form.price.trim()) return toast.error("Price is required");
        if (!form.category.trim()) return toast.error("Category is required");
        if (!form.image.trim()) return toast.error("Please upload a product image");

        if (form.image.startsWith("data:")) {
            return toast.error("Image upload is still in progress. Please wait.");
        }

        const parsedPrice = Number(form.price);
        const parsedStock = Number(form.stock);

        if (isNaN(parsedPrice) || parsedPrice < 0) return toast.error("Enter a valid price");
        if (isNaN(parsedStock) || parsedStock < 0) return toast.error("Enter a valid stock value");

        let parsedCompareAtPrice: number | null = null;
        if (form.compareAtPrice.trim() !== "") {
            parsedCompareAtPrice = Number(form.compareAtPrice);
            if (isNaN(parsedCompareAtPrice) || parsedCompareAtPrice < 0) {
                return toast.error("Enter a valid original price");
            }
            if (parsedCompareAtPrice <= parsedPrice) {
                return toast.error("Original price must be greater than the selling price");
            }
        }

        setLoading(true);

        const payload = {
            ...form,
            price: parsedPrice,
            compareAtPrice: parsedCompareAtPrice,
            stock: parsedStock,
            tags: parseTags(form.tags),
        };

        try {
            const res = await fetch(
                mode === "create" ? "/api/products" : `/api/products/${productId}`,
                {
                    method: mode === "create" ? "POST" : "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message ?? "Something went wrong");
                setLoading(false);
                return;
            }
            toast.success(mode === "create" ? "Product created!" : "Product updated!");
            router.push("/admin/products");
            router.refresh();
        } catch {
            toast.error("Network error. Please try again.");
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="w-full">
            {/*
              ── Layout: single column on mobile, 2-col on lg+
              Using auto rows, no fixed heights anywhere.
            ──────────────────────────────────────────────── */}
            <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-start">

                {/* ══ Main column ══ */}
                <div className="flex flex-col gap-4 min-w-0">

                    {/* Basic info */}
                    <SectionCard icon={FileText} title="Basic Information">
                        <div className="space-y-4">
                            {/* Name */}
                            <div>
                                <Label>Product Name <span className="ml-0.5 text-amber-500">*</span></Label>
                                <Input
                                    value={form.name}
                                    onChange={handleNameChange}
                                    placeholder="e.g. Cold Coffee Blend"
                                    required
                                />
                            </div>

                            {/* Slug */}
                            <div>
                                <Label>URL Slug <span className="ml-0.5 text-amber-500">*</span></Label>
                                {/* Mobile: stacked */}
                                <div className="flex flex-col gap-1.5 sm:hidden">
                                    <div className="flex items-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                                        <span className="text-[11px] text-stone-700">/products/</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={form.slug}
                                        onChange={(e) => {
                                            setSlugTouched(true);
                                            set("slug")(toSlug(e.target.value));
                                        }}
                                        placeholder="cold-coffee-blend"
                                        required
                                        className={inputBase}
                                    />
                                </div>
                                {/* Tablet+: inline */}
                                <div className="hidden sm:flex">
                                    <div className="flex h-[42px] shrink-0 items-center rounded-l-xl border border-r-0 border-white/[0.07] bg-white/[0.02] px-3 text-[11px] text-stone-700 whitespace-nowrap">
                                        /products/
                                    </div>
                                    <input
                                        type="text"
                                        value={form.slug}
                                        onChange={(e) => {
                                            setSlugTouched(true);
                                            set("slug")(toSlug(e.target.value));
                                        }}
                                        placeholder="cold-coffee-blend"
                                        required
                                        className="flex-1 min-w-0 rounded-l-none rounded-r-xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-2.5 text-[13px] text-stone-200 placeholder:text-stone-700 transition-all focus:border-amber-500/45 focus:outline-none focus:ring-2 focus:ring-amber-500/12"
                                    />
                                </div>
                                <p className="mt-1.5 text-[10.5px] text-stone-700">Auto-generated from name. Edit if needed.</p>
                            </div>

                            {/* Short desc */}
                            <div>
                                <Label optional>Short Description</Label>
                                <Input
                                    value={form.shortDescription}
                                    onChange={set("shortDescription")}
                                    placeholder="One-line summary shown on product cards"
                                />
                            </div>

                            {/* Full desc */}
                            <div>
                                <Label optional>Full Description</Label>
                                <Textarea
                                    value={form.description}
                                    onChange={set("description")}
                                    placeholder="Detailed product description…"
                                    rows={4}
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* Pricing & Inventory */}
                    <SectionCard icon={DollarSign} title="Pricing & Inventory">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <Label>Selling Price (₹) <span className="ml-0.5 text-amber-500">*</span></Label>
                                <Input
                                    value={form.price}
                                    onChange={set("price")}
                                    placeholder="0"
                                    type="number"
                                    required
                                />
                            </div>
                            <div>
                                <Label optional>Stock Qty</Label>
                                <Input
                                    value={form.stock}
                                    onChange={set("stock")}
                                    placeholder="0"
                                    type="number"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <Label optional>Original / Compare-at Price (₹)</Label>
                            <Input
                                value={form.compareAtPrice}
                                onChange={set("compareAtPrice")}
                                placeholder="e.g. 249 — leave blank to hide"
                                type="number"
                            />
                            <p className="mt-1.5 text-[10.5px] leading-relaxed text-stone-600">
                                Shows a strikethrough old price. Must be greater than selling price.
                            </p>

                            {savingsPreview !== null && (
                                <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-3.5 py-2.5">
                                    <BadgePercent size={14} className="shrink-0 text-emerald-400" />
                                    <div>
                                        <p className="text-[12px] font-black text-emerald-400">
                                            Customer saves ₹{savingsPreview}
                                        </p>
                                        <p className="text-[10px] text-emerald-600/80">
                                            Will show as:{" "}
                                            <span className="line-through opacity-60">₹{compareAtPriceParsed}</span>{" "}
                                            <span className="font-bold text-emerald-400">₹{priceParsed}</span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    {/* Tags */}
                    <SectionCard icon={Tag} title="Tags">
                        <Label optional>Tags (comma-separated)</Label>
                        <Input
                            value={form.tags}
                            onChange={set("tags")}
                            placeholder="cold, coffee, bestseller, summer"
                        />
                        {parseTags(form.tags).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {parseTags(form.tags).map((tag, i) => (
                                    <span
                                        key={`${tag}-${i}`}
                                        className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </div>

                {/* ══ Sidebar column ══
                    On mobile this stacks below main column naturally.
                    lg:sticky keeps it pinned on desktop without causing mobile issues.
                ──────────────────────────────────────────────── */}
                <div className="flex flex-col gap-4 min-w-0 lg:sticky lg:top-6">

                    {/* Category */}
                    <SectionCard icon={Hash} title="Category">
                        <Label>Category <span className="ml-0.5 text-amber-500">*</span></Label>
                        <select
                            value={form.category}
                            onChange={(e) => set("category")(e.target.value)}
                            required
                            className={`${inputBase} appearance-none`}
                            style={{ backgroundImage: "none" }}
                        >
                            <option value="" className="bg-[#0d0d14]">Select a category…</option>
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c} className="bg-[#0d0d14]">{c}</option>
                            ))}
                        </select>
                    </SectionCard>

                    {/* Image upload */}
                    <SectionCard icon={ImageIcon} title="Product Image">
                        <label
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm transition-all ${imageUploading
                                    ? "cursor-not-allowed border-white/[0.05] opacity-60"
                                    : "border-white/[0.08] hover:border-amber-500/30 hover:bg-amber-500/[0.03]"
                                }`}
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                {imageUploading
                                    ? <Loader2 size={13} className="animate-spin text-amber-400" />
                                    : <Upload size={13} className="text-amber-400" />
                                }
                            </div>
                            <div className="min-w-0">
                                <p className="text-[12px] font-semibold text-stone-400">
                                    {imageUploading ? "Uploading…" : "Choose image"}
                                </p>
                                <p className="text-[10px] text-stone-700">JPEG · PNG · WEBP · max 5 MB</p>
                            </div>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                disabled={imageUploading}
                                onChange={handleImageUpload}
                                className="sr-only"
                            />
                        </label>

                        {imageUploading && (
                            <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2">
                                <Loader2 size={11} className="animate-spin text-amber-400" />
                                <span className="text-[11px] text-amber-400/80">Uploading to Cloudinary…</span>
                            </div>
                        )}

                        {/* Preview */}
                        <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.015]">
                            {form.image ? (
                                <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={form.image}
                                        alt="Preview"
                                        className="h-36 w-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = "none";
                                        }}
                                    />
                                    <p className="truncate px-3 py-1.5 text-[10px] text-stone-700">
                                        {form.image}
                                    </p>
                                </>
                            ) : (
                                <div className="flex h-24 flex-col items-center justify-center gap-1.5 text-stone-700">
                                    <Eye size={14} />
                                    <span className="text-[11px]">Preview appears here</span>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    {/* Visibility & Status */}
                    <SectionCard icon={Package} title="Visibility & Status">
                        <div className="space-y-2.5">
                            <Toggle
                                checked={form.isAvailable}
                                onChange={(v) => set("isAvailable")(v)}
                                label="Available for Order"
                                description="Customers can add this to cart"
                            />
                            <Toggle
                                checked={form.isFeatured}
                                onChange={(v) => set("isFeatured")(v)}
                                label="Featured Product"
                                description="Shown in featured / popular sections"
                            />
                        </div>
                    </SectionCard>

                    {/* Submit */}
                    <div className="flex flex-col gap-2.5 pb-6">
                        <button
                            type="submit"
                            disabled={loading || imageUploading}
                            className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 via-amber-400 to-orange-500 py-3.5 text-[13px] font-black text-stone-950 shadow-lg shadow-amber-500/20 transition-all duration-200 hover:brightness-110 hover:shadow-amber-500/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                            <span className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-[100%]" />
                            {loading ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    Saving…
                                </>
                            ) : imageUploading ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    Uploading image…
                                </>
                            ) : (
                                <>
                                    <Save size={14} strokeWidth={2.5} />
                                    {mode === "create" ? "Create Product" : "Save Changes"}
                                    <ChevronRight size={13} className="ml-auto opacity-60" />
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex w-full items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-2.5 text-[12.5px] font-medium text-stone-600 transition-all duration-200 hover:border-white/[0.09] hover:bg-white/[0.04] hover:text-stone-300"
                        >
                            Cancel
                        </button>
                    </div>
                </div>

            </div>
        </form>
    );
}