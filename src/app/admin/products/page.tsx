export const dynamic = "force-dynamic";

// src/app/admin/products/page.tsx
//
// Phase 15A — converted from an unbounded `Product.find()` (no limit at
// all — the entire catalogue shipped to the browser on every page load)
// to true server-side pagination. The quick-stats strip (Total/Available/
// Featured/Low Stock) is computed via `countDocuments()` over the WHOLE
// collection (cheap, bounded-output counts — never fetches documents), so
// those numbers stay accurate regardless of which page is being viewed.

import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import ProductTable, { ProductRow } from "@/components/admin/products/ProductTable";
import Pagination from "@/components/admin/shared/Pagination";
import AdminListSearchBar from "@/components/admin/shared/AdminListSearchBar";
import ProductFilters from "@/components/admin/products/ProductFilters";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import { parseAdminPagination, buildPaginationMeta } from "@/lib/adminPagination";
import { getDistinctCategories } from "@/lib/catalogCategories";
import { LOW_STOCK_THRESHOLD, sortToMongo, stockFilterToMongo, statusFilterToMongo } from "@/lib/catalogConstants";
import Link from "next/link";
import { Plus, Package } from "lucide-react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function str(v: string | string[] | undefined): string | undefined {
    return typeof v === "string" && v.length > 0 ? v : undefined;
}

async function getProducts(searchParams: Awaited<SearchParams>) {
    await connectDB();

    const { page, limit, skip } = parseAdminPagination(searchParams, { defaultLimit: 25, maxLimit: 100 });
    const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
    const status = str(searchParams.status);
    const stock = str(searchParams.stock);
    const category = str(searchParams.category);
    const sort = str(searchParams.sort);

    const filter: Record<string, unknown> = {};
    if (search) {
        filter.$or = [{ name: { $regex: search, $options: "i" } }, { category: { $regex: search, $options: "i" } }];
    }
    const statusFilter = statusFilterToMongo(status);
    if (statusFilter) Object.assign(filter, statusFilter);
    const stockFilter = stockFilterToMongo(stock);
    if (stockFilter) Object.assign(filter, stockFilter);
    if (category && category !== "all") {
        filter.category = category;
    }

    const [rows, total, totalAvailable, totalFeatured, lowStock, totalAll, categories] = await Promise.all([
        Product.find(filter)
            .sort(sortToMongo(sort))
            .skip(skip)
            .limit(limit)
            .select("_id name slug category price compareAtPrice stock isAvailable isFeatured image")
            .lean(),
        Product.countDocuments(filter),
        Product.countDocuments({ isAvailable: true }),
        Product.countDocuments({ isFeatured: true }),
        Product.countDocuments({ stock: { $lte: LOW_STOCK_THRESHOLD } }),
        Product.countDocuments({}),
        getDistinctCategories(),
    ]);

    const products: ProductRow[] = rows.map((p: {
        _id: { toString(): string }; name?: string; slug?: string; category?: string; price?: number;
        compareAtPrice?: number | null; stock?: number; isAvailable?: boolean; isFeatured?: boolean; image?: string;
    }) => ({
        _id:            p._id.toString(),
        name:           p.name           ?? "",
        slug:           p.slug           ?? "",
        category:       p.category       ?? "—",
        price:          p.price          ?? 0,
        compareAtPrice: p.compareAtPrice ?? null,
        stock:          p.stock          ?? 0,
        isAvailable:    p.isAvailable    ?? false,
        isFeatured:     p.isFeatured     ?? false,
        image:          p.image          ?? "",
    }));

    return {
        products,
        meta: buildPaginationMeta(total, page, limit),
        stats: { totalAll, totalAvailable, totalFeatured, lowStock },
        categories,
        activeFilters: { status, stock, category, sort, search: search || undefined },
    };
}

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
    const resolvedSearchParams = await searchParams;
    const { products, meta, stats, categories, activeFilters } = await getProducts(resolvedSearchParams);

    const search = activeFilters.search;

    return (
        <div className="space-y-5">

            <AdminPageHeader
                icon={Package}
                title="Products"
                description={`${stats.totalAll} product${stats.totalAll !== 1 ? "s" : ""} · ${stats.totalAvailable} available · ${stats.lowStock} low stock`}
                actions={
                    <>
                        <Link
                            href="/admin/categories"
                            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-stone-200 transition-all hover:border-white/[0.15] hover:bg-white/[0.07]"
                        >
                            Categories
                        </Link>
                        <Link
                            href="/admin/products/new"
                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-stone-950 shadow-lg shadow-amber-500/20 transition-all hover:brightness-110 hover:shadow-amber-500/30"
                        >
                            <Plus size={16} strokeWidth={2.5} />
                            Add Product
                        </Link>
                    </>
                }
            />

            {/* ── Quick stats strip ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Total",     value: stats.totalAll,       color: "text-white" },
                    { label: "Available", value: stats.totalAvailable, color: "text-emerald-400" },
                    { label: "Featured",  value: stats.totalFeatured,  color: "text-amber-400" },
                    { label: "Low Stock", value: stats.lowStock,       color: stats.lowStock > 0 ? "text-rose-400" : "text-stone-500" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-white/[0.06] bg-[#111118] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-600">{label}</p>
                        <p className={`mt-1 font-serif text-2xl font-black ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Table ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <div className="mb-5 space-y-3">
                    <AdminListSearchBar placeholder="Search products…" />
                    {search && (
                        <p className="text-[11px] text-stone-600">
                            {meta.total} result{meta.total !== 1 ? "s" : ""} for &quot;{search}&quot;
                        </p>
                    )}
                    <ProductFilters categories={categories} lowStockCount={stats.lowStock} />
                </div>

                <ProductTable products={products} />

                <Pagination
                    meta={meta}
                    basePath="/admin/products"
                    searchParams={{
                        search,
                        status: activeFilters.status,
                        stock: activeFilters.stock,
                        category: activeFilters.category,
                        sort: activeFilters.sort,
                    }}
                    itemLabel="products"
                />
            </div>
        </div>
    );
}
