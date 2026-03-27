export const dynamic = "force-dynamic";

// src/app/admin/products/page.tsx

import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import ProductTable, { ProductRow } from "@/components/admin/products/ProductTable";
import Link from "next/link";
import { Plus, Package } from "lucide-react";

async function getProducts(): Promise<ProductRow[]> {
    await connectDB();
    const products = await Product.find()
        .sort({ createdAt: -1 })
        // ← add compareAtPrice to the select
        .select("_id name slug category price compareAtPrice stock isAvailable isFeatured image")
        .lean();

    return products.map((p: any) => ({
        _id:            p._id.toString(),
        name:           p.name           ?? "",
        slug:           p.slug           ?? "",
        category:       p.category       ?? "—",
        price:          p.price          ?? 0,
        compareAtPrice: p.compareAtPrice ?? null,   // ← new
        stock:          p.stock          ?? 0,
        isAvailable:    p.isAvailable    ?? false,
        isFeatured:     p.isFeatured     ?? false,
        image:          p.image          ?? "",
    }));
}

export default async function AdminProductsPage() {
    const products = await getProducts();

    const totalAvailable = products.filter((p) => p.isAvailable).length;
    const totalFeatured  = products.filter((p) => p.isFeatured).length;
    const lowStock       = products.filter((p) => p.stock <= 5).length;

    return (
        <div className="space-y-6">

            {/* ── Page header ── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                        <Package size={11} className="text-amber-400" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                            Products
                        </span>
                    </div>
                    <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">
                        Product Catalogue
                    </h1>
                    <p className="mt-1 text-sm text-stone-600">
                        Manage your full menu — {products.length} product{products.length !== 1 ? "s" : ""} total
                    </p>
                </div>

                <Link
                    href="/admin/products/new"
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-stone-950 shadow-lg shadow-amber-500/20 transition-all hover:brightness-110 hover:shadow-amber-500/30"
                >
                    <Plus size={16} strokeWidth={2.5} />
                    Add Product
                </Link>
            </div>

            {/* ── Quick stats strip ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Total",     value: products.length,  color: "text-white" },
                    { label: "Available", value: totalAvailable,   color: "text-emerald-400" },
                    { label: "Featured",  value: totalFeatured,    color: "text-amber-400" },
                    { label: "Low Stock", value: lowStock,         color: lowStock > 0 ? "text-rose-400" : "text-stone-500" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-white/[0.06] bg-[#111118] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-600">{label}</p>
                        <p className={`mt-1 font-serif text-2xl font-black ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Table ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <ProductTable products={products} />
            </div>
        </div>
    );
}