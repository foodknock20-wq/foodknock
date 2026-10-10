"use client";

// src/components/ui/Chip.tsx — FoodKnock UI 2.0 Phase 1 primitive.
// Pill-shaped selectable chip (category filters, quick filters).

import { cn } from "@/lib/utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    selected?: boolean;
    icon?: React.ReactNode;
}

export default function Chip({ selected = false, icon, className, children, ...props }: ChipProps) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            className={cn(
                "inline-flex h-9 min-h-[36px] shrink-0 items-center gap-1.5 rounded-fk-pill border px-3.5 text-[12.5px] font-bold transition-all duration-150 active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fk-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-fk-bg",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
                selected
                    ? "border-transparent bg-fk-surface-selected text-[var(--fk-accent)]"
                    : "border-fk-border bg-fk-surface-elevated text-fk-text-secondary hover:text-fk-text",
                className
            )}
            {...props}
        >
            {icon}
            {children}
        </button>
    );
}
