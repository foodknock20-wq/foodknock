"use client";

// src/components/products/MenuSort.tsx
//
// FoodKnock Phase 3 — sort sheet built on the Phase 1 BottomSheet
// primitive. Only real, honestly-useful options: Recommended (today's
// existing default ordering — available-first, isFeatured/recency), and
// Price Low→High / High→Low, computed client-side on the already-fetched
// catalog (no new fetch). Rating sort is deliberately omitted — the audit
// confirmed Product.rating has no admin UI and is null for virtually
// every real product today, so a "Sort by rating" option would be
// meaningless/misleading in practice.

import BottomSheet from "@/components/ui/BottomSheet";
import { Check, ArrowUpNarrowWide, ArrowDownWideNarrow, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuSortOption = "recommended" | "price-asc" | "price-desc";

const OPTIONS: { value: MenuSortOption; label: string; icon: React.ReactNode }[] = [
    { value: "recommended", label: "Recommended", icon: <Sparkles size={16} /> },
    { value: "price-asc", label: "Price: Low to High", icon: <ArrowUpNarrowWide size={16} /> },
    { value: "price-desc", label: "Price: High to Low", icon: <ArrowDownWideNarrow size={16} /> },
];

export default function MenuSort({
    open,
    onClose,
    value,
    onChange,
}: {
    open: boolean;
    onClose: () => void;
    value: MenuSortOption;
    onChange: (value: MenuSortOption) => void;
}) {
    return (
        <BottomSheet open={open} onClose={onClose} title="Sort by" ariaLabel="Sort menu items">
            <div className="space-y-2">
                {OPTIONS.map((opt) => {
                    const active = opt.value === value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onChange(opt.value);
                                onClose();
                            }}
                            aria-pressed={active}
                            className={cn(
                                "flex w-full items-center gap-3 rounded-fk-md border px-4 py-3.5 text-left transition-colors",
                                active
                                    ? "border-transparent bg-fk-surface-selected"
                                    : "border-fk-border bg-fk-surface-elevated hover:bg-fk-surface-interactive"
                            )}
                        >
                            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm", active ? "text-[var(--fk-accent)]" : "text-fk-text-secondary")}>
                                {opt.icon}
                            </span>
                            <span className={cn("flex-1 text-[13.5px] font-bold", active ? "text-[var(--fk-accent)]" : "text-fk-text")}>
                                {opt.label}
                            </span>
                            {active && <Check size={16} className="text-[var(--fk-accent)]" />}
                        </button>
                    );
                })}
            </div>
        </BottomSheet>
    );
}
