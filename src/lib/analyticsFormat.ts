// src/lib/analyticsFormat.ts
// Phase 15D — shared, consistent number formatting for the Analytics
// Center. One formatter per concept, reused everywhere, so "₹24,500" never
// renders as "₹24500" in one chart and "24.5k" in another.
//
// Phase 1 Revenue Accuracy fix (see src/app/admin/page.tsx and
// src/app/admin/analytics/page.tsx) — formatINR now renders the FULL,
// un-abbreviated amount with Indian digit grouping and exactly 2 decimal
// places (e.g. ₹1,23,456.00), matching how real money is reported. This is
// a pure display-formatting fix: no revenue/aggregation figure anywhere was
// recalculated or redefined — every number passed to this function was
// already correct, it was just being abbreviated (by formatCompactINR,
// below) or rounded to a whole rupee before this change.
export function formatINR(n: number): string {
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Retained for any future non-financial-total use (e.g. a dense sparkline
// axis label where abbreviation is genuinely appropriate), but — per the
// Phase 1 Revenue Accuracy fix — no longer used for any revenue/discount/
// financial total on the admin dashboard or Analytics Center; those now
// all use formatINR() above so a reported amount is never abbreviated.
export function formatCompactINR(n: number): string {
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
    return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function formatNumber(n: number): string {
    return n.toLocaleString("en-IN");
}

export function formatPct(n: number | null): string {
    if (n === null) return "—";
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(1)}%`;
}

export function formatRate(n: number | null): string {
    if (n === null) return "—";
    return `${n.toFixed(1)}%`;
}

const BUCKET_LABEL_FMT_HOUR = new Intl.DateTimeFormat("en-IN", { hour: "numeric", timeZone: "Asia/Kolkata" });
const BUCKET_LABEL_FMT_DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const BUCKET_LABEL_FMT_MONTH = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" });

export function formatBucketLabel(iso: string, bucket: "hour" | "day" | "week" | "month"): string {
    const d = new Date(iso);
    if (bucket === "hour") return BUCKET_LABEL_FMT_HOUR.format(d);
    if (bucket === "month") return BUCKET_LABEL_FMT_MONTH.format(d);
    return BUCKET_LABEL_FMT_DAY.format(d);
}
