export const dynamic = "force-dynamic";

// src/app/api/orders/my/[orderId]/route.ts
//
// Reorder/Rate-Your-Order security audit — the customer-facing Order
// Detail page (/my-orders/[orderId]) was fetching its data from
// GET /api/orders/track/[orderId], which is an INTENTIONALLY public,
// unauthenticated "guest order tracking" endpoint (see that file's own
// header comment) — it never checks that the order belongs to the caller.
// Any logged-in customer who knew/guessed another customer's human-readable
// orderId could view that order's PII there, and (now that Reorder/Rate
// Your Order live on that page) could have reordered from or implicitly
// interacted with someone else's order.
//
// This route is the authenticated, ownership-checked replacement for that
// one call site — same ownership pattern already used by
// GET /api/orders/[id] (ownership-checked by Mongo _id), just keyed by the
// human-readable orderId the customer-facing page actually has. Guest
// tracking at /track-order continues to use the original public route
// unchanged — this is additive, not a replacement of that intentional
// public behavior.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import { requireUser } from "@/lib/apiAuth";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const session = await requireUser(req);
        if (!session) {
            return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
        }

        await connectDB();
        const { orderId: rawOrderId } = await context.params;
        const orderId = decodeURIComponent(rawOrderId).replace(/^#/, "").trim();
        if (!orderId) {
            return NextResponse.json({ success: false, message: "Order ID is required" }, { status: 400 });
        }

        // Orders 2.0 — order-detail price breakdown needs the REAL snapshot
        // fields already stored on every order (deliveryFee/platformFee/
        // redeemedPoints/redeemedAmount/coupon/offer/isFirstDeliveryFreeApplied)
        // so the UI only ever renders rows that genuinely apply, never
        // fabricated/estimated ones. All additive/optional on the schema —
        // older orders without them simply read as 0/null.
        const order = await Order.findOne({ orderId })
            .select(
                "_id orderId user customerName phone address landmark orderType items totalAmount status note createdAt paymentMethod cancellation deliveryFee platformFee redeemedPoints redeemedAmount coupon offer isFirstDeliveryFreeApplied"
            )
            .lean();

        if (!order) {
            return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
        }

        const orderRecord = order as Record<string, unknown>;
        const isOwner = orderRecord.user && String(orderRecord.user) === session.userId;
        if (session.role !== "admin" && !isOwner) {
            // Same 404-not-403 pattern as GET /api/orders/[id] — never confirm
            // to an unauthorized caller that this orderId exists at all.
            return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
        }

        delete orderRecord.user;
        return NextResponse.json({ success: true, order: orderRecord });
    } catch (error) {
        console.error("GET_MY_ORDER_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to fetch order" }, { status: 500 });
    }
}
