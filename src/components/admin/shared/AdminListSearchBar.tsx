"use client";

// src/components/admin/shared/AdminListSearchBar.tsx
//
// Phase 15A — shared URL-synced, debounced search box for Admin 2.0 list
// pages. Updates the `search` query param (and resets `page` to 1) via
// router.push with scroll:false — a server component re-render, not a
// client fetch, so it reuses the exact same server-side search/pagination
// path every direct link/refresh/back-navigation already goes through.
// No duplicate client-side filtering logic anywhere.

import { useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

export default function AdminListSearchBar({
    placeholder = "Search…",
}: {
    placeholder?: string;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const urlValue = searchParams.get("search") ?? "";

    const [value, setValue] = useState(urlValue);
    // Keep the input in sync if the user navigates back/forward — React's
    // documented "adjust state during render" pattern (not an effect):
    // setState here bails out before an extra paint, instead of the
    // effect-based version's render → commit → effect → re-render cascade.
    const [trackedUrlValue, setTrackedUrlValue] = useState(urlValue);
    if (urlValue !== trackedUrlValue) {
        setTrackedUrlValue(urlValue);
        setValue(urlValue);
    }

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const pushSearch = (next: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next) params.set("search", next);
        else params.delete("search");
        params.set("page", "1"); // a new search always starts at page 1
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleChange = (next: string) => {
        setValue(next);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => pushSearch(next), 350);
    };

    return (
        <div className="relative w-full max-w-sm">
            <Search size={13} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-600" strokeWidth={2} />
            <input
                type="text"
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.035] py-2.5 pl-9 pr-9 text-[13px] text-stone-300 placeholder:text-stone-700 transition-all focus:border-amber-500/40 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-amber-500/12"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); setValue(""); pushSearch(""); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-100"
                >
                    <X size={13} />
                </button>
            )}
        </div>
    );
}
