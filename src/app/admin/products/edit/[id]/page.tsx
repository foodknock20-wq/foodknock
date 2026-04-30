export const dynamic = "force-dynamic";

// src/app/admin/products/edit/[id]/page.tsx
// PERF: product thumbnail in page header uses native <img> + cdnImage() — no Vercel transformation

import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import ProductForm, { ProductFormData } from "@/components/admin/products/ProductForm";
import Link from "next/link";
import { ArrowLeft, Pencil, ImageIcon } from "lucide-react";
import mongoose from "mongoose";
import { cdnImage } from "@/lib/cdnImage";

type PageProps = { params: Promise<{ id: string }> };

async function getProduct(id: string): Promise<ProductFormData | null> {
    try {
        await connectDB();
        if (!mongoose.Types.ObjectId.isValid(id)) return null;

        const product = await Product.findById(id)
            .select("name slug description shortDescription price compareAtPrice category image stock isAvailable isFeatured tags")
            .lean();

        if (!product) return null;
        const p = product as any;

        return {
            name: p.name ?? "",
            slug: p.slug ?? "",
            description: p.description ?? "",
            shortDescription: p.shortDescription ?? "",
            price: String(p.price ?? ""),
            compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : "",
            category: p.category ?? "",
            image: p.image ?? "",
            stock: String(p.stock ?? ""),
            isAvailable: p.isAvailable ?? true,
            isFeatured: p.isFeatured ?? false,
            tags: Array.isArray(p.tags) ? p.tags.join(", ") : (p.tags ?? ""),
        };
    } catch {
        return null;
    }
}

export default async function EditProductPage({ params }: PageProps) {
    const { id } = await params;
    const initialData = await getProduct(id);
    if (!initialData) notFound();

    return (
        <div className="pb-10">
            {/* ── Page Header ── */}
            <div className="mb-7 md:mb-8">
                {/* Back nav */}
                <Link
                    href="/admin/products"
                    className="group mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600 transition-all hover:text-amber-400"
                >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] transition-all group-hover:border-amber-500/25 group-hover:bg-amber-500/8">
                        <ArrowLeft size={11} className="transition-transform group-hover:-translate-x-0.5" />
                    </span>
                    Back to Products
                </Link>

                {/* Badge + heading row */}
                <div className="flex flex-col gap-4">
                    <div>
                        <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1.5 shadow-[0_0_12px_rgba(245,158,11,0.08)]">
                            <Pencil size={11} className="text-amber-400" strokeWidth={2.5} />
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">
                                Edit Product
                            </span>
                        </div>

                        <h1 className="text-2xl font-black tracking-tight text-white md:text-[28px]">
                            {initialData.name || "Edit Product"}
                        </h1>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
                            Update the fields below and save your changes.
                        </p>
                    </div>

                    {/* Thumbnail card — PERF: native img + cdnImage at 56px */}
                    {initialData.image && (
                        <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 sm:max-w-xs">
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.06]">
                                <img
                                    src={cdnImage(initialData.image, 80)}
                                    alt={initialData.name}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-600">Current Image</p>
                                <p className="mt-0.5 truncate text-[12px] font-semibold text-stone-400">
                                    {initialData.name}
                                </p>
                                <p className="mt-0.5 text-[10px] text-stone-700">Upload below to replace</p>
                            </div>
                        </div>
                    )}

                    {/* No image hint */}
                    {!initialData.image && (
                        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-4 py-3 sm:max-w-xs">
                            <ImageIcon size={16} className="shrink-0 text-stone-700" />
                            <p className="text-[12px] text-stone-600">No image uploaded yet — add one below</p>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="mt-5 h-px bg-gradient-to-r from-amber-500/20 via-white/[0.04] to-transparent" />
            </div>

            {/* ── Form ── */}
            <ProductForm mode="edit" productId={id} initialData={initialData} />
        </div>
    );
}