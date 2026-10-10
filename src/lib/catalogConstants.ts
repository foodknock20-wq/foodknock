// src/lib/catalogConstants.ts
//
// Phase 15E — centralized catalog thresholds. Previously "stock <= 5"
// was a magic number duplicated in the admin products page (stats query)
// and ProductTable (StockBadge color). One constant now, reused by both
// plus the new stock quick-filter — never scattered across files again.

export const LOW_STOCK_THRESHOLD = 5;

export type StockFilter = "all" | "in" | "low" | "out";
export type StatusFilter = "all" | "active" | "inactive";
export type ProductSort =
    | "newest" | "oldest"
    | "price_asc" | "price_desc"
    | "name_asc" | "name_desc"
    | "stock_asc" | "stock_desc";

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
    { value: "name_asc", label: "Name: A to Z" },
    { value: "name_desc", label: "Name: Z to A" },
    { value: "stock_asc", label: "Stock: Low to High" },
    { value: "stock_desc", label: "Stock: High to Low" },
];

export function sortToMongo(sort: string | undefined): Record<string, 1 | -1> {
    switch (sort as ProductSort) {
        case "oldest": return { createdAt: 1 };
        case "price_asc": return { price: 1 };
        case "price_desc": return { price: -1 };
        case "name_asc": return { name: 1 };
        case "name_desc": return { name: -1 };
        case "stock_asc": return { stock: 1 };
        case "stock_desc": return { stock: -1 };
        case "newest":
        default: return { createdAt: -1 };
    }
}

export function stockFilterToMongo(stock: string | undefined): Record<string, unknown> | null {
    switch (stock as StockFilter) {
        case "out": return { stock: 0 };
        case "low": return { stock: { $gt: 0, $lte: LOW_STOCK_THRESHOLD } };
        case "in": return { stock: { $gt: LOW_STOCK_THRESHOLD } };
        default: return null;
    }
}

export function statusFilterToMongo(status: string | undefined): Record<string, unknown> | null {
    switch (status as StatusFilter) {
        case "active": return { isAvailable: true };
        case "inactive": return { isAvailable: false };
        default: return null;
    }
}
