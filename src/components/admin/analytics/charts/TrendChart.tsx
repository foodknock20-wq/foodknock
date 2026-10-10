// src/components/admin/analytics/charts/TrendChart.tsx
// Phase 15D — lightweight server-rendered SVG area/line chart. No chart
// library was installed in this repo (audited); for a bounded number of
// points (≤~90 — one bucket per hour/day/month in a selected range) a
// hand-built SVG is lighter than any library and needs zero client JS.
// A textual summary (first/last/peak) is rendered alongside so the chart
// is never the only way to understand the numbers (accessibility).

import { formatBucketLabel } from "@/lib/analyticsFormat";

export default function TrendChart({
    points, color, valueFormat, bucket, emptyLabel,
}: {
    points: { bucketStart: string; value: number }[];
    color: string;
    valueFormat: (n: number) => string;
    bucket: "hour" | "day" | "week" | "month";
    emptyLabel: string;
}) {
    if (points.length === 0) {
        return (
            <div className="flex h-40 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.015] text-[11px] text-stone-600">
                {emptyLabel}
            </div>
        );
    }

    const width = 600;
    const height = 160;
    const padX = 8;
    const padY = 14;
    const max = Math.max(...points.map((p) => p.value), 1);
    const n = points.length;
    const stepX = n > 1 ? (width - padX * 2) / (n - 1) : 0;

    const coords = points.map((p, i) => {
        const x = padX + i * stepX;
        const y = padY + (1 - p.value / max) * (height - padY * 2);
        return { x, y, ...p };
    });

    const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${coords[n - 1].x.toFixed(1)},${height - padY} L${coords[0].x.toFixed(1)},${height - padY} Z`;

    const peak = coords.reduce((best, c) => (c.value > best.value ? c : best), coords[0]);
    const first = coords[0];
    const last = coords[n - 1];

    return (
        <div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 160 }} preserveAspectRatio="none" role="img" aria-label={`Trend from ${valueFormat(first.value)} to ${valueFormat(last.value)}, peak ${valueFormat(peak.value)}`}>
                <title>{`Trend: start ${valueFormat(first.value)}, peak ${valueFormat(peak.value)}, latest ${valueFormat(last.value)}`}</title>
                <defs>
                    <linearGradient id={`fill-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#fill-${color.replace("#", "")})`} stroke="none" />
                <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={last.x} cy={last.y} r="3" fill={color} />
            </svg>
            <div className="mt-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-stone-700">
                <span>{formatBucketLabel(first.bucketStart, bucket)}</span>
                <span className="text-stone-500">Peak {valueFormat(peak.value)}</span>
                <span>{formatBucketLabel(last.bucketStart, bucket)}</span>
            </div>
        </div>
    );
}
