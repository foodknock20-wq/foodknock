// src/lib/analyticsFormat.ts
// Phase 15D — shared, consistent number formatting for the Analytics
// Center. One formatter per concept, reused everywhere, so "₹24,500" never
// renders as "₹24500" in one chart and "24.5k" in another.

export function formatINR(n: number): string {
    return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

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
