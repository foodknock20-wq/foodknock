// src/lib/adminGrowth.ts
//
// Phase 16 — Customer Retention & Business Intelligence. A layer ON TOP of
// Phase 15D Analytics 2.0, not a replacement. Phase 15D answers "what
// happened" (orders/revenue/trend for a selected period); this file
// answers "is the customer base coming back, and who matters" — questions
// that inherently need the FULL historical order timeline per customer,
// not a period-scoped query. That's why this file deliberately does NOT
// take a date-range parameter the way getAnalyticsData() does — cohort/
// RFM/reorder-interval math breaks the moment you slice it by an arbitrary
// window (a March cohort's 90-day retention needs June data to exist; a
// period filter would either produce a wrong number or a fake N/A for
// everyone). Per the Phase 16 brief itself: "design date logic carefully
// ... distinguish analysis period from customer observation window." The
// simplest correct design is: always analyze full history.
//
// ── CUSTOMER IDENTITY (important, explicit) ────────────────────────────
// Order has no reliable `user` ObjectId on every historical row (guest
// checkouts, pre-account-link orders). Phase 15F's Customers 2.0 already
// established the working precedent for this exact problem: the unit of
// "a customer" for order-history aggregation is Order.phone, not
// User._id (see admin/users/page.tsx's orderAgg). This file reuses that
// same precedent — every metric below is computed per distinct
// Order.phone. Display names for the RFM explorer are resolved via a
// bounded, paginated lookup against User by phone, exactly mirroring how
// the Customers 2.0 table already does it — never a second identity model.
//
// ── QUALIFYING ORDER (Phase 16 authority — reuses, does not contradict,
// Phase 15D) ─────────────────────────────────────────────────────────────
// Phase 15D's "Orders" KPI deliberately INCLUDES cancelled orders (it's
// measuring operational volume — how many orders came in). Phase 16 is
// measuring CUSTOMER BEHAVIOR — did they successfully transact — so a
// cancelled order is explicitly excluded here (brief §8/§51: "do not
// count cancelled orders as successful repeats"). Both definitions are
// correct for their own purpose; they are not in conflict.
//
//   Qualifying order = archivedAt: null AND status != "cancelled"
//   Qualifying revenue = sum(totalAmount) of qualifying orders
//     (identical rule to Phase 15D's own revenue definition — reused,
//     not reinvented)
//
// ── PERFORMANCE ─────────────────────────────────────────────────────────
// ONE bounded Mongo aggregation groups the ENTIRE Order collection down to
// one row per distinct customer (phone) with their sorted order summary
// (first/second/third order dates, count, revenue, coupon/offer/loyalty
// flags on their first order, last order date). At FoodKnock's current
// scale (~800 orders / ~700 customers) this result set is tiny — every
// downstream metric (funnel, cohorts, RFM, LTV, revenue concentration,
// at-risk/inactive classification) is then derived from that ALREADY-
// BOUNDED in-memory array via plain server-side JS, not a browser, and not
// N additional queries. A second, separate bounded aggregation (unwind
// items, group by product+phone) computes product-level repeat behavior —
// kept separate because unwinding items is incompatible with the
// per-customer grouping above.

import { connectDB } from "@/lib/db";
import Order from "@/models/Order";

const ARCHIVED_EXCLUDED = { archivedAt: null } as const;
const QUALIFYING_MATCH = { ...ARCHIVED_EXCLUDED, status: { $ne: "cancelled" } } as const;

// Mirrors Phase 15F's own Inactive threshold (admin/users/page.tsx) —
// same value, independently declared here rather than importing from a
// page.tsx module (Phase 15 pages are frozen; not touching that file to
// export one more constant). If Phase 15F's threshold ever changes, this
// should be updated to match — see that file's own definition comment.
const INACTIVE_DAYS = 60;
// Global fallback reorder-gap threshold for customers with too few orders
// to have a personal reorder pattern (see classifyLifecycle() below).
// FoodKnock is a daily-food-delivery business; a conservative "longer than
// three weeks since a single order" is a reasonable, documented default —
// NOT derived from a large statistical sample (the dataset is currently
// too small for that), flagged honestly as a heuristic, not a measured fact.
const DEFAULT_AT_RISK_DAYS = 21;
const MIN_PRODUCT_SAMPLE = 8; // brief §17/§31 — don't rank tiny samples

