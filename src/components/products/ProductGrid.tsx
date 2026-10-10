"use client";

// src/components/products/ProductGrid.tsx
// PERF: wrapped with React.memo — prevents re-render when parent re-renders
//       with identical props (common during search debounce, category switches)
// PERF FIX: getPageNumbers wrapped in useCallback — prevents recreation on every render

import { useEffect, useMemo, useState, useCallback, memo } from "react";
import ProductCard from "./ProductCard";
import { ChevronLeft, ChevronRight, SearchX, UtensilsCrossed } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

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

// ─── Empty state — reuses the Phase 1 shared EmptyState primitive instead
// of a bespoke local implementation (consolidation per Phase 3's card/
// empty-state audit — this was its own 7th duplicate before). Same
// call-site API as before (`hasFilters`/`onReset`), just backed by the
// shared component now. Food-specific, non-generic copy per spec section
// 23 ("No tasty matches found", not a childish/generic ecommerce message).
const GridEmptyState = memo(function GridEmptyState({
    hasFilters,
    onReset,
}: {
    hasFilters: boolean;
    onReset: () => void;
}) {
    return (
        <EmptyState
            icon={hasFilters ? SearchX : UtensilsCrossed}
            title={hasFilters ? "No tasty matches found" : "Menu coming soon"}
            description={
                hasFilters
                    ? "Try a different search or category — we have lots of delicious options!"
                    : "Our menu is being prepared. Check back soon for something delicious!"
            }
            ctaLabel={hasFilters ? "Show all items" : undefined}
            onCtaClick={hasFilters ? onReset : undefined}
        />
    );
});

// ─── Pagination — memoized ────────────────────────────────────────────────────
const Pagination = memo(function Pagination({
    currentPage, totalPages, onPageChange, totalItems, startItem, endItem,
}: {
    currentPage: number; totalPages: number; onPageChange: (p: number) => void;
    totalItems: number; startItem: number; endItem: number;
}) {
    // PERF FIX: getPageNumbers wrapped in useCallback so it is not recreated on
    // every render — only recalculates when currentPage or totalPages actually changes.
    const getPageNumbers = useCallback((): (number | "...")[] => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages: (number | "...")[] = [1];
        if (currentPage > 3) pages.push("...");
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (currentPage < totalPages - 2) pages.push("...");
        pages.push(totalPages);
        return pages;
    }, [currentPage, totalPages]); // PERF FIX: precise deps — not recreated unless these change

    // PERF: memoize the computed page number array so it isn't rebuilt each render
    const pageNumbers = useMemo(() => getPageNumbers(), [getPageNumbers]);

    // Moved after the hooks above — a conditional return BEFORE hook calls
    // violates Rules of Hooks (if totalPages changes from >1 to <=1 across
    // renders, React would see fewer hooks called than the previous render).
    // Pre-existing bug, fixed here since this file is already being touched
    // this phase — behavior is unchanged (still renders nothing when there's
    // only one page).
    if (totalPages <= 1) return null;

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

                {pageNumbers.map((page, i) =>
                    page === "..." ? (
                        <span key={`ellipsis-${i}`} className="flex h-9 w-9 items-center justify-center text-xs text-stone-400">…</span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange(page as number)}
                            aria-current={currentPage === page ? "page" : undefined}
                            className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition-all ${currentPage === page
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
});

// ─── Grid — memoized outer component ─────────────────────────────────────────
// PERF: React.memo prevents full re-render when parent state changes but
//       products/onReset/hasFilters props haven't changed
const ProductGrid = memo(function ProductGrid({
    products, onReset, hasFilters,
}: {
    products: Product[];
    onReset: () => void;
    hasFilters: boolean;
}) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, products.length);

    const paginated = useMemo(
        () => products.slice(startIndex, endIndex),
        [products, startIndex, endIndex]
    );

    // OPTIMIZED: stable handlePageChange — useCallback prevents new fn on every render
    const handlePageChange = useCallback((page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        window.scrollTo({ top: 320, behavior: "auto" });
    }, [totalPages]);

    // PERF: reset to page 1 when products list changes (new filter/search)
    useEffect(() => { setCurrentPage(1); }, [products]);

    if (!products.length) {
        return <GridEmptyState hasFilters={hasFilters} onReset={onReset} />;
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
});

export default ProductGrid;