// src/lib/categoryOrder.ts
//
// Phase 3 — SINGLE shared source of truth for customer-facing category
// display order, used by both the homepage category rail
// (src/components/home/CategoryRail.tsx, a Server Component) and the
// /menu category slider + section order (src/components/products/
// MenuClient.tsx, a Client Component). Previously each page sorted
// categories independently: MenuClient had its own CATEGORY_ORDER +
// sortCats(), while the homepage rail just rendered whatever order
// getCategoriesWithCounts() happened to return (count-descending) — the
// two pages could show categories in different orders. This file is the
// ONLY place the preferred order is declared now; MenuClient.tsx's
// previous local copy was moved here verbatim (reordered per the Phase 3
// brief), not reinvented.
//
// No new categories are introduced here and no existing category is
// dropped — this only decides DISPLAY ORDER for whatever categories the
// real catalog (Product.category, via src/lib/catalogCategories.ts)
// actually returns. A category not in this list still renders — it's
// just placed after every listed one, alphabetically, exactly as before.

// Required lead sequence (Phase 3 brief, dynamic-pizza correction): Combos,
// then EVERY category whose name CONTAINS "pizza" (case-insensitive,
// whitespace-tolerant — not an exact-name match against "Pizza"/"Special
// Pizza"/etc.), then Sandwich, Burger, Fries, Momos, then the rest of the
// real catalog in a sensible order. "All" is NOT part of this list — it is
// a selection value, not a real Product.category, and each caller is
// responsible for representing it however that page already does
// (MenuClient prepends it as a tab; the homepage rail has no "All" tile at
// all, it only discovers real categories).
//
// WHY a substring match instead of a fixed name list: the live catalog's
// pizza-related categories are admin-managed free-form strings (see
// catalogCategories.ts) — confirmed real names include "Regular pizza" and
// "Large Pizza", neither of which is "Pizza" or "Special Pizza". A fixed
// name list would need editing every time a pizza category is renamed or a
// new one (e.g. "Premium Pizza", "Pizza Combos") is added. Matching on the
// word "pizza" anywhere in the name is robust to all of those without
// another code change.
const FIXED_TAIL_ORDER: string[] = [
    "Sandwich", "Burger", "Fries", "Momos",
    "Pasta", "Noodles", "Maggi", "Chinese", "Pavbhaji", "Patties",
    "Snacks", "Shake", "Juice", "Coffee", "Tea", "Ice Cream", "Thali",
];

const COMBOS_KEY = "combos";
const PIZZA_WORD = "pizza";

/** Tier 0 = Combos (fixed, always second overall after "All"). Tier 1 = any
 *  category whose name contains "pizza" anywhere (case-insensitive). Tier 2
 *  = the fixed tail list, in its declared order. Tier 3 = everything else
 *  (unknown/newly-added real categories), alphabetical. */
function tierOf(key: string): 0 | 1 | 2 | 3 {
    if (key === COMBOS_KEY) return 0;
    if (key.includes(PIZZA_WORD)) return 1;
    return 2; // resolved against FIXED_TAIL_ORDER below; falls through to 3 if absent
}

/**
 * Pure, deterministic, side-effect-free sort: orders `items` so that
 * "Combos" comes first, every category whose name contains the word
 * "pizza" comes immediately after (alphabetically among themselves, for a
 * stable, predictable order that needs no fixed name list), then the
 * FIXED_TAIL_ORDER categories in their declared order, then every other
 * real category alphabetically. Never mutates `items` — always returns a
 * new array. `items` can be any shape (a plain category name string, or an
 * object like {category, count}) — `getCategoryName` extracts the
 * comparable name (and is never mutated itself), so this one helper serves
 * both callers without forcing either page to reshape its existing data.
 */
export function sortCategoriesByPriority<T>(
    items: readonly T[],
    getCategoryName: (item: T) => string
): T[] {
    const tailIndex = new Map<string, number>(
        FIXED_TAIL_ORDER.map((name, i) => [name.toLowerCase(), i])
    );

    const rank = (item: T): [number, number, string] => {
        const key = getCategoryName(item).trim().toLowerCase();
        const tier = tierOf(key);
        if (tier === 2) {
            const tailIdx = tailIndex.get(key);
            if (tailIdx !== undefined) return [2, tailIdx, key];
            return [3, 0, key]; // not in the fixed tail list — falls to the alphabetical "everything else" tier
        }
        return [tier, 0, key];
    };

    return [...items].sort((a, b) => {
        const [aTier, aSub, aKey] = rank(a);
        const [bTier, bSub, bKey] = rank(b);
        if (aTier !== bTier) return aTier - bTier;
        if (aTier === 2) return aSub - bSub; // fixed tail — declared order, not alphabetical
        // Tier 0 (Combos — at most one item), tier 1 (pizza-named), and
        // tier 3 (everything else) are all sorted alphabetically within
        // their own tier for a stable, predictable order.
        return aKey.localeCompare(bKey);
    });
}
