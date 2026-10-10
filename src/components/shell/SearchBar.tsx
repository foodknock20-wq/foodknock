"use client";

// src/components/shell/SearchBar.tsx
//
// FoodKnock UI 2.0 — Phase 1: reusable presentational search input. No
// search backend/logic lives here — callers own value/onChange/onClear
// (see src/components/products/MenuClient.tsx, which wires its existing
// debounced-URL-sync client-side filter state into this component,
// replacing only its inline <input> markup; filter/debounce behavior is
// byte-for-byte unchanged). `className`/`inputClassName` let a caller
// fully reskin it — used by MenuClient to keep its sticky search bar
// visually identical to the rest of the still-light-themed Menu page,
// while the default styling below is the dark shell look used inside
// CustomerHeader's "menu" variant.

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchBarProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
    placeholder?: string;
    loading?: boolean;
    className?: string;
    inputClassName?: string;
    autoFocus?: boolean;
    // Phase 3 (Menu) — optional passthroughs so a caller can show/hide
    // something (e.g. recent-search chips) based on focus state. Purely
    // additive/optional — every existing caller is unaffected.
    onFocus?: () => void;
    onBlur?: () => void;
}

export default function SearchBar({
    value,
    onChange,
    onClear,
    placeholder = "Search…",
    loading = false,
    className,
    inputClassName,
    autoFocus,
    onFocus,
    onBlur,
}: SearchBarProps) {
    return (
        <div className={cn("relative flex-1", className)}>
            <Search
                size={14}
                strokeWidth={2.5}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fk-text-tertiary"
            />
            <input
                type="text"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                autoFocus={autoFocus}
                disabled={loading}
                onFocus={onFocus}
                onBlur={onBlur}
                aria-label={placeholder}
                className={cn(
                    "w-full rounded-fk-lg border border-fk-border bg-fk-surface-elevated py-2.5 pl-9 pr-8 text-[13px] text-fk-text placeholder:text-fk-text-tertiary shadow-sm transition-all",
                    "focus:border-[var(--fk-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--fk-accent)]/20",
                    inputClassName
                )}
            />
            {value && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-fk-pill bg-fk-surface-interactive p-0.5 text-fk-text-tertiary transition-colors hover:text-[var(--fk-accent)]"
                >
                    <X size={12} strokeWidth={3} />
                </button>
            )}
        </div>
    );
}
