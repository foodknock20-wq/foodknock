export const dynamic = "force-dynamic";

// src/app/api/admin/orders/[id]/cancel/route.ts
//
// POST — admin cancellation. No time window (operational necessity can
// require cancelling an order well past the customer's 30-second grace
// period) but a reason is ALWAYS required — no silent admin cancellation
// (Phase 14 spec §10).
//
// Delegates the entire cancellation to cancelOrder() — see
// src/lib/orderCancellation.ts — identical side effects (stock restore,
// loyalty reversal, refund-status flag, notification) as the customer path.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import { requireAdmin } from "@/lib/apiAuth";
import { isOrderStatus, TERMINAL_STATUSES } from "@/lib/orderStatus";
import { cancelOrder, ADMIN_CANCEL_REASONS, type AdminCancelReason } from "@/lib/orderCancellation";

type RouteContext = { params: Promise<{ id: string }> };

function isAdminCancelReason(value: unknown): value is AdminCancelReason {
    return typeof value === "string" && (ADMIN_CANCEL_REASONS as readonly string[]).includes(value);
}

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const admin = await requireAdmin(req);
        if (!admin) {
            return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
        }

        await connectDB();
        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid order ID" }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const reason = body?.reason;
        const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : "";

        if (!isAdminCancelReason(reason)) {
            return NextResponse.json(
                { success: false, message: "A cancellation reason is required" },
                { status: 400 }
            );
        }

        const order = await Order.findById(id).select("status").lean<{ status: string } | null>();
        if (!order) {
            return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
        }

        if (!isOrderStatus(order.status) || TERMINAL_STATUSES.includes(order.status)) {
            return NextResponse.json(
                { success: false, message: `Order is already "${order.status}" and cannot be cancelled` },
                { status: 409 }
            );
        }

        const result = await cancelOrder({
            orderId: id,
            actor:   { type: "admin", userId: admin.userId },
            reason,
            note,
        });

        return NextResponse.json({ success: true, order: result.order, alreadyCancelled: result.alreadyCancelled });
    } catch (error: any) {
        console.error("ADMIN_CANCEL_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: error?.message || "Failed to cancel order" },
            { status: error?.status || 500 }
        );
    }
}
