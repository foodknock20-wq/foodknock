export const dynamic = "force-dynamic";

// src/app/admin/products/edit/[id]/page.tsx

import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import ProductForm, { ProductFormData } from "@/components/admin/products/ProductForm";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import mongoose from "mongoose";

type PageProps = { params: Promise<{ id: string }> };

async function getProduct(id: string): Promise<ProductFormData | null> {
    try {
        await connectDB();
        if (!mongoose.Types.ObjectId.isValid(id)) return null;

        const product = await Product.findById(id)
            // ← add compareAtPrice to the select
            .select("name slug description shortDescription price compareAtPrice category image stock isAvailable isFeatured tags")
            .lean();

        if (!product) return null;
        const p = product as any;

        return {
            name:             p.name             ?? "",
            slug:             p.slug             ?? "",
            description:      p.description      ?? "",
            shortDescription: p.shortDescription ?? "",
            price:            String(p.price     ?? ""),
            // If null/undefined → empty string so the input is blank (not "null")
            compareAtPrice:   p.compareAtPrice != null ? String(p.compareAtPrice) : "",
            category:         p.category         ?? "",
            image:            p.image             ?? "",
            stock:            String(p.stock      ?? ""),
            isAvailable:      p.isAvailable       ?? true,
            isFeatured:       p.isFeatured        ?? false,
            tags:             Array.isArray(p.tags) ? p.tags.join(", ") : (p.tags ?? ""),
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
        <div className="space-y-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <Link
                        href="/admin/products"
                        className="group mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-600 transition-colors hover:text-amber-400"
                    >
                        <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
                        Back to Products
                    </Link>

                    <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                        <Pencil size={11} className="text-amber-400" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                            Edit Product
                        </span>
                    </div>

                    <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">
                        {initialData.name || "Edit Product"}
                    </h1>
                    <p className="mt-1 text-sm text-stone-600">
                        Update the fields below and save your changes.
                    </p>
                </div>

                {initialData.image && (
                    <div className="mt-2 h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] sm:mt-0">
                        <img src={initialData.image} alt={initialData.name} className="h-full w-full object-cover" />
                    </div>
                )}
            </div>

            <ProductForm mode="edit" productId={id} initialData={initialData} />
        </div>
    );
}