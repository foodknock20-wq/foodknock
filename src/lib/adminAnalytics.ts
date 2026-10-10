// src/lib/adminAnalytics.ts
//
// Phase 15D — Analytics 2.0. Server-only aggregation layer for the Admin
// Analytics Center (src/app/admin/analytics). Every number here has an
// explicit, documented definition (see each function's header) — nothing
// is fabricated, nothing is derived from a client-side-capped dataset
// (the mistake Phase 15C removed from the Orders list), and nothing uses
// current/live config to recompute a historical value.
//
// ── GLOBAL RULES APPLIED THROUGHOUT THIS FILE ───────────────────────────
// 1. Archived orders (Order.archivedAt != null) are EXCLUDED from every
//    query below. Rationale: archiving means "operationally removed" in
//    the Orders 2.0 list (Phase 15C) — analytics should reflect the same
//    operational reality the admin sees there, not silently resurrect
//    archived rows into business reporting. Applied identically to every
//    chart/table — never inconsistent.
// 2. "Revenue" always means the FINAL `totalAmount` of NON-CANCELLED
//    orders in the period. Cancelled orders are counted in "Orders" and
//    "Cancellation Rate" but never contribute to revenue/AOV/discount
//    totals — a cancelled order was never actually fulfilled/paid-out
//    business value.
// 3. AOV = eligible revenue / eligible order count, using the SAME
//    (non-cancelled) population for both sides — never an average of
//    already-rounded display values.
// 4. Historical snapshots win over live config everywhere: order item
//    price (not current Product.price), Order.coupon/offer.discountAmount
//    (not recalculated from current Coupon/Offer docs), Order.distanceKm
//    (not recalculated from current kitchen coordinates).
// 5. Every query is date-bounded and uses the existing indexes
//    ({createdAt:-1}, {status:1,createdAt:-1}, {user:1,createdAt:-1}) —
//    no new indexes were needed (see Phase 15D audit).

import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import Product from "@/models/Product";
import Coupon from "@/models/Coupon";
import Campaign from "@/models/Campaign";
import LoyaltyLedger from "@/models/LoyaltyLedger";
import SpinRecord from "@/models/SpinRecord";
import Review from "@/models/Review";
import type { ResolvedRange } from "@/lib/analyticsDateRange";

const ARCHIVED_EXCLUDED = { archivedAt: null } as const;

function periodMatch(range: { start: Date; end: Date }) {
    return { createdAt: { $gte: range.start, $lt: range.end }, ...ARCHIVED_EXCLUDED };
}

// ── 1. Core KPI totals (also used for the previous-period comparison) ───
//
// Definitions:
//   Orders            = all orders created in period (incl. cancelled), archived excluded.
//   Revenue            = sum(totalAmount) of NON-cancelled orders.
//   Delivered Orders  = orders whose CURRENT status is "delivered" and were CREATED in
//                        period ("Order Outcome" — current/final status of orders created
//                        in the period, not a transition-event log; statusHistory-based
//                        "Status Activity" is a different metric, deliberately not built
//                        here to avoid mixing the two — see Phase 15D audit §19).
//   Cancelled Orders   = orders whose status is "cancelled", created in period.
//   Cancellation Rate  = cancelledOrders / totalOrders (cancelled IS included in the denominator).
export type CoreTotals = {
    totalOrders: number;
    cancelledOrders: number;
    deliveredOrders: number;
    revenue: number;
    deliveryFeeRevenue: number;
    couponDiscount: number;
    offerDiscount: number;
    loyaltyRedemptionValue: number;
    codOrders: number;
    razorpayOrders: number;
};

