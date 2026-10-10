// src/components/admin/analytics/charts/BarList.tsx
// Phase 15D — compact bar+number row list. Serves as both the "BAR chart"
// and the "table" requirement at once (label, proportional bar, exact
// value) — used for Top Products/Categories/Coupons/Offers/Campaigns/
// Cancellation reasons/Spin rewards. Capped by the caller to top 5–10
// rows; never renders hundreds of rows.

export default function BarList({
    rows, color, valueFormat, emptyLabel, subFormat,
}: {
    rows: { label: string; value: number; sub?: number }[];
    color: string;
    valueFormat: (n: number) => string;
    emptyLabel: string;
    subFormat?: (n: number) => string;
}) {
    if (rows.length === 0) {
        return (
            <div className="flex h-24 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.015] text-[11px] text-stone-600">
                {emptyLabel}
            </div>
        );
    }

    const max = Math.max(...rows.map((r) => r.value), 1);

    return (
        <div className="space-y-2.5">
            {rows.map((r, i) => (
                <div key={`${r.label}-${i}`} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-[11px] font-bold text-stone-300" title={r.label}>
                        {r.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max((r.value / max) * 100, 2)}%`, backgroundColor: color }}
                        />
                    </div>
                    <span className="w-20 shrink-0 text-right font-mono text-[11px] font-black text-stone-200">
                        {valueFormat(r.value)}
                    </span>
                    {r.sub !== undefined && subFormat && (
                        <span className="w-14 shrink-0 text-right text-[10px] text-stone-600">{subFormat(r.sub)}</span>
                    )}
                </div>
            ))}
        </div>
    );
}
