export const dynamic = "force-dynamic";

// src/app/admin/growth/page.tsx
// FoodKnock Growth & Retention — Phase 16 Customer Lifecycle Intelligence
//
// Deliberately NOT date-range-scoped (unlike /admin/analytics) — every
// metric here needs full customer order history to be meaningful; see
// src/lib/adminGrowth.ts's header for why a period filter would produce
// misleading numbers for cohort/RFM math. This page is a read-only
// business-intelligence layer on top of Phase 15D/15F — no business logic
// duplicated, no financial authority changed.

import {
    getRetentionOverview, buildCohorts, buildRfm, buildRevenueConcentration,
    buildCouponComparison, buildLoyaltyComparison, getGrowthFunnel, getProductRetention,
    INACTIVE_DAYS, MIN_PRODUCT_SAMPLE, type RfmSegment,
} from "@/lib/adminGrowth";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import KpiCard from "@/components/admin/analytics/KpiCard";
import Link from "next/link";
import {
    TrendingUp, Repeat, Clock, AlertTriangle, Moon, IndianRupee,
    ArrowRight, Award, Ticket, Gift,
} from "lucide-react";

function fmtPct(n: number | null): string {
    return n === null ? "—" : `${n.toFixed(1)}%`;
}
function fmtDays(n: number | null): string {
    return n === null ? "—" : `${n.toFixed(1)}d`;
}
function fmtINR(n: number | null): string {
    return n === null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const SEGMENT_META: Record<RfmSegment, { emoji: string; color: string }> = {
    "Champions": { emoji: "🔥", color: "text-amber-400 border-amber-500/25 bg-amber-500/10" },
    "Loyal Customers": { emoji: "💎", color: "text-emerald-400 border-emerald-500/25 bg-emerald-500/10" },
    "Potential Loyalists": { emoji: "🎯", color: "text-sky-400 border-sky-500/25 bg-sky-500/10" },
    "New Customers": { emoji: "🌱", color: "text-violet-400 border-violet-500/25 bg-violet-500/10" },
    "Need Attention": { emoji: "👀", color: "text-stone-300 border-white/[0.12] bg-white/[0.04]" },
    "At Risk": { emoji: "⚠️", color: "text-orange-400 border-orange-500/25 bg-orange-500/10" },
    "Lost": { emoji: "💤", color: "text-rose-400 border-rose-500/25 bg-rose-500/10" },
};

export default async function AdminGrowthPage() {
    const { overview, bands, summaries } = await getRetentionOverview();
    const now = new Date();

    const cohorts = buildCohorts(summaries, now);
    const rfm = buildRfm(summaries, now);
    const revenueConcentration = buildRevenueConcentration(summaries);
    const couponComparison = buildCouponComparison(summaries);
    const loyaltyComparison = buildLoyaltyComparison(summaries);
    const funnel = await getGrowthFunnel(summaries);

    const repeatPhones = new Set(summaries.filter((c) => c.orderCount >= 2).map((c) => c.phone));
    const productRetention = await getProductRetention(repeatPhones);

    const segmentCounts = new Map<RfmSegment, { count: number; revenue: number }>();
    for (const r of rfm) {
        const existing = segmentCounts.get(r.segment) ?? { count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += r.monetary;
        segmentCounts.set(r.segment, existing);
    }
    const segmentOrder: RfmSegment[] = ["Champions", "Loyal Customers", "Potential Loyalists", "New Customers", "Need Attention", "At Risk", "Lost"];

    // Map RFM/lifecycle segments to Phase 15F's EXISTING `type` filter where
    // the semantics genuinely line up — reuses Customers 2.0 navigation
    // rather than inventing a new query param or filter system there.
    const segmentLink: Partial<Record<RfmSegment, string>> = {
        "Champions": "/admin/users?type=vip",
        "Loyal Customers": "/admin/users?type=repeat",
        "New Customers": "/admin/users?type=new",
        "At Risk": "/admin/users?type=inactive",
        "Lost": "/admin/users?type=inactive",
    };

    const maxFunnel = funnel[0]?.count || 1;

    return (
        <div className="space-y-5 pb-8">
            <AdminPageHeader
                icon={TrendingUp}
                title="Growth & Retention"
                description="Customer behavior, retention and business value — full order history, not a selected date range"
            />

            {/* ── Section 1: Retention Overview ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <KpiCard label="Repeat Rate" value={fmtPct(overview.repeatRate)} icon={Repeat}
                    description="Customers with 2+ qualifying (non-cancelled) orders ÷ all customers." />
                <KpiCard label="2nd Order Conv." value={fmtPct(overview.secondOrderConversion.rate)} icon={ArrowRight}
                    description={`${overview.secondOrderConversion.secondOrderCustomers} of ${overview.secondOrderConversion.firstOrderCustomers} first-order customers came back.`} />
                <KpiCard label="3rd Order Conv." value={fmtPct(overview.thirdOrderConversion.rate)} icon={ArrowRight}
                    description={`${overview.thirdOrderConversion.thirdOrderCustomers} of ${overview.thirdOrderConversion.secondOrderCustomers} second-order customers ordered a third time.`} />
                <KpiCard label="Avg Reorder Gap" value={fmtDays(overview.avgReorderGapDays)} icon={Clock}
                    description={`Median ${fmtDays(overview.medianReorderGapDays)}. Based on observed first→second and second→third gaps.`} />
                <KpiCard label="At Risk" value={String(overview.atRiskCount)} icon={AlertTriangle}
                    description="Ordering slower than their own usual pattern (or 21d+ for single-order customers), but not yet inactive." />
                <KpiCard label="Inactive" value={String(overview.inactiveCount)} icon={Moon}
                    description={`No order in ${INACTIVE_DAYS}+ days (same definition as the Customers 2.0 Inactive filter).`} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Observed LTV</p>
                        <IndianRupee size={13} className="text-amber-400/70" />
                    </div>
                    <p className="mt-1.5 font-mono text-2xl font-black text-white">{fmtINR(overview.observedLtv)}</p>
                    <p className="mt-1 text-[11px] text-stone-500">Lifetime qualifying revenue ÷ total customers ({overview.totalCustomers}). Observed, not predictive.</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Reorder Interval Distribution</p>
                    <div className="space-y-1.5">
                        {bands.map((b) => {
                            const max = Math.max(...bands.map((x) => x.count), 1);
                            return (
                                <div key={b.label} className="flex items-center gap-2 text-[11px]">
                                    <span className="w-20 shrink-0 text-stone-400">{b.label}</span>
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                                        <div className="h-full rounded-full bg-amber-500/60" style={{ width: `${(b.count / max) * 100}%` }} />
                                    </div>
                                    <span className="w-6 shrink-0 text-right font-mono text-stone-300">{b.count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Section 2: Lifecycle Funnel ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                <h2 className="mb-3 text-[14px] font-bold text-white">Customer Lifecycle Funnel</h2>
                <div className="space-y-2.5">
                    {funnel.map((s) => (
                        <div key={s.label} className="flex items-center gap-3">
                            <span className="w-28 shrink-0 text-[12px] font-semibold text-stone-300">{s.label}</span>
                            <div className="h-6 flex-1 overflow-hidden rounded-lg bg-white/[0.04]">
                                <div className="flex h-full items-center rounded-lg bg-gradient-to-r from-amber-500/70 to-orange-500/50 px-2" style={{ width: `${Math.max(4, (s.count / maxFunnel) * 100)}%` }}>
                                    <span className="font-mono text-[11px] font-bold text-stone-950">{s.count}</span>
                                </div>
                            </div>
                            <span className="w-14 shrink-0 text-right text-[11px] text-stone-500">{s.conversionFromPrev !== null ? fmtPct(s.conversionFromPrev) : ""}</span>
                        </div>
                    ))}
                </div>
                <p className="mt-3 text-[10.5px] text-stone-500">Registered = total User accounts. Order stages use qualifying (non-cancelled) orders only.</p>
            </div>

            {/* ── Section 3: Cohorts ── */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14]">
                <div className="border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
                    <h2 className="text-[14px] font-bold text-white">Cohort Retention</h2>
                    <p className="text-[11px] text-stone-500">By first-order month · N/A = not yet matured for that window</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-[12px]">
                        <thead>
                            <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                                {["Cohort", "Customers", "7D", "30D", "60D", "90D"].map((h) => (
                                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-stone-500">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {cohorts.length === 0 ? (
                                <tr><td colSpan={6} className="px-3 py-8 text-center text-stone-500">No cohort data yet.</td></tr>
                            ) : cohorts.map((c) => (
                                <tr key={c.cohort}>
                                    <td className="px-3 py-2.5 font-mono font-bold text-stone-200">{c.cohort}</td>
                                    <td className="px-3 py-2.5 text-stone-300">{c.customers}</td>
                                    <td className="px-3 py-2.5 text-stone-300">{c.retention.d7 !== null ? fmtPct(c.retention.d7) : <span className="text-stone-600">N/A</span>}</td>
                                    <td className="px-3 py-2.5 text-stone-300">{c.retention.d30 !== null ? fmtPct(c.retention.d30) : <span className="text-stone-600">N/A</span>}</td>
                                    <td className="px-3 py-2.5 text-stone-300">{c.retention.d60 !== null ? fmtPct(c.retention.d60) : <span className="text-stone-600">N/A</span>}</td>
                                    <td className="px-3 py-2.5 text-stone-300">{c.retention.d90 !== null ? fmtPct(c.retention.d90) : <span className="text-stone-600">N/A</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Section 4: RFM Segments ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                <h2 className="mb-1 text-[14px] font-bold text-white">RFM Segments</h2>
                <p className="mb-3 text-[11px] text-stone-500">Recency/Frequency/Monetary quintile scoring (1–5) across all {summaries.length} customers with a qualifying order.</p>
                <div className="space-y-2">
                    {segmentOrder.map((seg) => {
                        const data = segmentCounts.get(seg);
                        if (!data) return null;
                        const meta = SEGMENT_META[seg];
                        const href = segmentLink[seg];
                        const Row = (
                            <div className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${meta.color}`}>
                                <div className="flex items-center gap-2.5">
                                    <span>{meta.emoji}</span>
                                    <span className="text-[12.5px] font-bold">{seg}</span>
                                    <span className="text-[11px] opacity-70">{data.count} customer{data.count !== 1 ? "s" : ""}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px]">{fmtINR(data.revenue)}</span>
                                    {href && <ArrowRight size={12} />}
                                </div>
                            </div>
                        );
                        return href ? <Link key={seg} href={href} className="block transition-opacity hover:opacity-80">{Row}</Link> : <div key={seg}>{Row}</div>;
                    })}
                </div>
            </div>

            {/* ── Section 5: Revenue Concentration ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-white">
                    <Award size={14} className="text-amber-400" /> Revenue Concentration
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {revenueConcentration.map((b) => (
                        <div key={b.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{b.label}</p>
                            <p className="mt-1 font-mono text-lg font-black text-amber-400">{fmtPct(b.revenuePct)}</p>
                            <p className="text-[10px] text-stone-500">{b.customerCount} customers · {fmtINR(b.revenue)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Section 6: Product Retention ── */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14]">
                <div className="border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
                    <h2 className="text-[14px] font-bold text-white">Product Retention</h2>
                    <p className="text-[11px] text-stone-500">Customers who bought X and later placed another qualifying order — observed association, not causation. Min {MIN_PRODUCT_SAMPLE} buyers to qualify.</p>
                </div>
                {productRetention.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[12px] text-stone-500">No products meet the minimum sample size yet.</div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {productRetention.slice(0, 10).map((p) => (
                            <div key={p.name} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                                <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-stone-200">{p.name}</p>
                                <span className="shrink-0 text-[11px] text-stone-500">{p.buyers} buyers</span>
                                <span className="shrink-0 font-mono text-[12.5px] font-bold text-amber-400">{p.repeatRate.toFixed(0)}% repeat</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Section 7: Promotion & Loyalty Effectiveness ── */}
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                    <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-white">
                        <Ticket size={14} className="text-amber-400" /> Coupon-Assisted First Order
                    </h2>
                    <ComparisonBlock comparison={couponComparison} />
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
                    <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-white">
                        <Gift size={14} className="text-amber-400" /> Loyalty Redemption
                    </h2>
                    <ComparisonBlock comparison={loyaltyComparison} />
                </div>
            </div>

            <p className="text-center text-[10.5px] text-stone-600">
                Category-level retention is not shown — historical category is not stored on order line items, only derivable from current Product.category, which would misrepresent past purchases.
            </p>
        </div>
    );
}

function ComparisonBlock({ comparison }: { comparison: { groupA: { label: string; customers: number; secondOrderRate: number | null; avgRevenue: number | null }; groupB: typeof comparison["groupA"] } }) {
    return (
        <div className="space-y-3">
            {[comparison.groupA, comparison.groupB].map((g) => (
                <div key={g.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                    <p className="text-[11px] font-semibold text-stone-300">{g.label}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[11px] text-stone-500">{g.customers} customers</span>
                        <span className="font-mono text-[12px] font-bold text-amber-400">{fmtPct(g.secondOrderRate)} 2nd-order</span>
                        <span className="font-mono text-[12px] text-stone-300">{fmtINR(g.avgRevenue)} avg</span>
                    </div>
                </div>
            ))}
            <p className="text-[10px] text-stone-600">Observed comparison, not a causal claim.</p>
        </div>
    );
}
