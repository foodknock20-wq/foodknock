"use client";

// src/components/products/RecentSearches.tsx
//
// FoodKnock Phase 3 — zero-cost, 100%-real "recent searches" (spec
// section 9 explicitly allows this example). No backend, no fake
// suggestions: this is literally the user's own last few search terms,
// stored client-side only. Confirmed via audit that no recent-search or
// suggestion infrastructure exists anywhere else in the codebase — this
// is net-new, intentionally minimal.

import { useEffect, useState } from "react";
import { Clock, X } from "lucide-react";

const STORAGE_KEY = "fk_menu_recent_searches_v1";
const MAX_ITEMS = 5;

export function recordRecentSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    try {
        const existing: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        const next = [trimmed, ...existing.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { }
}

export default function RecentSearches({ onSelect }: { onSelect: (term: string) => void }) {
    const [terms, setTerms] = useState<string[]>([]);

    useEffect(() => {
        try {
            setTerms(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
        } catch { }
    }, []);

    function remove(term: string) {
        const next = terms.filter((t) => t !== term);
        setTerms(next);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { }
    }

    if (terms.length === 0) return null;

    return (
        <div className="px-3 pb-2 pt-1 md:px-8">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-fk-text-tertiary">
                <Clock size={11} /> Recent searches
            </p>
            <div className="flex flex-wrap gap-1.5">
                {terms.map((term) => (
                    <span
                        key={term}
                        // onMouseDown (not onClick) + preventDefault so the chip's
                        // click registers before the search input's onBlur fires
                        // and hides this list.
                        onMouseDown={(e) => e.preventDefault()}
                        className="flex items-center gap-1 rounded-fk-pill border border-fk-border bg-fk-surface-elevated py-1 pl-3 pr-1.5 text-[11.5px] font-semibold text-fk-text-secondary"
                    >
                        <button type="button" onClick={() => onSelect(term)} className="pr-1">
                            {term}
                        </button>
                        <button
                            type="button"
                            onClick={() => remove(term)}
                            aria-label={`Remove ${term} from recent searches`}
                            className="flex h-4 w-4 items-center justify-center rounded-full text-fk-text-tertiary hover:text-fk-danger"
                        >
                            <X size={10} />
                        </button>
                    </span>
                ))}
            </div>
        </div>
    );
}