export type CustomerSummary = {
    phone: string;
    orderCount: number;
    revenue: number;
    firstOrderAt: Date;
    secondOrderAt: Date | null;
    thirdOrderAt: Date | null;
    lastOrderAt: Date;
    hadCouponOnFirstOrder: boolean;
    hadOfferOnFirstOrder: boolean;
    everRedeemedLoyalty: boolean;
};

async function getCustomerSummaries(): Promise<CustomerSummary[]> {
    await connectDB();

    const rows = await Order.aggregate([
        { $match: { ...QUALIFYING_MATCH, phone: { $exists: true, $ne: null, $type: "string" } } },
        { $sort: { createdAt: 1 } },
        {
            $group: {
                _id: "$phone",
                orderCount: { $sum: 1 },
                revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
                orders: {
                    $push: {
                        createdAt: "$createdAt",
                        hasCoupon: { $ne: ["$coupon.couponId", null] },
                        hasOffer: { $ne: ["$offer.offerId", null] },
                        redeemedPoints: { $ifNull: ["$redeemedPoints", 0] },
                    },
                },
            },
        },
    ]).exec();

    return rows.map((r: { _id: string; orderCount: number; revenue: number; orders: Array<{ createdAt: Date; hasCoupon: boolean; hasOffer: boolean; redeemedPoints: number }> }) => {
        const orders = r.orders; // already createdAt-ascending from the $sort before $group ($push preserves order)
        const first = orders[0];
        return {
            phone: r._id,
            orderCount: r.orderCount,
            revenue: r.revenue,
            firstOrderAt: new Date(first.createdAt),
            secondOrderAt: orders[1] ? new Date(orders[1].createdAt) : null,
            thirdOrderAt: orders[2] ? new Date(orders[2].createdAt) : null,
            lastOrderAt: new Date(orders[orders.length - 1].createdAt),
            hadCouponOnFirstOrder: first.hasCoupon,
            hadOfferOnFirstOrder: first.hasOffer,
            everRedeemedLoyalty: orders.some((o) => o.redeemedPoints > 0),
        };
    });
}

