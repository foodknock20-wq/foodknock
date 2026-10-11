// src/components/admin/analytics/KpiCard.tsx
// Phase 15D — compact KPI tile with an optional transparent period
// comparison badge. Server component (no interactivity needed).

import { ArrowUp, ArrowDown, Minus, type LucideIcon } from "lucide-react";
import { formatPct } from "@/lib/analyticsFormat";

export default function KpiCard({
    label, value, sub, description, icon: Icon,
    comparisonPct, comparisonDirection,
}: {
    label: string;
    value: string;
    sub?: string;
    description: string;
    icon: LucideIcon;
    comparisonPct?: number | null;
    comparisonDirection?: "up" | "down" | "flat";
}) {
    const hasComparison = comparisonDirection !== undefined;
    const isNew = hasComparison && comparisonPct === null && comparisonDirection === "up";
    const dirColor =
        comparisonDirection === "up" ? "text-emerald-400" :
        comparisonDirection === "down" ? "text-rose-400" : "text-stone-400";
    const DirIcon = comparisonDirection === "up" ? ArrowUp : comparisonDirection === "down" ? ArrowDown : Minus;

    return (
        <div
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4"
            title={description}
        >
            <div className="flex items-start justify-between">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-600">{label}</p>
                <Icon size={13} className="text-amber-400/70" strokeWidth={2} />
            </div>
            <p className="mt-2 font-mono text-[20px] font-black leading-none text-white">{value}</p>
            <div className="mt-1.5 flex items-center gap-2">
                {sub && <span className="text-[10px] text-stone-700">{sub}</span>}
                {hasComparison && (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${dirColor}`}>
                        <DirIcon size={10} strokeWidth={3} />
                        {isNew ? "New" : formatPct(comparisonPct ?? 0)}
                    </span>
                )}
            </div>
        </div>
    );
}
