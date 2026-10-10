"use client";

// src/components/admin/notifications/CustomerSelector.tsx
//
// Notification System 2.0 — Phase 11/12. Lets the admin search for and
// select ONE logged-in customer as the recipient of a targeted notification,
// instead of only being able to broadcast to everyone. Bounded, debounced
// search against GET /api/admin/notifications/customers (admin-gated, capped
// at 20 results per query) — never loads a full customer list into the browser.

import { useEffect, useRef, useState } from "react";
import { Search, X, Bell, BellOff, User as UserIcon, Loader2 } from "lucide-react";

export type SelectedCustomer = {
    id: string;
    name: string;
    email: string;
    phone: string;
    pushEnabled: boolean;
};

type SearchResult = SelectedCustomer & { isActive: boolean };

export default function CustomerSelector({
    selected,
    onSelect,
    onClear,
}: {
    selected: SelectedCustomer | null;
    onSelect: (customer: SelectedCustomer) => void;
    onClear: () => void;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const trimmed = query.trim();
        // No setState here — the render below already gates the results
        // list on the trimmed query length, so a too-short query simply
        // never shows whatever's left in `results` from a previous longer
        // query.
        if (trimmed.length < 2) return;

        const controller = new AbortController();
        debounceRef.current = setTimeout(() => {
            setLoading(true);
            fetch(`/api/admin/notifications/customers?search=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => { if (data?.success) setResults(data.customers); })
                .catch((err) => { if (err?.name !== "AbortError") setResults([]); })
                .finally(() => setLoading(false));
        }, 300);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); controller.abort(); };
    }, [query]);

    if (selected) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                    <UserIcon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-stone-100">{selected.name}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-stone-500">
                        {selected.phone}
                        <span className={`flex items-center gap-0.5 ${selected.pushEnabled ? "text-emerald-400" : "text-stone-600"}`}>
                            {selected.pushEnabled ? <Bell size={10} /> : <BellOff size={10} />}
                            {selected.pushEnabled ? "Push enabled" : "No active subscription"}
                        </span>
                    </p>
                </div>
                <button
                    onClick={onClear}
                    aria-label="Remove selected customer"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-white/5 hover:text-stone-200"
                >
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search customers by name or phone…"
                    className="w-full rounded-xl border border-white/[0.08] bg-[#151520] py-2.5 pl-8 pr-8 text-[13px] text-stone-200 outline-none placeholder:text-stone-700 focus:border-amber-500/40"
                />
                {loading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-stone-600" />}
            </div>

            {query.trim().length >= 2 && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#111117]">
                    {results.length === 0 && !loading && (
                        <p className="px-3.5 py-3 text-[12px] text-stone-600">No customers found.</p>
                    )}
                    {results.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => { onSelect(c); setQuery(""); setResults([]); }}
                            disabled={!c.isActive}
                            className="flex w-full items-center gap-2.5 border-b border-white/[0.04] px-3.5 py-2.5 text-left last:border-b-0 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[12.5px] font-bold text-stone-200">
                                    {c.name} {!c.isActive && <span className="text-stone-600">(blocked)</span>}
                                </p>
                                <p className="truncate text-[11px] text-stone-500">{c.phone}</p>
                            </div>
                            <span className={`flex shrink-0 items-center gap-1 text-[10px] font-bold ${c.pushEnabled ? "text-emerald-400" : "text-stone-600"}`}>
                                {c.pushEnabled ? <Bell size={10} /> : <BellOff size={10} />}
                                {c.pushEnabled ? "Push ON" : "No sub"}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