// Phase 15E.8 — exported (previously module-private) so the Dashboard 2.0
// can reuse these exact definitions directly instead of calling the full
// getAnalyticsData() (13 aggregations, most unused on the dashboard) or
// re-deriving its own competing revenue/trend/outcome logic. No behavior
// change — same functions, just visible outside this file.
export async function getCoreTotals(range: { start: Date; end: Date }): Promise<CoreTotals> {
    const rows = await Order.aggregate([
        { $match: periodMatch(range) },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                cancelledOrders: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
                deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
                revenue: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$totalAmount", 0] } },
                deliveryFeeRevenue: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$deliveryFee", 0] } },
                couponDiscount: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$coupon.discountAmount", 0] } },
                offerDiscount: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$offer.discountAmount", 0] } },
                loyaltyRedemptionValue: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$redeemedAmount", 0] } },
                codOrders: { $sum: { $cond: [{ $and: [{ $ne: ["$status", "cancelled"] }, { $eq: ["$paymentMethod", "cod"] }] }, 1, 0] } },
                razorpayOrders: { $sum: { $cond: [{ $and: [{ $ne: ["$status", "cancelled"] }, { $eq: ["$paymentMethod", "razorpay"] }] }, 1, 0] } },
            },
        },
    ]).exec();

    const r = rows[0];
    if (!r) {
        return { totalOrders: 0, cancelledOrders: 0, deliveredOrders: 0, revenue: 0, deliveryFeeRevenue: 0, couponDiscount: 0, offerDiscount: 0, loyaltyRedemptionValue: 0, codOrders: 0, razorpayOrders: 0 };
    }
    return {
        totalOrders: r.totalOrders ?? 0,
        cancelledOrders: r.cancelledOrders ?? 0,
        deliveredOrders: r.deliveredOrders ?? 0,
        revenue: r.revenue ?? 0,
        deliveryFeeRevenue: r.deliveryFeeRevenue ?? 0,
        couponDiscount: r.couponDiscount ?? 0,
        offerDiscount: r.offerDiscount ?? 0,
        loyaltyRedemptionValue: r.loyaltyRedemptionValue ?? 0,
        codOrders: r.codOrders ?? 0,
        razorpayOrders: r.razorpayOrders ?? 0,
    };
}

// ── 2. Orders + Revenue trend (bucketed, Asia/Kolkata-aware via $dateTrunc) ─
export type TrendPoint = { bucketStart: string; orders: number; revenue: number };

export async function getTrend(range: ResolvedRange): Promise<TrendPoint[]> {
    const unit = range.bucket === "hour" ? "hour" : range.bucket === "month" ? "month" : "day";
    const rows = await Order.aggregate([
        { $match: periodMatch(range) },
        {
            $group: {
                _id: { $dateTrunc: { date: "$createdAt", unit, timezone: "Asia/Kolkata" } },
                orders: { $sum: 1 },
                revenue: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$totalAmount", 0] } },
            },
        },
        { $sort: { _id: 1 } },
    ]).exec();

    return rows.map((r: { _id: Date; orders: number; revenue: number }) => ({
        bucketStart: new Date(r._id).toISOString(),
        orders: r.orders,
        revenue: r.revenue,
    }));
}

// ── 3. Customer analytics ────────────────────────────────────────────────
//
// New customer       = a customer (User) whose account was created within the period.
// Returning customer = a customer who placed >=1 order in the period AND has at least
//                       one OTHER order (any status) dated strictly BEFORE the period
//                       started — i.e. a genuine prior relationship, not merely >1 order
//                       counted inside the window (Phase 15D audit §14 — a shortcut like
//                       "order count within range > 1" was explicitly rejected as inaccurate).
// Repeat Customer Rate (for this period's active customers) =
//   (customers active in period with >=2 LIFETIME eligible [non-cancelled] orders) /
//   (customers active in period with >=1 LIFETIME eligible order)
export type CustomerAnalytics = {
    newCustomers: number;
    returningCustomers: number;
    customersWithOrders: number;
    repeatCustomerRate: number | null;
};

