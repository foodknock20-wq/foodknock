export const dynamic = "force-dynamic";

// src/app/admin/analytics/page.tsx
//
// Phase 15D — FoodKnock Analytics 2.0. Server component: the entire page
// is rendered from ONE getAnalyticsData() call (src/lib/adminAnalytics.ts),
// which itself runs a small, fixed, bounded set of MongoDB aggregations in
// parallel — never fetches whole collections into memory, never computes
// anything in the browser. Interactivity (date range, manual refresh) is
// pure URL navigation handled by AnalyticsDateRangeBar, a thin client
// island; everything else here is server-rendered.
//
// See src/lib/adminAnalytics.ts's file header for the exact definition of
// every metric (Revenue, AOV, Cancellation Rate, Repeat Customer Rate,
// etc.) — this file only lays the numbers out, it never recomputes them.

import {
    BarChart3, ShoppingBag, IndianRupee, Receipt, CheckCircle2, XCircle,
    UserPlus, Users, Tag, Percent, Truck, Star, Gift, Sparkles,
} from "lucide-react";
import { resolveAnalyticsRange, percentChange, isValidRangeKey, type AnalyticsRangeKey } from "@/lib/analyticsDateRange";
import { getAnalyticsData } from "@/lib/adminAnalytics";
import { formatINR, formatCompactINR, formatNumber, formatRate } from "@/lib/analyticsFormat";
import AnalyticsDateRangeBar from "@/components/admin/analytics/AnalyticsDateRangeBar";
import AnalyticsSection from "@/components/admin/analytics/AnalyticsSection";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import KpiCard from "@/components/admin/analytics/KpiCard";
import TrendChart from "@/components/admin/analytics/charts/TrendChart";
import BarList from "@/components/admin/analytics/charts/BarList";
import DonutChart from "@/components/admin/analytics/charts/DonutChart";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function str(v: string | string[] | undefined): string | undefined {
    return typeof v === "string" && v ? v : undefined;
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const rawKey = str(sp.range);
    const rangeKey: AnalyticsRangeKey = isValidRangeKey(rawKey) ? rawKey : "30d";
    const range = resolveAnalyticsRange(rangeKey, str(sp.from), str(sp.to));

    const data = await getAnalyticsData(range);
    const { current, previous } = data;

    const ordersChange = percentChange(current.totalOrders, previous.totalOrders);
    const revenueChange = percentChange(current.revenue, previous.revenue);
    const aov = current.totalOrders > current.cancelledOrders ? current.revenue / (current.totalOrders - current.cancelledOrders) : 0;
    const prevAov = previous.totalOrders > previous.cancelledOrders ? previous.revenue / (previous.totalOrders - previous.cancelledOrders) : 0;
    const aovChange = percentChange(aov, prevAov);
    const cancelledChange = percentChange(current.cancelledOrders, previous.cancelledOrders);
    const newCustChange = percentChange(data.customers.newCustomers, 0); // previous-period new-customer count not computed (would need a second customer query); shown as absolute only
    const cancellationRate = current.totalOrders > 0 ? (current.cancelledOrders / current.totalOrders) * 100 : null;

    const revenueTrend = data.trend.map((t) => ({ bucketStart: t.bucketStart, value: t.revenue }));
    const ordersTrend = data.trend.map((t) => ({ bucketStart: t.bucketStart, value: t.orders }));

    const outcomeColors: Record<string, string> = {
        received: "#fbbf24", preparing: "#38bdf8", out_for_delivery: "#a78bfa",
        delivered: "#34d399", cancelled: "#fb7185",
    };

    return (
        <div className="space-y-6 pb-8">
            <AdminPageHeader
                icon={BarChart3}
                title="Analytics"
                description={`${range.label} · compared against the preceding equal-length period`}
            />

            <AnalyticsDateRangeBar activeRange={rangeKey} from={str(sp.from)} to={str(sp.to)} />

            {/* ── KPI summary ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                <KpiCard label="Orders" value={formatNumber(current.totalOrders)} icon={ShoppingBag}
                    description="All orders created in this period, including cancelled. Excludes archived orders."
                    comparisonPct={ordersChange.pct} comparisonDirection={ordersChange.direction} />
                <KpiCard label="Revenue" value={formatCompactINR(current.revenue)} icon={IndianRupee}
                    description="Final totalAmount of non-cancelled orders in this period."
                    comparisonPct={revenueChange.pct} comparisonDirection={revenueChange.direction} />
                <KpiCard label="AOV" value={formatINR(aov)} icon={Receipt}
                    description="Revenue ÷ non-cancelled order count, same period, same population."
                    comparisonPct={aovChange.pct} comparisonDirection={aovChange.direction} />
                <KpiCard label="Delivered" value={formatNumber(current.deliveredOrders)} icon={CheckCircle2}
                    description="Orders created in this period whose current status is 'delivered' (Order Outcome, not a transition log)." />
                <KpiCard label="Cancelled" value={formatNumber(current.cancelledOrders)} icon={XCircle}
                    description={`Orders created in this period with status 'cancelled'. Rate: ${formatRate(cancellationRate)} of all orders.`}
                    comparisonPct={cancelledChange.pct} comparisonDirection={cancelledChange.direction} />
                <KpiCard label="New Customers" value={formatNumber(data.customers.newCustomers)} icon={UserPlus}
                    description="Users whose account was created within this period."
                    comparisonPct={newCustChange.pct} comparisonDirection={newCustChange.direction} />
                <KpiCard label="Returning" value={formatNumber(data.customers.returningCustomers)} icon={Users}
                    description="Customers who ordered in this period AND had at least one other order strictly before it started." />
            </div>

            {/* ── Revenue / Orders trend ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsSection title="Revenue Trend" description="Non-cancelled order totalAmount, bucketed in Asia/Kolkata time.">
                    <TrendChart points={revenueTrend} color="#34d399" valueFormat={formatCompactINR} bucket={range.bucket} emptyLabel="No revenue in this period" />
                </AnalyticsSection>
                <AnalyticsSection title="Orders Trend" description="All orders created, including cancelled, bucketed in Asia/Kolkata time.">
                    <TrendChart points={ordersTrend} color="#f59e0b" valueFormat={formatNumber} bucket={range.bucket} emptyLabel="No orders in this period" />
                </AnalyticsSection>
            </div>

            {/* ── Customers / Payments ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsSection title="Customer Mix" description="New vs. returning, among customers who ordered this period.">
                    <DonutChart
                        slices={[
                            { label: "New", value: Math.max(data.customers.customersWithOrders - data.customers.returningCustomers, 0), color: "#38bdf8" },
                            { label: "Returning", value: data.customers.returningCustomers, color: "#f59e0b" },
                        ]}
                        centerLabel={formatNumber(data.customers.customersWithOrders)}
                        centerSub="customers"
                        valueFormat={formatNumber}
                    />
                    <p className="mt-3 text-[11px] text-stone-600">
                        Repeat customer rate: <span className="font-bold text-stone-300">{formatRate(data.customers.repeatCustomerRate)}</span>{" "}
                        <span className="text-stone-700">(lifetime ≥2 eligible orders ÷ lifetime ≥1 eligible order, among this period&apos;s active customers)</span>
                    </p>
                </AnalyticsSection>

                <AnalyticsSection title="Payment Methods" description="Non-cancelled orders in this period.">
                    <DonutChart
                        slices={data.payments.map((p) => ({
                            label: p.method === "cod" ? "COD" : "Razorpay",
                            value: p.revenue,
                            color: p.method === "cod" ? "#fbbf24" : "#38bdf8",
                        }))}
                        centerLabel={formatCompactINR(current.revenue)}
                        centerSub="revenue"
                        valueFormat={formatCompactINR}
                    />
                </AnalyticsSection>
            </div>

            {/* ── Products / Categories ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsSection title="Top Products" description="By revenue — quantity × historical order-item price, never current Product.price." badge="Top 10">
                    <BarList
                        rows={data.products.topProducts.map((p) => ({ label: p.name, value: p.revenue, sub: p.units }))}
                        color="#f97316" valueFormat={formatCompactINR} subFormat={(n) => `${formatNumber(n)} units`}
                        emptyLabel="No product sales in this period"
                    />
                </AnalyticsSection>
                <AnalyticsSection title="Top Categories" description="Based on each product's CURRENT category — historical recategorization isn't tracked on the order." badge="Top 10">
                    <BarList
                        rows={data.products.topCategories.map((c) => ({ label: c.category, value: c.revenue, sub: c.units }))}
                        color="#fbbf24" valueFormat={formatCompactINR} subFormat={(n) => `${formatNumber(n)} units`}
                        emptyLabel="No category data in this period"
                    />
                </AnalyticsSection>
            </div>

            {/* ── Operations ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsSection title="Order Outcome" description="Current status of orders created in this period (not a transition-event log).">
                    <DonutChart
                        slices={data.outcome.map((o) => ({ label: o.status.replace(/_/g, " "), value: o.count, color: outcomeColors[o.status] ?? "#94a3b8" }))}
                        centerLabel={formatNumber(current.totalOrders)}
                        centerSub="orders"
                        valueFormat={formatNumber}
                    />
                </AnalyticsSection>
                <AnalyticsSection title="Cancellation Reasons" description="Stored reason on cancelled orders; unrecorded ones are grouped honestly, never guessed.">
                    <BarList
                        rows={data.cancellation.byReason.map((r) => ({ label: r.reason.replace(/_/g, " "), value: r.count }))}
                        color="#fb7185" valueFormat={formatNumber} emptyLabel="No cancellations in this period"
                    />
                    <div className="mt-3 flex gap-4 text-[11px] text-stone-600">
                        {data.cancellation.byActor.map((a) => (
                            <span key={a.actor}>
                                <span className="font-bold text-stone-300">{formatNumber(a.count)}</span> by {a.actor.replace(/_/g, " ")}
                            </span>
                        ))}
                    </div>
                </AnalyticsSection>
            </div>

            {/* ── Delivery / Serviceability ── */}
            <AnalyticsSection title="Delivery Distance" description="Based on the Order.distanceKm snapshot taken at order time — never recalculated from current kitchen coordinates.">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                    <BarList
                        rows={data.delivery.bands.map((b) => ({ label: b.band, value: b.orders }))}
                        color="#38bdf8" valueFormat={formatNumber} emptyLabel="No delivery-distance data in this period"
                    />
                    {data.delivery.averageDistanceKm !== null && (
                        <div className="flex items-center gap-2 self-start rounded-xl border border-sky-500/20 bg-sky-500/8 px-4 py-3">
                            <Truck size={14} className="text-sky-400" />
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-600">Avg Distance</p>
                                <p className="font-mono text-sm font-black text-sky-400">{data.delivery.averageDistanceKm.toFixed(1)} km</p>
                            </div>
                        </div>
                    )}
                </div>
            </AnalyticsSection>

            {/* ── Marketing: Coupons / Offers / Campaigns ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsSection title="Top Coupons" description="Discount amount redeemed via coupon code, non-cancelled orders." badge="Top 10">
                    <BarList
                        rows={data.promotions.topCoupons.map((c) => ({ label: c.code, value: c.discount, sub: c.orders }))}
                        color="#f59e0b" valueFormat={formatCompactINR} subFormat={(n) => `${formatNumber(n)} orders`}
                        emptyLabel="No coupon redemptions in this period"
                    />
                </AnalyticsSection>
                <AnalyticsSection title="Top Offers" description="Automatic campaign offers — discount amount applied, non-cancelled orders." badge="Top 10">
                    <BarList
                        rows={data.promotions.topOffers.map((o) => ({ label: o.name, value: o.discount, sub: o.orders }))}
                        color="#a78bfa" valueFormat={formatCompactINR} subFormat={(n) => `${formatNumber(n)} orders`}
                        emptyLabel="No offer usage in this period"
                    />
                </AnalyticsSection>
            </div>

            <AnalyticsSection title="Campaign Performance" description="Real attribution only: Order.offer.campaignId direct snapshot + coupon→campaign lookup. Never date-overlap guessing.">
                {data.promotions.campaignPerformance.length === 0 ? (
                    <div className="flex h-20 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.015] text-[11px] text-stone-600">
                        No campaign-attributed orders in this period
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[480px] text-left text-[11px]">
                            <thead>
                                <tr className="text-[9px] font-black uppercase tracking-wider text-stone-600">
                                    <th className="pb-2">Campaign</th>
                                    <th className="pb-2 text-right">Orders</th>
                                    <th className="pb-2 text-right">Revenue</th>
                                    <th className="pb-2 text-right">Discount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {data.promotions.campaignPerformance.map((c) => (
                                    <tr key={c.campaignId}>
                                        <td className="py-2 font-bold text-stone-300">{c.name}</td>
                                        <td className="py-2 text-right font-mono text-stone-400">{formatNumber(c.orders)}</td>
                                        <td className="py-2 text-right font-mono text-emerald-400">{formatCompactINR(c.revenue)}</td>
                                        <td className="py-2 text-right font-mono text-rose-400">{formatCompactINR(c.discount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AnalyticsSection>

            {/* ── Discount summary (kept separate — never combined silently) ── */}
            <AnalyticsSection title="Promotional Cost" description="Kept separate by source — never summed into one ambiguous 'total discount' figure.">
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-amber-500/15 bg-amber-500/6 px-4 py-3">
                        <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-stone-600"><Tag size={10} />Coupon</p>
                        <p className="mt-1 font-mono text-base font-black text-amber-400">{formatCompactINR(current.couponDiscount)}</p>
                    </div>
                    <div className="rounded-xl border border-violet-500/15 bg-violet-500/6 px-4 py-3">
                        <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-stone-600"><Percent size={10} />Offer</p>
                        <p className="mt-1 font-mono text-base font-black text-violet-400">{formatCompactINR(current.offerDiscount)}</p>
                    </div>
                    <div className="rounded-xl border border-sky-500/15 bg-sky-500/6 px-4 py-3">
                        <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-stone-600"><Gift size={10} />Loyalty Redeemed</p>
                        <p className="mt-1 font-mono text-base font-black text-sky-400">{formatCompactINR(current.loyaltyRedemptionValue)}</p>
                    </div>
                </div>
            </AnalyticsSection>

            {/* ── Loyalty & Spin ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsSection title="Loyalty Ledger" description="Grouped by actual ledger type — never collapsed into one ambiguous total.">
                    <BarList
                        rows={data.loyalty.byType.map((t) => ({ label: t.type.replace(/_/g, " "), value: Math.abs(t.points), sub: t.count }))}
                        color="#fbbf24" valueFormat={formatNumber} subFormat={(n) => `${formatNumber(n)} entries`}
                        emptyLabel="No loyalty ledger activity in this period"
                    />
                    <p className="mt-3 text-[11px] text-stone-600">
                        <Users size={11} className="mr-1 inline" />
                        <span className="font-bold text-stone-300">{formatNumber(data.loyalty.activeUsers)}</span> distinct users with ledger activity
                    </p>
                </AnalyticsSection>

                <AnalyticsSection title="Digital Spin" description="Real SpinRecord snapshots — never recalculated from current reward config.">
                    <div className="mb-3 flex gap-4">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-stone-600">Total Spins</p>
                            <p className="font-mono text-lg font-black text-white">{formatNumber(data.spin.totalSpins)}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-stone-600">Points Spent</p>
                            <p className="font-mono text-lg font-black text-amber-400">{formatNumber(data.spin.pointsSpent)}</p>
                        </div>
                    </div>
                    <BarList
                        rows={data.spin.byRewardType.map((r) => ({ label: r.rewardType.replace(/_/g, " "), value: r.count }))}
                        color="#a78bfa" valueFormat={formatNumber} emptyLabel="No spins in this period"
                    />
                </AnalyticsSection>
            </div>

            {/* ── Reviews ── */}
            <AnalyticsSection title="Customer Satisfaction" description="Overall only — the Review model has no product/order link to attribute ratings further.">
                <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                    <div className="flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/6 px-4 py-3">
                        <Star size={18} className="text-amber-400" fill="currentColor" />
                        <div>
                            <p className="font-mono text-xl font-black text-amber-400">
                                {data.reviews.averageRating !== null ? data.reviews.averageRating.toFixed(2) : "—"}
                            </p>
                            <p className="text-[10px] text-stone-600">{formatNumber(data.reviews.count)} reviews</p>
                        </div>
                    </div>
                    <BarList
                        rows={([5, 4, 3, 2, 1] as const).map((star) => ({ label: `${star} star`, value: data.reviews.distribution[star] }))}
                        color="#fbbf24" valueFormat={formatNumber} emptyLabel="No reviews in this period"
                    />
                </div>
            </AnalyticsSection>

            <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-[10px] text-stone-700">
                <Sparkles size={11} className="text-stone-600" />
                Archived orders are excluded from every figure on this page. Product/Order items use historical price snapshots, never current pricing.
            </div>
        </div>
    );
}
