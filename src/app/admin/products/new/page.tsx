export const dynamic = "force-dynamic";

// src/app/admin/products/new/page.tsx
// FIXED: Removed min-h-screen from outer wrapper — was causing phantom height on mobile

import ProductForm from "@/components/admin/products/ProductForm";
import Link from "next/link";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";

export default function NewProductPage() {
    return (
        <div className="pb-10">
            {/* ── Page Header ── */}
            <div className="mb-6 md:mb-8">
                {/* Back nav */}
                <Link
                    href="/admin/products"
                    className="group mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600 transition-all hover:text-amber-400"
                >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] transition-all group-hover:border-amber-500/25 group-hover:bg-amber-500/[0.08]">
                        <ArrowLeft size={11} className="transition-transform group-hover:-translate-x-0.5" />
                    </span>
                    Back to Products
                </Link>

                {/* Badge + heading */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1.5 shadow-[0_0_12px_rgba(245,158,11,0.08)]">
                            <Plus size={11} className="text-amber-400" strokeWidth={2.5} />
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">
                                New Product
                            </span>
                        </div>

                        <h1 className="text-2xl font-black tracking-tight text-white md:text-[28px]">
                            Add to Menu
                        </h1>
                        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-stone-500">
                            Fill in the details below to add a new item to your menu.{" "}
                            Fields marked <span className="text-amber-500">*</span> are required.
                        </p>
                    </div>

                    {/* Desktop hint badge */}
                    <div className="hidden items-center gap-2 self-start rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-2.5 sm:flex">
                        <Sparkles size={12} className="text-amber-500/60" />
                        <span className="text-[11px] text-stone-600">Images auto-upload to Cloudinary</span>
                    </div>
                </div>

                {/* Divider */}
                <div className="mt-5 h-px bg-gradient-to-r from-amber-500/20 via-white/[0.04] to-transparent" />
            </div>

            {/* ── Form ── */}
            <ProductForm mode="create" />
        </div>
    );
}