export async function getCustomerAnalytics(range: { start: Date; end: Date }): Promise<CustomerAnalytics> {
    const [newCustomers, activeCustomerIds] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: range.start, $lt: range.end } }),
        Order.distinct("user", { ...periodMatch(range), user: { $ne: null } }),
    ]);

    if (activeCustomerIds.length === 0) {
        return { newCustomers, returningCustomers: 0, customersWithOrders: 0, repeatCustomerRate: null };
    }

    const [priorOrderUserIds, lifetimeEligibleCounts] = await Promise.all([
        Order.distinct("user", {
            user: { $in: activeCustomerIds },
            createdAt: { $lt: range.start },
            archivedAt: null,
        }),
        Order.aggregate([
            { $match: { user: { $in: activeCustomerIds }, status: { $ne: "cancelled" }, archivedAt: null } },
            { $group: { _id: "$user", count: { $sum: 1 } } },
        ]).exec(),
    ]);

    const returningCustomers = priorOrderUserIds.length;
    const withAtLeastOneEligible = lifetimeEligibleCounts.length;
    const withTwoPlusEligible = lifetimeEligibleCounts.filter((r: { count: number }) => r.count >= 2).length;
    const repeatCustomerRate = withAtLeastOneEligible > 0 ? (withTwoPlusEligible / withAtLeastOneEligible) * 100 : null;

    return {
        newCustomers,
        returningCustomers,
        customersWithOrders: activeCustomerIds.length,
        repeatCustomerRate,
    };
}

// ── 4. Product + Category analytics ─────────────────────────────────────
//
// Uses the HISTORICAL order-item price snapshot (quantity × item.price as
// stored on the order at purchase time) — never current Product.price.
// Scoped to non-cancelled, non-archived orders in the period.
export type ProductRow = { productId: string | null; name: string; units: number; revenue: number; orders: number };
export type CategoryRow = { category: string; units: number; revenue: number };

