// src/components/home/CategoryRail.tsx
//
// FoodKnock UI 2.0 — Phase 2: real food-category discovery rail (spec
// section 9). Server component — no interactivity needed beyond links.
// Categories come from src/lib/catalogCategories.ts's getCategoriesWithCounts()
// (real aggregation over Product.category, already used by admin — reused
// here, not duplicated). Thumbnails reuse the same real category-image map
// src/components/products/CategorySlider.tsx uses on Menu — imported from
// the neutral, server-safe src/lib/categoryConfig.ts (NOT from
// CategorySlider.tsx itself, which has a "use client" boundary — importing
// a plain function from a client-bound module into this Server Component
// previously caused a runtime "Attempted to call getCfg() from the
// server" error; see categoryConfig.ts's header for the full fix).

import Link from "next/link";
import type { CategoryWithCount } from "@/lib/catalogCategories";
import { getCfg } from "@/lib/categoryConfig";
import CategoryCardShell from "@/components/ui/CategoryCardShell";

export default function CategoryRail({ categories }: { categories: CategoryWithCount[] }) {
    if (categories.length === 0) return null;

    return (
        <section className="px-4 pt-5 md:px-8">
            <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-fk-text-tertiary">
                Browse Categories
            </h2>
            <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {categories.map(({ category, count }) => {
                    const cfg = getCfg(category);
                    return (
                        <Link key={category} href={`/menu?category=${encodeURIComponent(category)}`} className="shrink-0">
                            <CategoryCardShell label={cfg.label} image={cfg.image} count={count} variant="grid" />
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
