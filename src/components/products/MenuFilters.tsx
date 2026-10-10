"use client";

// src/components/products/MenuFilters.tsx
//
// FoodKnock Phase 3 (Menu/Search/Discovery) — premium filter sheet, built
// on the existing Phase 1 BottomSheet primitive (reused, not duplicated).
// Exactly two real, data-backed filters — confirmed via full codebase +
// schema audit that nothing else is honestly supportable today:
//   - "Offers only"  → compareAtPrice > price (real discount math already
//                       used by every product card)
//   - "Hide sold out" → isAvailable && stock > 0 (real stock fields)
// No veg/non-veg, price-range, or rating filters — no real schema field
// backs any of them (see Phase 3 plan's audit section).

import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { Tag, PackageCheck } from "lucide-react";

export interface MenuFilterState {
    offersOnly: boolean;
    hideSoldOut: boolean;
}

export const DEFAULT_MENU_FILTERS: MenuFilterState = {
    offersOnly: false,
    hideSoldOut: false,
};

function FilterRow({
    icon,
    label,
    description,
    checked,
    onChange,
}: {
    icon: React.ReactNode;
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            aria-pressed={checked}
            className="flex w-full items-center gap-3 rounded-fk-md border border-fk-border bg-fk-surface-elevated px-4 py-3.5 text-left transition-colors hover:bg-fk-surface-interactive"
        >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-surface-selected text-[var(--fk-accent)]">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold text-fk-text">{label}</span>
                <span className="block text-[11px] text-fk-text-tertiary">{description}</span>
            </span>
            <span
                className={
                    checked
                        ? "flex h-6 w-11 shrink-0 items-center rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] p-0.5 transition-colors"
                        : "flex h-6 w-11 shrink-0 items-center rounded-fk-pill bg-fk-surface-interactive p-0.5 transition-colors"
                }
            >
                <span
                    className={
                        checked
                            ? "h-5 w-5 translate-x-5 rounded-full bg-white shadow transition-transform"
                            : "h-5 w-5 translate-x-0 rounded-full bg-white shadow transition-transform"
                    }
                />
            </span>
        </button>
    );
}

export default function MenuFilters({
    open,
    onClose,
    filters,
    onChange,
    resultCount,
}: {
    open: boolean;
    onClose: () => void;
    filters: MenuFilterState;
    onChange: (filters: MenuFilterState) => void;
    resultCount?: number;
}) {
    return (
        <BottomSheet open={open} onClose={onClose} title="Filters" ariaLabel="Filter menu items">
            <div className="space-y-2.5">
                <FilterRow
                    icon={<Tag size={16} />}
                    label="Offers only"
                    description="Items with a discount applied"
                    checked={filters.offersOnly}
                    onChange={(v) => onChange({ ...filters, offersOnly: v })}
                />
                <FilterRow
                    icon={<PackageCheck size={16} />}
                    label="Hide sold out"
                    description="Only show items in stock right now"
                    checked={filters.hideSoldOut}
                    onChange={(v) => onChange({ ...filters, hideSoldOut: v })}
                />
            </div>

            <div className="mt-5 flex items-center gap-2.5">
                <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    onClick={() => onChange(DEFAULT_MENU_FILTERS)}
                    disabled={!filters.offersOnly && !filters.hideSoldOut}
                >
                    Reset
                </Button>
                <Button variant="primary" size="md" fullWidth onClick={onClose}>
                    {typeof resultCount === "number" ? `Show ${resultCount} items` : "Done"}
                </Button>
            </div>
        </BottomSheet>
    );
}
