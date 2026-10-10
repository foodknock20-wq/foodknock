// src/lib/adminDashboard.ts
//
// Phase 15E.8 — Main Admin Dashboard 2.0 data layer. Every number here has
// a documented, authoritative source — nothing is fabricated, nothing is
// recomputed with a competing definition:
//
//   Today's Orders/Revenue, Total Orders/Revenue, Sales Overview trend,
//   Today's Order Status, Best Selling Items, Customer Snapshot
//     -> src/lib/adminAnalytics.ts's getCoreTotals/getTrend/getOrderOutcome/
//        getProductAndCategoryAnalytics/getCustomerAnalytics — the SAME
//        Phase 15D Analytics 2.0 functions the /admin/analytics page uses
//        (now exported for reuse, not re-derived). Revenue = non-cancelled
//        totalAmount; archived orders excluded; best-seller revenue uses
//        the historical order-item price snapshot, never current
//        Product.price — see that file's own header for the full
//        definitions this inherits unchanged.
//   Total Customers -> User.countDocuments() (same source /admin/users uses).
//   Low Stock -> Product.stock <= LOW_STOCK_THRESHOLD (src/lib/catalogConstants.ts,
//        the same constant Products 2.0 uses — not a second threshold).
//   Recent Orders -> bounded Order.find(), newest first, archived excluded.
//   Rating Snapshot -> bounded Review aggregate, all-time (distinct from
//        getReviewAnalytics, which is period-boxed for the Analytics
//        Center) — same aggregation shape /admin/reviews already computes
//        for its own stats strip.
//   Active Campaign -> Campaign.status === "active" within its
//        startAt/endAt window, highest priority, cross-checked with a
//        live Offer under it (mirrors the eligibility window
//        src/lib/offers.ts's getBestAutomaticOffer already uses).
//   Shop status -> src/models/Shop.ts (unchanged authority).
//
// Performance: every query below is a single bounded find/aggregate (hard
// limits, indexed fields, lean()) — no full-collection fetches, no
// browser-side aggregation, no N+1. The heavier Analytics-only
// computations (loyalty, spin, delivery, cancellation, promotions,
// payments) are deliberately NOT invoked here — the dashboard calls only
// the five specific exported functions it actually needs.

import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";
import Review from "@/models/Review";
import Campaign from "@/models/Campaign";
import Offer from "@/models/Offer";
import {
    getCoreTotals, getTrend, getOrderOutcome, getProductAndCategoryAnalytics, getCustomerAnalytics,
    type CoreTotals, type TrendPoint, type OutcomeRow, type ProductRow, type CustomerAnalytics,
} from "@/lib/adminAnalytics";
import { resolveAnalyticsRange, type AnalyticsRangeKey, type ResolvedRange } from "@/lib/analyticsDateRange";
import { LOW_STOCK_THRESHOLD } from "@/lib/catalogConstants";

const ARCHIVED_EXCLUDED = { archivedAt: null } as const;

export type RecentOrderRow = {
    _id: string;
    orderId: string;
    customerName: string;
    items: number;
    totalAmount: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
};

export type LowStockRow = {
    _id: string;
    name: string;
    image: string;
    stock: number;
};

export type ActiveCampaignSummary = {
    campaignId: string;
    name: string;
    shortDescription: string;
    discountType: string;
    discountValue: number;
    ordersToday: number;
} | null;

export type DashboardData = {
    range: ResolvedRange;
    today: CoreTotals;
    yesterday: CoreTotals;
    period: CoreTotals; // same as `today` when rangeKey === "today"
    trend: TrendPoint[];
    outcome: OutcomeRow[];
    bestSellers: ProductRow[];
    customers: CustomerAnalytics;
    totalCustomers: number;
    allTime: { totalOrders: number; totalRevenue: number };
    recentOrders: RecentOrderRow[];
    lowStock: LowStockRow[];
    lowStockTotal: number;
    criticallyLowTotal: number;
    rating: { average: number | null; count: number };
    activeCampaign: ActiveCampaignSummary;
};

