export const dynamic = "force-dynamic";

// src/app/admin/orders/page.tsx
//
// Phase 15C — Orders 2.0 list. Replaces the previous architecture (fetch
// up to 1000 orders unfiltered, then filter/analyze/paginate entirely in
// the browser) with the same searchParams-driven, server-side pagination
// pattern Phase 15A already established for Products/Reviews/Users:
// bounded Mongo query, countDocuments for totals, URL-synced filters.
//
// What got REMOVED and why: the previous OrderTable.tsx computed a
// 10-card date-range revenue/analytics dashboard from whatever subset of
// orders happened to be in the capped client-side array. That's not just
// a performance smell — for any date range extending further back than
// the 1000th most recent order, those numbers were silently WRONG
// (undercounted revenue/order-counts), because the "dataset" they
// analyzed was already truncated before the date filter ever ran. Per
// the Phase 15C brief itself ("do not build the full Analytics Center
// inside Orders 2.0"), that dashboard is removed here, not rebuilt
// correctly here — real historical analytics belongs in the dedicated
// Phase 15D Analytics Center, computed via proper date-bounded
// aggregation, not as a byproduct of the orders list.
//
// Needs Attention is unchanged in its CRITERIA (same
// STUCK_ORDER_THRESHOLDS_MS from Phase 14 — never re-invented) but is now
// a real server-side query instead of a client-side scan of whatever
// page happened to be loaded, so it's accurate across the whole
// collection, not just the current page.

import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import OrderTable, { type OrderRow } from "@/components/admin/orders/OrderTable";
import Pagination from "@/components/admin/shared/Pagination";
import AdminListSearchBar from "@/components/admin/shared/AdminListSearchBar";
import OrderFiltersBar, { type OrderFiltersValue } from "@/components/admin/orders/OrderFiltersBar";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import { parseAdminPagination, buildPaginationMeta } from "@/lib/adminPagination";
import { STUCK_ORDER_THRESHOLDS_MS } from "@/lib/constants";
import { ShoppingBag } from "lucide-react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
type Resolved = Awaited<SearchParams>;

