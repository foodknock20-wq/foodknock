"use client";

// src/components/admin/analytics/AnalyticsDateRangeBar.tsx
// Phase 15D — URL-synced global date range for the Analytics Center.
// Pure navigation (router.push to a new searchParams string) — never a
// client-side fetch, so refresh/back/forward/shareable-link all "just
// work" through the same server component render as a direct link.

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { AnalyticsRangeKey } from "@/lib/analyticsDateRange";

const RANGES: { key: AnalyticsRangeKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "7d", label: "Last 7 Days" },
    { key: "30d", label: "Last 30 Days" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "thisYear", label: "This Year" },
];

export default function AnalyticsDateRangeBar({
    activeRange, from, to,
}: {
    activeRange: AnalyticsRangeKey;
    from?: string;
    to?: string;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [customFrom, setCustomFrom] = useState(from ?? "");
    const [customTo, setCustomTo] = useState(to ?? "");
    const [refreshing, setRefreshing] = useState(false);

    const go = (key: AnalyticsRangeKey, f?: string, t?: string) => {
        const params = new URLSearchParams();
        params.set("range", key);
        if (key === "custom") {
            if (f) params.set("from", f);
            if (t) params.set("to", t);
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleRefresh = () => {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 600);
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                {RANGES.map((r) => (
                    <button
                        key={r.key}
                        type="button"
                        onClick={() => go(r.key)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                            activeRange === r.key
                                ? "bg-amber-500/15 text-amber-400"
                                : "text-stone-300 hover:bg-white/[0.04] hover:text-stone-100"
                        }`}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-lg bg-transparent px-2 py-1 text-[11px] text-stone-300 outline-none [color-scheme:dark]"
                />
                <span className="text-stone-700">–</span>
                <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-lg bg-transparent px-2 py-1 text-[11px] text-stone-300 outline-none [color-scheme:dark]"
                />
                <button
                    type="button"
                    disabled={!customFrom || !customTo}
                    onClick={() => go("custom", customFrom, customTo)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                        activeRange === "custom" ? "bg-amber-500/15 text-amber-400" : "text-stone-300 hover:bg-white/[0.04] hover:text-stone-100"
                    } ${(!customFrom || !customTo) ? "opacity-40" : ""}`}
                >
                    Apply
                </button>
            </div>

            <button
                type="button"
                onClick={handleRefresh}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] font-bold text-stone-400 hover:text-stone-200"
            >
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                Refresh
            </button>
        </div>
    );
}
