// src/components/admin/analytics/charts/DonutChart.tsx
// Phase 15D — lightweight SVG donut for small-category distributions
// (payment method, order outcome). Deliberately not used anywhere with
// more than a handful of slices — a donut with many categories is
// explicitly disallowed by the Phase 15D brief.

export default function DonutChart({
    slices, centerLabel, centerSub, valueFormat,
}: {
    slices: { label: string; value: number; color: string }[];
    centerLabel: string;
    centerSub: string;
    valueFormat: (n: number) => string;
}) {
    const total = slices.reduce((s, x) => s + x.value, 0);

    if (total === 0) {
        return (
            <div className="flex h-40 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.015] text-[11px] text-stone-600">
                No data in this period
            </div>
        );
    }

    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    const segments = slices.reduce<{ color: string; dash: number; offset: number }[]>((acc, s) => {
        const dash = (s.value / total) * circumference;
        const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
        return [...acc, { color: s.color, dash, offset }];
    }, []);

    return (
        <div className="flex items-center gap-5">
            <svg viewBox="0 0 100 100" width="110" height="110" role="img" aria-label={`${centerLabel} ${centerSub}`}>
                <title>{slices.map((s) => `${s.label}: ${valueFormat(s.value)}`).join(", ")}</title>
                <circle cx="50" cy="50" r={radius} fill="none" stroke="#ffffff10" strokeWidth="14" />
                {segments.map((s, i) => (
                    <circle
                        key={i}
                        cx="50" cy="50" r={radius}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="14"
                        strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                        strokeDashoffset={-s.offset}
                        transform="rotate(-90 50 50)"
                    />
                ))}
                <text x="50" y="47" textAnchor="middle" className="fill-white" style={{ fontSize: 13, fontWeight: 900 }}>
                    {centerLabel}
                </text>
                <text x="50" y="59" textAnchor="middle" className="fill-stone-500" style={{ fontSize: 7 }}>
                    {centerSub}
                </text>
            </svg>
            <div className="space-y-1.5">
                {slices.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="font-bold text-stone-300">{s.label}</span>
                        <span className="font-mono text-stone-500">{valueFormat(s.value)}</span>
                        <span className="text-stone-700">({((s.value / total) * 100).toFixed(0)}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