const QUICK_STATUSES = ["received", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;
type QuickStatus = (typeof QUICK_STATUSES)[number];

function str(v: string | string[] | undefined): string | undefined {
    return typeof v === "string" && v ? v : undefined;
}

/** The real, reusable "needs attention" condition — same criteria for the
 *  count, the quick-filter, and the query itself: never three competing
 *  definitions of the same thing. */
function attentionOrConditions(now: Date) {
    return [
        ...Object.entries(STUCK_ORDER_THRESHOLDS_MS).map(([status, thresholdMs]) => ({
            status,
            createdAt: { $lt: new Date(now.getTime() - thresholdMs) },
        })),
        { status: "cancelled", "cancellation.refundStatus": "pending_manual" },
    ];
}

function dateRangeFromKey(key: string | undefined, from?: string, to?: string): { $gte?: Date; $lte?: Date } | null {
    if (from || to) {
        const range: { $gte?: Date; $lte?: Date } = {};
        if (from) range.$gte = new Date(`${from}T00:00:00`);
        if (to) range.$lte = new Date(`${to}T23:59:59.999`);
        return range;
    }
    if (!key || key === "all") return null;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (key) {
        case "today":
            return { $gte: startOfToday };
        case "yesterday": {
            const y = new Date(startOfToday.getTime() - 86_400_000);
            return { $gte: y, $lte: new Date(startOfToday.getTime() - 1) };
        }
        case "7d":
            return { $gte: new Date(startOfToday.getTime() - 6 * 86_400_000) };
        case "30d":
            return { $gte: new Date(startOfToday.getTime() - 29 * 86_400_000) };
        default:
            return null;
    }
}

/** Every filter EXCEPT status/cancellation — the shared base every
 *  quick-filter-tab count is computed against, so each tab's badge
 *  reflects "how many under the current search/payment/date/etc" rather
 *  than clobbering itself when combined with a specific status. */
function buildNonStatusFilter(sp: Resolved): Record<string, unknown> {
    const filter: Record<string, unknown> = { archivedAt: null };
    const andParts: Record<string, unknown>[] = [];

    const search = str(sp.search)?.trim();
    if (search) {
        andParts.push({
            $or: [
                { orderId: { $regex: search, $options: "i" } },
                { customerName: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ],
        });
    }

    const payment = str(sp.payment);
    if (payment === "cod" || payment === "razorpay") filter.paymentMethod = payment;

    const refund = str(sp.refund);
    if (refund === "not_applicable" || refund === "pending_manual" || refund === "completed") {
        filter["cancellation.refundStatus"] = refund;
    }

    const promotion = str(sp.promotion);
    if (promotion === "coupon") filter["coupon.couponId"] = { $ne: null };
    else if (promotion === "offer") filter["offer.offerId"] = { $ne: null };
    else if (promotion === "none") {
        andParts.push({ "coupon.couponId": null, "offer.offerId": null });
    }

    const loyalty = str(sp.loyalty);
    if (loyalty === "redeemed") filter.redeemedPoints = { $gt: 0 };
    else if (loyalty === "none") filter.redeemedPoints = 0;

    const dateRange = dateRangeFromKey(str(sp.date), str(sp.dateFrom), str(sp.dateTo));
    if (dateRange) filter.createdAt = dateRange;

    if (andParts.length > 0) filter.$and = andParts;
    return filter;
}

/** Adds status/cancellation + (optionally) the attention $or on top of the
 *  shared non-status base. Every filter here is backed by a real,
 *  existing field — nothing invented. */
function buildFilter(sp: Resolved, now: Date): Record<string, unknown> {
    const filter = buildNonStatusFilter(sp);

    const status = str(sp.status);
    if (status && (QUICK_STATUSES as readonly string[]).includes(status)) {
        filter.status = status;
    }

    const cancellation = str(sp.cancellation);
    if (cancellation === "cancelled") filter.status = "cancelled";
    if (cancellation === "not_cancelled") filter.status = { $ne: "cancelled" };

    if (str(sp.attention) === "1") {
        const andParts = [...((filter.$and as object[]) ?? []), { $or: attentionOrConditions(now) }];
        filter.$and = andParts;
    }

    return filter;
}

function sortSpec(sort: string | undefined): Record<string, 1 | -1> {
    switch (sort) {
        case "oldest": return { createdAt: 1 };
        case "highest": return { totalAmount: -1 };
        case "lowest": return { totalAmount: 1 };
        default: return { createdAt: -1 };
    }
}

async function getOrders(sp: Resolved) {
    await connectDB();
    const now = new Date();

    const { page, limit, skip } = parseAdminPagination(sp, { defaultLimit: 25, maxLimit: 100 });
    const filter = buildFilter(sp, now);
    const baseFilterNoStatus = buildNonStatusFilter(sp);
    const sort = sortSpec(str(sp.sort));

    const [rows, total, statusCounts, attentionCount] = await Promise.all([
        Order.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .select(
                "orderId customerName phone address landmark orderType paymentMethod items totalAmount " +
                "status note whatsappSent createdAt cancellation coupon offer redeemedPoints"
            )
            .maxTimeMS(8000)
            .lean(),
        Order.countDocuments(filter),
        Promise.all(
            QUICK_STATUSES.map((s) => Order.countDocuments({ ...baseFilterNoStatus, status: s }))
        ),
        Order.countDocuments({
            ...baseFilterNoStatus,
            $and: [...((baseFilterNoStatus.$and as object[]) ?? []), { $or: attentionOrConditions(now) }],
        }),
    ]);

    const orders: OrderRow[] = rows.map((o: {
        _id: { toString(): string };
        orderId?: string; customerName?: string; phone?: string; address?: string; landmark?: string;
        orderType?: string; paymentMethod?: string;
        items?: Array<{ productId?: { toString(): string }; name?: string; quantity?: number; price?: number; image?: string }>;
        totalAmount?: number; status?: string; note?: string; whatsappSent?: boolean; createdAt?: Date | string;
        cancellation?: { refundStatus?: "not_applicable" | "pending_manual" | "completed" };
        coupon?: { couponId?: unknown }; offer?: { offerId?: unknown }; redeemedPoints?: number;
    }) => ({
        _id: o._id.toString(),
        orderId: o.orderId ?? o._id.toString(),
        customerName: o.customerName ?? "Unknown",
        phone: o.phone ?? "—",
        address: o.address ?? "",
        landmark: o.landmark ?? "",
        orderType: o.orderType ?? "delivery",
        paymentMethod: o.paymentMethod ?? "cod",
        items: Array.isArray(o.items)
            ? o.items.map((i) => ({
                productId: i.productId?.toString() ?? "",
                name: i.name ?? "Item",
                quantity: i.quantity ?? 1,
                price: i.price ?? 0,
                image: i.image ?? "",
            }))
            : [],
        totalAmount: o.totalAmount ?? 0,
        status: o.status ?? "received",
        note: o.note ?? "",
        whatsappSent: o.whatsappSent ?? false,
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
        cancellationRefundStatus: o.cancellation?.refundStatus ?? "not_applicable",
        hasCoupon: !!o.coupon?.couponId,
        hasOffer: !!o.offer?.offerId,
        hasLoyaltyRedemption: (o.redeemedPoints ?? 0) > 0,
    }));

    const statusCountMap: Record<QuickStatus, number> = QUICK_STATUSES.reduce(
        (acc, s, i) => ({ ...acc, [s]: statusCounts[i] }),
        {} as Record<QuickStatus, number>
    );

    return {
        orders,
        meta: buildPaginationMeta(total, page, limit),
        statusCountMap,
        attentionCount,
    };
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const { orders, meta, statusCountMap, attentionCount } = await getOrders(sp);

    const filtersValue: OrderFiltersValue = {
        search: str(sp.search),
        status: str(sp.status),
        payment: str(sp.payment),
        date: str(sp.date),
        dateFrom: str(sp.dateFrom),
        dateTo: str(sp.dateTo),
        cancellation: str(sp.cancellation),
        refund: str(sp.refund),
        promotion: str(sp.promotion),
        loyalty: str(sp.loyalty),
        attention: str(sp.attention),
        sort: str(sp.sort),
    };

    return (
        <div className="space-y-5">
            <AdminPageHeader
                icon={ShoppingBag}
                title="Orders"
                description={`${meta.total} order${meta.total !== 1 ? "s" : ""} matching current filters`}
            />

            {/* ── Search + filters ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <AdminListSearchBar placeholder="Search order ID, customer, or phone…" />
                <OrderFiltersBar value={filtersValue} />
            </div>

            {/* ── Live order table (quick filters, cards, actions, pagination) ── */}
            <OrderTable
                orders={orders}
                statusCountMap={statusCountMap}
                attentionCount={attentionCount}
                filtersValue={filtersValue}
            />

            <Pagination
                meta={meta}
                basePath="/admin/orders"
                searchParams={{ ...filtersValue }}
                itemLabel="orders"
            />
        </div>
    );
}