function daysBetween(a: Date, b: Date): number {
    return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

// ── Retention Overview ───────────────────────────────────────────────────
export type RetentionOverview = {
    totalCustomers: number;
    repeatCustomers: number; // >=2 qualifying orders
    repeatRate: number | null;
    secondOrderConversion: { firstOrderCustomers: number; secondOrderCustomers: number; rate: number | null };
    thirdOrderConversion: { secondOrderCustomers: number; thirdOrderCustomers: number; rate: number | null };
    avgReorderGapDays: number | null;
    medianReorderGapDays: number | null;
    atRiskCount: number;
    inactiveCount: number;
    observedLtv: number | null; // lifetime revenue / lifetime customer count
};

// ── Reorder interval bands ───────────────────────────────────────────────
export type ReorderBand = { label: string; count: number };

function reorderGapsFor(c: CustomerSummary, allGaps: number[]): void {
    // Collects every consecutive gap for this customer into the shared
    // array — used for the global average/median/band distribution.
    // (first→second, second→third only — we don't re-derive from a raw
    // order array beyond the 3 dates this file tracks per customer,
    // which is sufficient for "reorder interval" as defined in the brief;
    // customers with 4+ orders still contribute their first two gaps.)
    if (c.secondOrderAt) allGaps.push(daysBetween(c.secondOrderAt, c.firstOrderAt));
    if (c.secondOrderAt && c.thirdOrderAt) allGaps.push(daysBetween(c.thirdOrderAt, c.secondOrderAt));
}

function median(nums: number[]): number | null {
    if (nums.length === 0) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ── Lifecycle classification (New/Returning/Repeat/At-Risk/Inactive) ────
export type LifecycleStage = "new" | "returning" | "repeat" | "at_risk" | "inactive";

export function classifyLifecycle(c: CustomerSummary, now: Date, personalAvgGap: number | null): LifecycleStage {
    const daysSinceLast = daysBetween(now, c.lastOrderAt);
    if (daysSinceLast > INACTIVE_DAYS) return "inactive";

    // Behavior-based at-risk: compare days-since-last-order against THIS
    // customer's own observed reorder pattern when we have one (>=2 gaps,
    // i.e. >=3 orders); otherwise fall back to the conservative global
    // default (brief §6/§24 — explicitly sanctioned when "behavior-based
    // classification... sample size is insufficient").
    const threshold = personalAvgGap !== null ? personalAvgGap * 1.5 : DEFAULT_AT_RISK_DAYS;
    if (daysSinceLast > threshold && c.orderCount >= 1) {
        // A brand-new one-order customer still within their first normal
        // window is "new", not "at risk" — only flag at-risk once they've
        // shown a pattern (>=2 orders) OR exceeded the conservative
        // default as a single-order customer.
        if (c.orderCount >= 2 || daysSinceLast > DEFAULT_AT_RISK_DAYS) return "at_risk";
    }

    if (c.orderCount >= 3) return "repeat";
    if (c.orderCount === 2) return "returning";
    return "new";
}

export async function getRetentionOverview(): Promise<{ overview: RetentionOverview; bands: ReorderBand[]; summaries: CustomerSummary[] }> {
    const summaries = await getCustomerSummaries();
    const now = new Date();

    const totalCustomers = summaries.length;
    const firstOrderCustomers = summaries.length; // everyone here has >=1 qualifying order by construction
    const secondOrderCustomers = summaries.filter((c) => c.secondOrderAt !== null).length;
    const thirdOrderCustomers = summaries.filter((c) => c.thirdOrderAt !== null).length;
    const repeatCustomers = summaries.filter((c) => c.orderCount >= 2).length;

    const allGaps: number[] = [];
    summaries.forEach((c) => reorderGapsFor(c, allGaps));

    const bandDefs: [string, (d: number) => boolean][] = [
        ["0–7 days", (d) => d <= 7],
        ["8–14 days", (d) => d > 7 && d <= 14],
        ["15–30 days", (d) => d > 14 && d <= 30],
        ["31–60 days", (d) => d > 30 && d <= 60],
        ["60+ days", (d) => d > 60],
    ];
    const bands: ReorderBand[] = bandDefs.map(([label, test]) => ({ label, count: allGaps.filter(test).length }));

    // Per-customer average gap (for at-risk classification) — only
    // meaningful with >=2 gaps (>=3 orders).
    const atRiskThresholdMap = new Map<string, number | null>();
    for (const c of summaries) {
        const gaps: number[] = [];
        reorderGapsFor(c, gaps);
        atRiskThresholdMap.set(c.phone, gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null);
    }

    let atRiskCount = 0, inactiveCount = 0;
    for (const c of summaries) {
        const stage = classifyLifecycle(c, now, atRiskThresholdMap.get(c.phone) ?? null);
        if (stage === "at_risk") atRiskCount++;
        if (stage === "inactive") inactiveCount++;
    }

    const totalRevenue = summaries.reduce((s, c) => s + c.revenue, 0);

    return {
        overview: {
            totalCustomers,
            repeatCustomers,
            repeatRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : null,
            secondOrderConversion: {
                firstOrderCustomers,
                secondOrderCustomers,
                rate: firstOrderCustomers > 0 ? (secondOrderCustomers / firstOrderCustomers) * 100 : null,
            },
            thirdOrderConversion: {
                secondOrderCustomers,
                thirdOrderCustomers,
                rate: secondOrderCustomers > 0 ? (thirdOrderCustomers / secondOrderCustomers) * 100 : null,
            },
            avgReorderGapDays: allGaps.length > 0 ? allGaps.reduce((s, g) => s + g, 0) / allGaps.length : null,
            medianReorderGapDays: median(allGaps),
            atRiskCount,
            inactiveCount,
            observedLtv: totalCustomers > 0 ? totalRevenue / totalCustomers : null,
        },
        bands,
        summaries,
    };
}

// ── Cohort analysis (first-order month) ──────────────────────────────────
export type CohortRow = {
    cohort: string; // "2026-03"
    customers: number;
    retention: { d7: number | null; d30: number | null; d60: number | null; d90: number | null };
};

function monthKey(d: Date): string {
    // Asia/Kolkata calendar month — shift +5:30 before reading Y/M, same
    // approach as Phase 15D's analyticsDateRange.ts (reused convention,
    // not a new timezone trick).
    const shifted = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildCohorts(summaries: CustomerSummary[], now: Date): CohortRow[] {
    const byCohort = new Map<string, CustomerSummary[]>();
    for (const c of summaries) {
        const key = monthKey(c.firstOrderAt);
        if (!byCohort.has(key)) byCohort.set(key, []);
        byCohort.get(key)!.push(c);
    }

    const rows: CohortRow[] = [];
    for (const [cohort, customers] of [...byCohort.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const cohortStart = customers[0].firstOrderAt; // all share the same cohort month; use earliest for maturity math
        const daysObserved = daysBetween(now, cohortStart);

        const retained = (windowDays: number) =>
            customers.filter((c) => c.secondOrderAt !== null && daysBetween(c.secondOrderAt, c.firstOrderAt) <= windowDays).length;

        const pct = (n: number) => (customers.length > 0 ? (n / customers.length) * 100 : null);

        rows.push({
            cohort,
            customers: customers.length,
            retention: {
                d7: daysObserved >= 7 ? pct(retained(7)) : null,
                d30: daysObserved >= 30 ? pct(retained(30)) : null,
                d60: daysObserved >= 60 ? pct(retained(60)) : null,
                d90: daysObserved >= 90 ? pct(retained(90)) : null,
            },
        });
    }
    return rows;
}

// ── RFM segmentation ──────────────────────────────────────────────────────
export type RfmSegment = "Champions" | "Loyal Customers" | "Potential Loyalists" | "New Customers" | "Need Attention" | "At Risk" | "Lost";

export type RfmCustomer = {
    phone: string;
    recencyDays: number;
    frequency: number;
    monetary: number;
    rScore: number;
    fScore: number;
    mScore: number;
    segment: RfmSegment;
};

/** Quintile score (1=worst, 5=best) by rank position — deterministic, no external stats library. */
function quintileScores(values: number[], higherIsBetter: boolean): number[] {
    const n = values.length;
    const indexed = values.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => (higherIsBetter ? a.v - b.v : b.v - a.v)); // ascending "worst first" for higherIsBetter, else reversed
    const scores = new Array(n).fill(1);
    indexed.forEach((item, rank) => {
        const bucket = Math.min(5, Math.floor((rank / n) * 5) + 1);
        scores[item.i] = bucket;
    });
    return scores;
}

function segmentFor(r: number, f: number, m: number): RfmSegment {
    if (r >= 4 && f >= 4 && m >= 4) return "Champions";
    if (r >= 3 && f >= 3) return "Loyal Customers";
    if (r >= 4 && f <= 2) return "New Customers";
    if (r <= 2 && f >= 4) return "At Risk";
    if (r <= 2 && f <= 2 && m <= 2) return "Lost";
    if (r >= 3 && f <= 2) return "Potential Loyalists";
    return "Need Attention";
}

export function buildRfm(summaries: CustomerSummary[], now: Date): RfmCustomer[] {
    const recency = summaries.map((c) => daysBetween(now, c.lastOrderAt));
    const frequency = summaries.map((c) => c.orderCount);
    const monetary = summaries.map((c) => c.revenue);

    const rScores = quintileScores(recency, false); // fewer days = better = higher score
    const fScores = quintileScores(frequency, true);
    const mScores = quintileScores(monetary, true);

    return summaries.map((c, i) => ({
        phone: c.phone,
        recencyDays: recency[i],
        frequency: frequency[i],
        monetary: monetary[i],
        rScore: rScores[i],
        fScore: fScores[i],
        mScore: mScores[i],
        segment: segmentFor(rScores[i], fScores[i], mScores[i]),
    }));
}

// ── Revenue concentration ─────────────────────────────────────────────────
export type RevenueConcentration = { label: string; customerCount: number; revenue: number; revenuePct: number }[];

export function buildRevenueConcentration(summaries: CustomerSummary[]): RevenueConcentration {
    const sorted = [...summaries].sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = sorted.reduce((s, c) => s + c.revenue, 0);
    const n = sorted.length;

    const bands: [string, number][] = [["Top 1%", 0.01], ["Top 5%", 0.05], ["Top 10%", 0.10], ["Top 25%", 0.25]];
    return bands.map(([label, pct]) => {
        const count = Math.max(1, Math.round(n * pct));
        const revenue = sorted.slice(0, count).reduce((s, c) => s + c.revenue, 0);
        return { label, customerCount: count, revenue, revenuePct: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0 };
    });
}

// ── Coupon / Loyalty behavior comparison ──────────────────────────────────
export type BehaviorComparison = {
    groupA: { label: string; customers: number; secondOrderRate: number | null; avgRevenue: number | null };
    groupB: { label: string; customers: number; secondOrderRate: number | null; avgRevenue: number | null };
};

function compareGroups(
    summaries: CustomerSummary[],
    predicate: (c: CustomerSummary) => boolean,
    labelA: string, labelB: string
): BehaviorComparison {
    const groupA = summaries.filter(predicate);
    const groupB = summaries.filter((c) => !predicate(c));
    const stats = (group: CustomerSummary[]) => ({
        customers: group.length,
        secondOrderRate: group.length > 0 ? (group.filter((c) => c.secondOrderAt !== null).length / group.length) * 100 : null,
        avgRevenue: group.length > 0 ? group.reduce((s, c) => s + c.revenue, 0) / group.length : null,
    });
    return {
        groupA: { label: labelA, ...stats(groupA) },
        groupB: { label: labelB, ...stats(groupB) },
    };
}

export function buildCouponComparison(summaries: CustomerSummary[]): BehaviorComparison {
    return compareGroups(summaries, (c) => c.hadCouponOnFirstOrder, "Coupon-assisted first order", "No coupon on first order");
}

export function buildLoyaltyComparison(summaries: CustomerSummary[]): BehaviorComparison {
    return compareGroups(summaries, (c) => c.everRedeemedLoyalty, "Ever redeemed loyalty", "Never redeemed loyalty");
}

// ── Growth funnel ──────────────────────────────────────────────────────────
export type FunnelStage = { label: string; count: number; conversionFromPrev: number | null };

export async function getGrowthFunnel(summaries: CustomerSummary[]): Promise<FunnelStage[]> {
    await connectDB();
    const User = (await import("@/models/User")).default;
    const registered = await User.countDocuments();

    const firstOrder = summaries.length;
    const secondOrder = summaries.filter((c) => c.secondOrderAt !== null).length;
    const thirdOrder = summaries.filter((c) => c.thirdOrderAt !== null).length;
    const repeat = summaries.filter((c) => c.orderCount >= 3).length;

    const stages: { label: string; count: number }[] = [
        { label: "Registered", count: registered },
        { label: "First Order", count: firstOrder },
        { label: "Second Order", count: secondOrder },
        { label: "Third Order", count: thirdOrder },
        { label: "Repeat (3+)", count: repeat },
    ];

    return stages.map((s, i) => ({
        ...s,
        conversionFromPrev: i === 0 ? null : stages[i - 1].count > 0 ? (s.count / stages[i - 1].count) * 100 : null,
    }));
}

// ── Product retention intelligence ────────────────────────────────────────
export type ProductRetentionRow = { name: string; buyers: number; repeatBuyers: number; repeatRate: number; revenue: number };

export async function getProductRetention(repeatPhones: Set<string>): Promise<ProductRetentionRow[]> {
    await connectDB();
    const rows = await Order.aggregate([
        { $match: { ...QUALIFYING_MATCH, phone: { $exists: true, $ne: null, $type: "string" } } },
        { $unwind: "$items" },
        {
            $group: {
                _id: { name: "$items.name", phone: "$phone" },
                revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
            },
        },
        {
            $group: {
                _id: "$_id.name",
                buyers: { $sum: 1 },
                revenue: { $sum: "$revenue" },
                phones: { $push: "$_id.phone" },
            },
        },
        { $match: { buyers: { $gte: MIN_PRODUCT_SAMPLE } } },
        { $sort: { buyers: -1 } },
        { $limit: 30 },
    ]).exec();

    return rows.map((r: { _id: string; buyers: number; revenue: number; phones: string[] }) => {
        const repeatBuyers = r.phones.filter((p) => repeatPhones.has(p)).length;
        return {
            name: r._id,
            buyers: r.buyers,
            repeatBuyers,
            repeatRate: r.buyers > 0 ? (repeatBuyers / r.buyers) * 100 : 0,
            revenue: r.revenue,
        };
    }).sort((a, b) => b.repeatRate - a.repeatRate);
}

export { INACTIVE_DAYS, MIN_PRODUCT_SAMPLE };
