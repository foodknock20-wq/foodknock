"use client";

// src/components/products/ProductGrid.tsx

import { useEffect, useMemo, useState } from "react";
import ProductCard from "./ProductCard";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";

type Product = {
    _id: string;
    name: string;
    slug: string;
    description: string;
    shortDescription?: string;
    price: number;
    category: string;
    image: string;
    stock: number;
    isAvailable: boolean;
    isFeatured?: boolean;
    tags?: string[];
};

const ITEMS_PER_PAGE = 12;

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-amber-100 bg-white px-6 py-20 text-center shadow-sm">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-orange-100 bg-orange-50">
                {hasFilters ? (
                    <SearchX size={32} className="text-orange-400" strokeWidth={1.5} />
                ) : (
                    <span className="text-4xl">🍽️</span>
                )}
            </div>
            <h3 className="text-xl font-black text-stone-800">
                {hasFilters ? "No items found" : "Menu coming soon"}
            </h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
                {hasFilters
                    ? "Try a different search or category — we have lots of delicious options!"
                    : "Our menu is being prepared. Check back soon for something delicious!"}
            </p>
            {hasFilters && (
                <button
                    onClick={onReset}
                    className="mt-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-200 transition-all hover:brightness-110 active:scale-95"
                >
                    Show all items
                </button>
            )}
        </div>
    );
}

// ─── Pagination ───────────────────────────────────────────────────────────
function Pagination({
    currentPage, totalPages, onPageChange, totalItems, startItem, endItem,
}: {
    currentPage: number; totalPages: number; onPageChange: (p: number) => void;
    totalItems: number; startItem: number; endItem: number;
}) {
    if (totalPages <= 1) return null;

    const getPageNumbers = (): (number | "...")[] => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages: (number | "...")[] = [1];
        if (currentPage > 3) pages.push("...");
        const start = Math.max(2, currentPage - 1);
        const end   = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (currentPage < totalPages - 2) pages.push("...");
        pages.push(totalPages);
        return pages;
    };

    return (
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="text-xs text-stone-500 sm:text-sm">
                Showing <span className="font-bold text-stone-700">{startItem}–{endItem}</span> of{" "}
                <span className="font-bold text-stone-700">{totalItems}</span> items
            </p>
            <div className="flex items-center gap-1.5">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500 disabled:cursor-not-allowed disabled:opacity-30"
                >
                    <ChevronLeft size={15} strokeWidth={2.5} />
                </button>

                {getPageNumbers().map((page, i) =>
                    page === "..." ? (
                        <span key={`ellipsis-${i}`} className="flex h-9 w-9 items-center justify-center text-xs text-stone-400">…</span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange(page as number)}
                            aria-current={currentPage === page ? "page" : undefined}
                            className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition-all ${
                                currentPage === page
                                    ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200"
                                    : "border border-stone-200 bg-white text-stone-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500"
                            }`}
                        >
                            {page}
                        </button>
                    )
                )}

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500 disabled:cursor-not-allowed disabled:opacity-30"
                >
                    <ChevronRight size={15} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
}

// ─── Grid ─────────────────────────────────────────────────────────────────
export default function ProductGrid({
    products, onReset, hasFilters,
}: {
    products: Product[];
    onReset: () => void;
    hasFilters: boolean;
}) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex   = Math.min(startIndex + ITEMS_PER_PAGE, products.length);

    const paginated = useMemo(
        () => products.slice(startIndex, endIndex),
        [products, startIndex, endIndex]
    );

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        window.scrollTo({ top: 320, behavior: "smooth" });
    };

    useEffect(() => { setCurrentPage(1); }, [products]);

    if (!products.length) {
        return <EmptyState hasFilters={hasFilters} onReset={onReset} />;
    }

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {paginated.map((product, i) => (
                    <ProductCard key={product._id} product={product} index={i} />
                ))}
            </div>
            <Pagination
                currentPage={currentPage} totalPages={totalPages}
                onPageChange={handlePageChange} totalItems={products.length}
                startItem={startIndex + 1} endItem={endIndex}
            />
        </div>
    );
}