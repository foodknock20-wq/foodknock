export const dynamic = "force-dynamic";

// src/app/api/orders/[id]/cancel/route.ts
//
// POST — customer self-service cancellation.
//
// PHASE 14: server-authoritative. The client-rendered countdown is UI only
// — this route independently recomputes eligibility from Order.createdAt
// and CUSTOMER_CANCEL_WINDOW_MS. A stale/manipulated client request past
// the window (or for a non-owned/non-cancellable order) is rejected here
// regardless of what the UI displayed.
//
// Delegates the entire cancellation (status transition, stock restore,
// loyalty reversal, refund-status flag, notification) to cancelOrder() —
// see src/lib/orderCancellation.ts. This route's only job is auth +
// ownership + window + reason validation.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import { requireUser } from "@/lib/apiAuth";
import { isOrderStatus, TERMINAL_STATUSES } from "@/lib/orderStatus";
import { cancelOrder, CUSTOMER_CANCEL_REASONS, type CustomerCancelReason } from "@/lib/orderCancellation";
import { CUSTOMER_CANCEL_WINDOW_MS } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

function isCustomerCancelReason(value: unknown): value is CustomerCancelReason {
    return typeof value === "string" && (CUSTOMER_CANCEL_REASONS as readonly string[]).includes(value);
}

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const user = await requireUser(req);
        if (!user) {
            return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
        }

        await connectDB();
        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid order ID" }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const reason = body?.reason;
        const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : "";

        if (!isCustomerCancelReason(reason)) {
            return NextResponse.json(
                { success: false, message: "A valid cancellation reason is required" },
                { status: 400 }
            );
        }

        const order = await Order.findById(id)
            .select("user status createdAt")
            .lean<{ _id: unknown; user?: unknown; status: string; createdAt: Date } | null>();

        if (!order) {
            return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
        }

        const isOwner = order.user && String(order.user) === user.userId;
        if (!isOwner) {
            // Same 404-as-not-found convention as GET /api/orders/[id] (Phase 3)
            // — don't confirm to a non-owner that this order exists at all.
            return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
        }

        if (!isOrderStatus(order.status) || TERMINAL_STATUSES.includes(order.status)) {
            return NextResponse.json(
                { success: false, message: `Order is already "${order.status}" and cannot be cancelled` },
                { status: 409 }
            );
        }

        // ── Server-authoritative window check ──────────────────────────────
        const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
        if (elapsedMs > CUSTOMER_CANCEL_WINDOW_MS) {
            return NextResponse.json(
                {
                    success: false,
                    message: "The 30-second cancellation window for this order has passed. Please contact support.",
                },
                { status: 409 }
            );
        }

        const result = await cancelOrder({
            orderId: id,
            actor:   { type: "customer", userId: user.userId },
            reason,
            note,
        });

        return NextResponse.json({ success: true, order: result.order, alreadyCancelled: result.alreadyCancelled });
    } catch (error: any) {
        console.error("CANCEL_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: error?.message || "Failed to cancel order" },
            { status: error?.status || 500 }
        );
    }
}
