"use client";

// src/components/ui/CategoryCardShell.tsx
//
// FoodKnock UI 2.0 — Phase 1 built this as an additive, dark-theme-ready
// CategoryCard foundation. Phase 2 is the first phase to render it live —
// see src/components/home/CategoryRail.tsx, which reuses
// src/components/products/CategorySlider.tsx's existing CAT_CONFIG map for
// thumbnails rather than inventing a third category-styling system
// (Menu's CategorySlider.tsx/CategorySection.tsx are themselves untouched).
// Category data has no dedicated model (see src/lib/catalogCategories.ts)
// — it's a free-form string on Product — so this accepts plain
// label/image/count props rather than a Category type.

import { cdnImage } from "@/lib/cdnImage";
import { cn } from "@/lib/utils";

export interface CategoryCardShellProps {
    label: string;
    image?: string;
    count?: number;
    selected?: boolean;
    variant?: "horizontal" | "grid";
    onClick?: () => void;
    className?: string;
}

export default function CategoryCardShell({
    label,
    image,
    count,
    selected = false,
    variant = "horizontal",
    onClick,
    className,
}: CategoryCardShellProps) {
    const isGrid = variant === "grid";

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={cn(
                "flex shrink-0 items-center gap-3 rounded-fk-lg border p-2.5 text-left transition-all active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fk-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-fk-bg",
                isGrid ? "flex-col text-center" : "flex-row",
                selected
                    ? "border-transparent bg-fk-surface-selected"
                    : "border-fk-border bg-fk-surface-elevated hover:bg-fk-surface-interactive",
                className
            )}
        >
            <div
                className={cn(
                    "shrink-0 overflow-hidden rounded-full bg-fk-surface-interactive",
                    isGrid ? "h-14 w-14" : "h-11 w-11"
                )}
            >
                {image && (
                    <img src={cdnImage(image, 100)} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                )}
            </div>
            <div className={cn("min-w-0", isGrid && "w-full")}>
                <p
                    className={cn(
                        "truncate text-[12.5px] font-bold",
                        selected ? "text-[var(--fk-accent)]" : "text-fk-text"
                    )}
                >
                    {label}
                </p>
                {typeof count === "number" && <p className="text-[10.5px] text-fk-text-tertiary">{count} items</p>}
            </div>
        </button>
    );
}