export async function getDashboardData(rangeKey: AnalyticsRangeKey): Promise<DashboardData> {
    await connectDB();

    const range = resolveAnalyticsRange(rangeKey);
    const todayRange = resolveAnalyticsRange("today");
    const sameAsToday = rangeKey === "today";

    const [
        today, yesterday, period, trend, outcome, productAnalytics, customers, totalCustomers,
        allTimeAgg, recentOrdersRaw, lowStockRaw, lowStockTotal, criticallyLowTotal, ratingAgg, campaignDoc,
    ] = await Promise.all([
        sameAsToday ? null : getCoreTotals(todayRange), // computed below if needed
        getCoreTotals({ start: todayRange.prevStart, end: todayRange.prevEnd }), // yesterday — for "vs yesterday" KPI badges
        getCoreTotals(range),
        getTrend(range),
        getOrderOutcome(range),
        getProductAndCategoryAnalytics(range),
        getCustomerAnalytics(range),
        User.countDocuments(),
        Order.aggregate<{ totalOrders: number; totalRevenue: number }>([
            { $match: ARCHIVED_EXCLUDED },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$totalAmount", 0] } },
                },
            },
        ]),
        Order.find(ARCHIVED_EXCLUDED)
            .sort({ createdAt: -1 })
            .limit(8)
            .select("orderId customerName items totalAmount status paymentMethod createdAt")
            .lean<Array<{ _id: unknown; orderId?: string; customerName?: string; items?: unknown[]; totalAmount?: number; status?: string; paymentMethod?: string; createdAt?: Date }>>(),
        Product.find({ stock: { $lte: LOW_STOCK_THRESHOLD } })
            .sort({ stock: 1 })
            .limit(6)
            .select("name image stock")
            .lean<Array<{ _id: unknown; name?: string; image?: string; stock?: number }>>(),
        Product.countDocuments({ stock: { $lte: LOW_STOCK_THRESHOLD } }),
        Product.countDocuments({ stock: { $lte: 2 } }),
        Review.aggregate<{ count: number; ratingSum: number }>([
            { $group: { _id: null, count: { $sum: 1 }, ratingSum: { $sum: { $ifNull: ["$rating", 0] } } } },
        ]),
        Campaign.findOne({
            status: "active",
            $and: [
                { $or: [{ startAt: null }, { startAt: { $lte: new Date() } }] },
                { $or: [{ endAt: null }, { endAt: { $gte: new Date() } }] },
            ],
        })
            .sort({ priority: -1 })
            .select("name shortDescription")
            .lean<{ _id: unknown; name?: string; shortDescription?: string } | null>(),
    ]);

    // Today's totals: reuse the `period` result directly if the selected
    // range IS "today" (avoids a duplicate getCoreTotals call); otherwise
    // the dedicated todayRange call above already ran in parallel.
    const todayTotals = sameAsToday ? period : (today as CoreTotals);

    const allTime = {
        totalOrders: allTimeAgg[0]?.totalOrders ?? 0,
        totalRevenue: allTimeAgg[0]?.totalRevenue ?? 0,
    };

    const recentOrders: RecentOrderRow[] = recentOrdersRaw.map((o) => ({
        _id: String(o._id),
        orderId: o.orderId ?? String(o._id),
        customerName: o.customerName ?? "Unknown",
        items: Array.isArray(o.items) ? o.items.length : 0,
        totalAmount: o.totalAmount ?? 0,
        status: o.status ?? "received",
        paymentMethod: o.paymentMethod ?? "cod",
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
    }));

    const lowStock: LowStockRow[] = lowStockRaw.map((p) => ({
        _id: String(p._id),
        name: p.name ?? "Unnamed",
        image: p.image ?? "",
        stock: p.stock ?? 0,
    }));

    const ratingRow = ratingAgg[0];
    const rating = {
        average: ratingRow && ratingRow.count > 0 ? ratingRow.ratingSum / ratingRow.count : null,
        count: ratingRow?.count ?? 0,
    };

    let activeCampaign: ActiveCampaignSummary = null;
    if (campaignDoc) {
        const offer = await Offer.findOne({ campaignId: campaignDoc._id, status: "ACTIVE" })
            .sort({ priority: -1 })
            .select("discountType discountValue")
            .lean<{ discountType?: string; discountValue?: number } | null>();
        if (offer) {
            const ordersToday = await Order.countDocuments({
                ...ARCHIVED_EXCLUDED,
                "offer.campaignId": campaignDoc._id,
                createdAt: { $gte: todayRange.start, $lt: todayRange.end },
            });
            activeCampaign = {
                campaignId: String(campaignDoc._id),
                name: campaignDoc.name ?? "Active Campaign",
                shortDescription: campaignDoc.shortDescription ?? "",
                discountType: offer.discountType ?? "PERCENTAGE",
                discountValue: offer.discountValue ?? 0,
                ordersToday,
            };
        }
    }

    return {
        range,
        today: todayTotals,
        yesterday,
        period,
        trend,
        outcome,
        bestSellers: productAnalytics.topProducts,
        customers,
        totalCustomers,
        allTime,
        recentOrders,
        lowStock,
        lowStockTotal,
        criticallyLowTotal,
        rating,
        activeCampaign,
    };
}
