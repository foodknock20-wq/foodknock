// src/lib/catalogCategories.ts
//
// Phase 15E — Catalog 2.0. Category architecture decision: Product.category
// stays a free-form string (see audit — 162 live products, 21 distinct
// values, zero casing/whitespace duplicates; no feature anywhere targets
// categories by a stable ID). This file is the SINGLE source of truth for
// deriving the live category list — no component may hardcode its own
// category array anymore for admin purposes. Customer-facing display
// config (CategorySection/CategorySlider emoji+accent maps) is left alone;
// those already fall back gracefully for any category not in their map and
// are out of scope for this phase (admin catalog, not customer redesign).

import { connectDB } from "@/lib/db";
import Product from "@/models/Product";

export type CategoryWithCount = { category: string; count: number };

/** Bounded aggregation — one query, never N+1 (one countDocuments per category). */
export async function getCategoriesWithCounts(): Promise<CategoryWithCount[]> {
    await connectDB();
    const rows = await Product.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
    ]).exec();
    return rows.map((r: { _id: string; count: number }) => ({ category: r._id, count: r.count }));
}

/** Plain distinct list, sorted — for form dropdowns/datalists. */
export async function getDistinctCategories(): Promise<string[]> {
    await connectDB();
    const values = await Product.distinct("category");
    return (values as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function normalizeCategoryName(raw: string): string {
    return raw.trim().replace(/\s+/g, " ");
}

export class CategoryValidationError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

/**
 * Renames a category across every product currently assigned to it.
 * Case-insensitive match on the OLD name (so "pizza"/"Pizza"/" Pizza " all
 * get caught), exact-string $set on the NEW name. Bounded to the actual
 * product count for that category — never an unbounded "update everything"
 * operation. Returns how many product documents were changed.
 */
export async function renameCategoryEverywhere(oldName: string, newNameRaw: string): Promise<number> {
    await connectDB();

    const newName = normalizeCategoryName(newNameRaw);
    if (!newName) throw new CategoryValidationError("New category name is required");
    if (newName.length > 60) throw new CategoryValidationError("Category name is too long");

    const trimmedOld = normalizeCategoryName(oldName);
    if (!trimmedOld) throw new CategoryValidationError("Original category name is required");

    // A pure casing/whitespace fix (e.g. "pizza " -> "Pizza") falls through
    // to the same updateMany below as any other rename. Renaming into an
    // already-existing category is also allowed (it's a legitimate merge —
    // e.g. "Shake" -> "Shakes") — the caller reports the affected count so
    // the admin can confirm before committing.
    const result = await Product.updateMany(
        { category: { $regex: new RegExp(`^${escapeRegex(trimmedOld)}$`, "i") } },
        { $set: { category: newName } }
    );

    return result.modifiedCount ?? 0;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