export async function getProductAndCategoryAnalytics(range: { start: Date; end: Date }): Promise<{ topProducts: ProductRow[]; topCategories: CategoryRow[]; itemsSold: number }> {
    const rows = await Order.aggregate([
        { $match: { ...periodMatch(range), status: { $ne: "cancelled" } } },
        { $unwind: "$items" },
        {
            $group: {
                _id: { productId: "$items.productId", name: "$items.name" },
                units: { $sum: "$items.quantity" },
                revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                orders: { $addToSet: "$_id" },
            },
        },
    ]).exec();

    const perProduct: ProductRow[] = rows.map((r: { _id: { productId: unknown; name: string }; units: number; revenue: number; orders: unknown[] }) => ({
        productId: r._id.productId ? String(r._id.productId) : null,
        name: r._id.name ?? "Unknown item",
        units: r.units,
        revenue: r.revenue,
        orders: r.orders.length,
    }));

    const itemsSold = perProduct.reduce((sum, p) => sum + p.units, 0);

    const topProducts = [...perProduct].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Category rollup: bounded lookup on DISTINCT products that appeared
    // (small — catalog-sized, not order-item-sized), using CURRENT
    // Product.category (no historical category snapshot exists on the
    // order — see Phase 15D audit §17. Labeled honestly in the UI).
    const productIds = perProduct.map((p) => p.productId).filter((id): id is string => !!id);
    const categoryByProductId = new Map<string, string>();
    if (productIds.length > 0) {
        const products = await Product.find({ _id: { $in: productIds } }).select("category").lean<{ _id: { toString(): string }; category?: string }[]>();
        for (const p of products) categoryByProductId.set(p._id.toString(), p.category ?? "Uncategorized");
    }

    const categoryTotals = new Map<string, CategoryRow>();
    for (const p of perProduct) {
        const category = p.productId ? categoryByProductId.get(p.productId) ?? "Uncategorized" : "Uncategorized";
        const existing = categoryTotals.get(category) ?? { category, units: 0, revenue: 0 };
        existing.units += p.units;
        existing.revenue += p.revenue;
        categoryTotals.set(category, existing);
    }
    const topCategories = [...categoryTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    return { topProducts, topCategories, itemsSold };
}

// ── 5. Payment method distribution ───────────────────────────────────────
export type PaymentRow = { method: "cod" | "razorpay"; orders: number; revenue: number };

async function getPaymentAnalytics(range: { start: Date; end: Date }): Promise<PaymentRow[]> {
    const rows = await Order.aggregate([
        { $match: { ...periodMatch(range), status: { $ne: "cancelled" } } },
        { $group: { _id: "$paymentMethod", orders: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
    ]).exec();
    return rows.map((r: { _id: "cod" | "razorpay"; orders: number; revenue: number }) => ({ method: r._id, orders: r.orders, revenue: r.revenue }));
}

// ── 6. Order Outcome (current status of orders created in period) ──────
export type OutcomeRow = { status: string; count: number };

export async function getOrderOutcome(range: { start: Date; end: Date }): Promise<OutcomeRow[]> {
    const rows = await Order.aggregate([
        { $match: periodMatch(range) },
        { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).exec();
    return rows.map((r: { _id: string; count: number }) => ({ status: r._id, count: r.count }));
}

// ── 7. Cancellation analytics ────────────────────────────────────────────
export type CancellationAnalytics = {
    byReason: { reason: string; count: number }[];
    byActor: { actor: string; count: number }[];
};

async function getCancellationAnalytics(range: { start: Date; end: Date }): Promise<CancellationAnalytics> {
    const [byReason, byActor] = await Promise.all([
        Order.aggregate([
            { $match: { ...periodMatch(range), status: "cancelled" } },
            { $group: { _id: { $ifNull: ["$cancellation.reason", "Unknown / Not Recorded"] }, count: { $sum: 1 } } },
        ]).exec(),
        Order.aggregate([
            { $match: { ...periodMatch(range), status: "cancelled" } },
            { $group: { _id: { $ifNull: ["$cancellation.cancelledBy.type", "Unknown / Not Recorded"] }, count: { $sum: 1 } } },
        ]).exec(),
    ]);
    return {
        byReason: byReason.map((r: { _id: string; count: number }) => ({ reason: r._id, count: r.count })),
        byActor: byActor.map((r: { _id: string; count: number }) => ({ actor: r._id, count: r.count })),
    };
}

// ── 8. Coupon / Offer / Campaign analytics ───────────────────────────────
//
// Campaign attribution uses REAL stored relationships only:
//   - Offer-driven orders: Order.offer.campaignId (direct snapshot).
//   - Coupon-driven orders: Order.coupon.couponId -> Coupon.campaignId
//     (one small bounded lookup on the distinct coupon ids actually used
//     in the period — never a date-overlap guess).
export type TopCouponRow = { code: string; orders: number; discount: number };
export type TopOfferRow = { name: string; orders: number; discount: number };
export type CampaignRow = { campaignId: string; name: string; orders: number; revenue: number; discount: number };

async function getPromotionAnalytics(range: { start: Date; end: Date }) {
    const baseMatch = { ...periodMatch(range), status: { $ne: "cancelled" } };

    const [couponRows, offerRows] = await Promise.all([
        Order.aggregate([
            { $match: { ...baseMatch, "coupon.couponId": { $ne: null } } },
            { $group: { _id: { id: "$coupon.couponId", code: "$coupon.code" }, orders: { $sum: 1 }, discount: { $sum: "$coupon.discountAmount" } } },
            { $sort: { discount: -1 } },
        ]).exec(),
        Order.aggregate([
            { $match: { ...baseMatch, "offer.offerId": { $ne: null } } },
            { $group: { _id: { id: "$offer.offerId", campaignId: "$offer.campaignId", name: "$offer.name" }, orders: { $sum: 1 }, revenue: { $sum: "$totalAmount" }, discount: { $sum: "$offer.discountAmount" } } },
            { $sort: { discount: -1 } },
        ]).exec(),
    ]);

    const topCoupons: TopCouponRow[] = couponRows.slice(0, 10).map((r: { _id: { code?: string }; orders: number; discount: number }) => ({
        code: r._id.code ?? "—", orders: r.orders, discount: r.discount,
    }));
    const topOffers: TopOfferRow[] = offerRows.slice(0, 10).map((r: { _id: { name?: string }; orders: number; discount: number }) => ({
        name: r._id.name ?? "—", orders: r.orders, discount: r.discount,
    }));

    // Campaign rollup: start with direct offer->campaign attribution.
    const campaignTotals = new Map<string, CampaignRow>();
    for (const r of offerRows as { _id: { campaignId?: unknown }; orders: number; revenue: number; discount: number }[]) {
        if (!r._id.campaignId) continue;
        const id = String(r._id.campaignId);
        const existing = campaignTotals.get(id) ?? { campaignId: id, name: id, orders: 0, revenue: 0, discount: 0 };
        existing.orders += r.orders;
        existing.revenue += r.revenue;
        existing.discount += r.discount;
        campaignTotals.set(id, existing);
    }

    // Add coupon-driven attribution via the bounded Coupon lookup.
    const couponIds = (couponRows as { _id: { id: unknown } }[]).map((r) => r._id.id).filter(Boolean);
    if (couponIds.length > 0) {
        const coupons = await Coupon.find({ _id: { $in: couponIds }, campaignId: { $ne: null } })
            .select("campaignId")
            .lean<{ _id: { toString(): string }; campaignId: { toString(): string } }[]>();
        const couponToCampaign = new Map(coupons.map((c) => [c._id.toString(), c.campaignId.toString()]));

        for (const r of couponRows as { _id: { id: unknown }; orders: number; discount: number }[]) {
            const campaignId = couponToCampaign.get(String(r._id.id));
            if (!campaignId) continue;
            const existing = campaignTotals.get(campaignId) ?? { campaignId, name: campaignId, orders: 0, revenue: 0, discount: 0 };
            existing.orders += r.orders;
            existing.discount += r.discount;
            // Coupon discount rows don't carry order totalAmount in this
            // aggregation (would need a second pass) — revenue attribution
            // here is offer-driven only; coupon-driven campaign revenue is
            // intentionally left at the orders/discount figures already
            // captured so no number is estimated.
            campaignTotals.set(campaignId, existing);
        }
    }

    if (campaignTotals.size > 0) {
        const campaigns = await Campaign.find({ _id: { $in: [...campaignTotals.keys()] } }).select("name").lean<{ _id: { toString(): string }; name: string }[]>();
        for (const c of campaigns) {
            const row = campaignTotals.get(c._id.toString());
            if (row) row.name = c.name;
        }
    }

    const campaignPerformance = [...campaignTotals.values()].sort((a, b) => b.revenue - a.revenue);

    return { topCoupons, topOffers, campaignPerformance };
}

// ── 9. Loyalty ledger analytics ──────────────────────────────────────────
//
// Grouped strictly by LoyaltyLedger.type's REAL enum — never collapsed
// into one ambiguous "points earned" figure, never double-counted (Phase
// 15D audit §26).
export type LoyaltyTypeRow = { type: string; points: number; count: number };

async function getLoyaltyAnalytics(range: { start: Date; end: Date }): Promise<{ byType: LoyaltyTypeRow[]; activeUsers: number }> {
    const [byType, activeUsers] = await Promise.all([
        LoyaltyLedger.aggregate([
            { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
            { $group: { _id: "$type", points: { $sum: "$points" }, count: { $sum: 1 } } },
        ]).exec(),
        LoyaltyLedger.distinct("user", { createdAt: { $gte: range.start, $lt: range.end } }),
    ]);
    return {
        byType: byType.map((r: { _id: string; points: number; count: number }) => ({ type: r._id, points: r.points, count: r.count })),
        activeUsers: activeUsers.length,
    };
}

// ── 10. Digital Spin analytics ───────────────────────────────────────────
export type SpinTypeRow = { rewardType: string; count: number; totalValue: number };

async function getSpinAnalytics(range: { start: Date; end: Date }): Promise<{ totalSpins: number; pointsSpent: number; byRewardType: SpinTypeRow[] }> {
    const rows = await SpinRecord.aggregate([
        { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
        {
            $group: {
                _id: "$rewardType",
                count: { $sum: 1 },
                totalValue: { $sum: { $cond: [{ $eq: ["$rewardType", "LOYALTY_POINTS"] }, "$pointsAwarded", "$rewardValue"] } },
                pointsCost: { $sum: "$pointsCost" },
            },
        },
    ]).exec();

    const totalSpins = rows.reduce((s: number, r: { count: number }) => s + r.count, 0);
    const pointsSpent = rows.reduce((s: number, r: { pointsCost: number }) => s + r.pointsCost, 0);
    const byRewardType = rows.map((r: { _id: string; count: number; totalValue: number }) => ({ rewardType: r._id, count: r.count, totalValue: r.totalValue }));

    return { totalSpins, pointsSpent, byRewardType };
}

// ── 11. Review analytics (no product/order link exists on Review — see
// Phase 15D audit; overall only, never per-product) ─────────────────────
export type ReviewAnalytics = { count: number; averageRating: number | null; distribution: Record<1 | 2 | 3 | 4 | 5, number> };

export async function getReviewAnalytics(range: { start: Date; end: Date }): Promise<ReviewAnalytics> {
    const rows = await Review.aggregate([
        { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]).exec();

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let count = 0;
    let sum = 0;
    for (const r of rows as { _id: number; count: number }[]) {
        if (r._id >= 1 && r._id <= 5) distribution[r._id as 1 | 2 | 3 | 4 | 5] = r.count;
        count += r.count;
        sum += r._id * r.count;
    }
    return { count, averageRating: count > 0 ? sum / count : null, distribution };
}

// ── 12. Delivery / serviceability analytics (historical distanceKm
// snapshot only — never recalculated from current kitchen coordinates) ──
export type DistanceBandRow = { band: string; orders: number };

async function getDeliveryAnalytics(range: { start: Date; end: Date }): Promise<{ averageDistanceKm: number | null; bands: DistanceBandRow[] }> {
    const rows = await Order.aggregate([
        { $match: { ...periodMatch(range), status: { $ne: "cancelled" }, orderType: "delivery", distanceKm: { $ne: null } } },
        {
            $bucket: {
                groupBy: "$distanceKm",
                boundaries: [0, 3, 5, 10, 15, Number.MAX_SAFE_INTEGER],
                default: "15+",
                output: { count: { $sum: 1 } },
            },
        },
    ]).exec();

    const labels: Record<string, string> = { "0": "0–3 km", "3": "3–5 km", "5": "5–10 km", "10": "10–15 km", "15+": "15+ km" };
    const bands = rows.map((r: { _id: string | number; count: number }) => ({ band: labels[String(r._id)] ?? String(r._id), orders: r.count }));

    const avgRows = await Order.aggregate([
        { $match: { ...periodMatch(range), status: { $ne: "cancelled" }, orderType: "delivery", distanceKm: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: "$distanceKm" } } },
    ]).exec();

    return { averageDistanceKm: avgRows[0]?.avg ?? null, bands };
}

// ── Top-level aggregate entry point ──────────────────────────────────────
export type AnalyticsData = {
    range: ResolvedRange;
    current: CoreTotals;
    previous: CoreTotals;
    trend: TrendPoint[];
    customers: CustomerAnalytics;
    products: { topProducts: ProductRow[]; topCategories: CategoryRow[]; itemsSold: number };
    payments: PaymentRow[];
    outcome: OutcomeRow[];
    cancellation: CancellationAnalytics;
    promotions: { topCoupons: TopCouponRow[]; topOffers: TopOfferRow[]; campaignPerformance: CampaignRow[] };
    loyalty: { byType: LoyaltyTypeRow[]; activeUsers: number };
    spin: { totalSpins: number; pointsSpent: number; byRewardType: SpinTypeRow[] };
    reviews: ReviewAnalytics;
    delivery: { averageDistanceKm: number | null; bands: DistanceBandRow[] };
};

export async function getAnalyticsData(range: ResolvedRange): Promise<AnalyticsData> {
    await connectDB();

    const [
        current, previous, trend, customers, products, payments,
        outcome, cancellation, promotions, loyalty, spin, reviews, delivery,
    ] = await Promise.all([
        getCoreTotals(range),
        getCoreTotals({ start: range.prevStart, end: range.prevEnd }),
        getTrend(range),
        getCustomerAnalytics(range),
        getProductAndCategoryAnalytics(range),
        getPaymentAnalytics(range),
        getOrderOutcome(range),
        getCancellationAnalytics(range),
        getPromotionAnalytics(range),
        getLoyaltyAnalytics(range),
        getSpinAnalytics(range),
        getReviewAnalytics(range),
        getDeliveryAnalytics(range),
    ]);

    return { range, current, previous, trend, customers, products, payments, outcome, cancellation, promotions, loyalty, spin, reviews, delivery };
}
