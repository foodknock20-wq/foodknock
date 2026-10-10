export const dynamic = "force-dynamic";

// src/app/admin/categories/page.tsx
//
// Phase 15E — Category management, integrated as its own screen (justified
// here because rename is a real, bounded, server-authoritative operation —
// see src/lib/catalogCategories.ts for the architecture decision: category
// stays a free-form Product.category string, this page is just a safe UI
// over it, not a new collection/entity).

import { getCategoriesWithCounts } from "@/lib/catalogCategories";
import CategoryTable from "@/components/admin/categories/CategoryTable";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import Link from "next/link";
import { ArrowLeft, Tag } from "lucide-react";

export default async function AdminCategoriesPage() {
    const categories = await getCategoriesWithCounts();
    const totalProducts = categories.reduce((sum, c) => sum + c.count, 0);

    return (
        <div className="space-y-5">
            <Link
                href="/admin/products"
                className="group inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400 transition-all hover:text-amber-400"
            >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] transition-all group-hover:border-amber-500/25 group-hover:bg-amber-500/[0.08]">
                    <ArrowLeft size={11} className="transition-transform group-hover:-translate-x-0.5" />
                </span>
                Back to Products
            </Link>

            <AdminPageHeader
                icon={Tag}
                title="Categories"
                description={`${categories.length} categories · ${totalProducts} products — derived live from your catalog`}
            />

            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <CategoryTable categories={categories} />
            </div>
        </div>
    );
}
