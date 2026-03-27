// src/components/admin/DashboardStatCard.tsx
// Premium dark dashboard stat card — FoodKnock

import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

type TrendDirection = "up" | "down" | "neutral";

type Props = {
    title:           string;
    value:           string | number;
    icon:            LucideIcon;
    description?:    string;
    trend?:          string;
    trendDirection?: TrendDirection;
    accentColor?:    "amber" | "emerald" | "blue" | "violet" | "rose";
};

const COLOR_MAP: Record<
    NonNullable<Props["accentColor"]>,
    { iconBg: string; iconText: string; glowRgb: string; border: string; valueBg: string; blobColor: string }
> = {
    amber: {
        iconBg:     "bg-amber-500/10",
        iconText:   "text-amber-400",
        glowRgb:    "245,158,11",
        border:     "border-amber-500/10",
        valueBg:    "from-amber-400 to-orange-400",
        blobColor:  "#f97316",
    },
    emerald: {
        iconBg:     "bg-emerald-500/10",
        iconText:   "text-emerald-400",
        glowRgb:    "16,185,129",
        border:     "border-emerald-500/10",
        valueBg:    "from-emerald-400 to-teal-400",
        blobColor:  "#10b981",
    },
    blue: {
        iconBg:     "bg-sky-500/10",
        iconText:   "text-sky-400",
        glowRgb:    "14,165,233",
        border:     "border-sky-500/10",
        valueBg:    "from-sky-400 to-blue-400",
        blobColor:  "#0ea5e9",
    },
    violet: {
        iconBg:     "bg-violet-500/10",
        iconText:   "text-violet-400",
        glowRgb:    "139,92,246",
        border:     "border-violet-500/10",
        valueBg:    "from-violet-400 to-purple-400",
        blobColor:  "#8b5cf6",
    },
    rose: {
        iconBg:     "bg-rose-500/10",
        iconText:   "text-rose-400",
        glowRgb:    "244,63,94",
        border:     "border-rose-500/10",
        valueBg:    "from-rose-400 to-pink-400",
        blobColor:  "#f43f5e",
    },
};

const TREND_ICONS: Record<TrendDirection, typeof TrendingUp> = {
    up:      TrendingUp,
    down:    TrendingDown,
    neutral: Minus,
};

const TREND_COLORS: Record<TrendDirection, string> = {
    up:      "text-emerald-400 bg-emerald-500/10 border-emerald-500/15",
    down:    "text-rose-400 bg-rose-500/10 border-rose-500/15",
    neutral: "text-stone-500 bg-white/5 border-white/5",
};

export default function DashboardStatCard({
    title,
    value,
    icon: Icon,
    description,
    trend,
    trendDirection = "neutral",
    accentColor    = "amber",
}: Props) {
    const c         = COLOR_MAP[accentColor];
    const TrendIcon = TREND_ICONS[trendDirection];

    return (
        <article
            className={`group relative overflow-hidden rounded-2xl border ${c.border} bg-[#0f0f16] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#131320]`}
            style={{ boxShadow: `0 2px 20px rgba(${c.glowRgb},0.06), 0 1px 3px rgba(0,0,0,0.3)` }}
        >
            {/* Ambient corner blob */}
            <div
                className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-40"
                style={{ background: `radial-gradient(ellipse, ${c.blobColor}, transparent 70%)` }}
                aria-hidden="true"
            />
            {/* Bottom-left secondary blob */}
            <div
                className="pointer-events-none absolute -bottom-4 -left-4 h-16 w-16 rounded-full opacity-10 blur-2xl"
                style={{ background: `radial-gradient(ellipse, ${c.blobColor}, transparent 70%)` }}
                aria-hidden="true"
            />

            <div className="relative flex items-start justify-between gap-3">
                {/* Icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${c.border} ${c.iconBg} ${c.iconText} transition-transform duration-300 group-hover:scale-105`}>
                    <Icon size={19} strokeWidth={1.8} />
                </div>

                {/* Trend badge */}
                {trend && (
                    <div className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${TREND_COLORS[trendDirection]}`}>
                        <TrendIcon size={10} strokeWidth={2.5} />
                        {trend}
                    </div>
                )}
            </div>

            <div className="relative mt-4">
                <p className="text-[10.5px] font-black uppercase tracking-[0.18em] text-stone-600">{title}</p>
                <p className={`mt-1.5 bg-gradient-to-r text-3xl font-black tracking-tight text-transparent bg-clip-text ${c.valueBg}`}>
                    {value}
                </p>
                {description && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-stone-600">{description}</p>
                )}
            </div>

            {/* Subtle bottom border glow on hover */}
            <div
                className="pointer-events-none absolute bottom-0 left-1/2 h-px w-3/4 -translate-x-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-60"
                style={{ background: `linear-gradient(90deg, transparent, ${c.blobColor}, transparent)` }}
                aria-hidden="true"
            />
        </article>
    );
}