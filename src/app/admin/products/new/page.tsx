export const dynamic = "force-dynamic";

// src/app/admin/products/new/page.tsx

import ProductForm from "@/components/admin/products/ProductForm";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

export default function NewProductPage() {
    return (
        <div className="space-y-6">

            {/* ── Page header ── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Link
                        href="/admin/products"
                        className="group mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-600 transition-colors hover:text-amber-400"
                    >
                        <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
                        Back to Products
                    </Link>
                    <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                        <Plus size={11} className="text-amber-400" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                            New Product
                        </span>
                    </div>
                    <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">
                        Add Product
                    </h1>
                    <p className="mt-1 text-sm text-stone-600">
                        Fill in the details below to add a new item to your menu.
                    </p>
                </div>
            </div>

            {/* ── Form ── */}
            <ProductForm mode="create" />
        </div>
    );
}