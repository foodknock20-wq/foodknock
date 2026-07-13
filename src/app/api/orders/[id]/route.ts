export const dynamic = "force-dynamic";

// src/app/api/orders/[id]/route.ts
// PATCH — updates order status (and triggers loyalty when status → "delivered")
// GET   — returns a single order by MongoDB _id
//
// PERF PASS (Orders/Loyalty audit):
//   Removed the `[DEBUG order-delivered-N]` console.log lines. Each one
//   called JSON.stringify() on request/order data and ran UNCONDITIONALLY
//   on every single PATCH request to this route (not just delivered
//   transitions) — this is the admin order-status-update endpoint, one of
//   the highest-frequency admin actions in the app. JSON.stringify on
//   arbitrary objects is real CPU work, and every log line also adds to
//   Vercel's log ingestion volume/cost. Removing them changes no business
//   logic, no response shape, and no error visibility — all genuine error
//   paths still use console.error exactly as before.
//   Expected CPU: removes several JSON.stringify + log-write calls per
//   PATCH request (7-8 debug lines were present in the delivered-transition
//   branch alone).
//   Expected Vercel: lower log ingestion volume on the hottest admin route.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB }            from "@/lib/db";
import Order                    from "@/models/Order";
import User                     from "@/models/User";
import { handleOrderDelivered } from "@/lib/loyaltyService";
import { sendOrderDeliveredEmail } from "@/lib/mailer";
import { notificationEngine, type NotificationEventName } from "@/lib/notifications";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["received", "preparing", "out_for_delivery", "delivered"] as const;

// Maps an order status to the transactional push event fired on transition
// INTO that status. "received" has no push — order.placed is emitted at
// creation time (src/lib/createOrderCore.ts), not on a status PATCH.
const STATUS_TO_EVENT: Partial<Record<string, NotificationEventName>> = {
    preparing:         "order.preparing",
    out_for_delivery:  "order.out_for_delivery",
    delivered:         "order.delivered",
};

// ── PATCH /api/orders/[id] ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest, context: RouteContext) {
    try {
        await connectDB();
        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid order ID" },
                { status: 400 }
            );
        }

        const body = await req.json();
        const { status, whatsappSent } = body;

        if (status && !VALID_STATUSES.includes(status)) {
            return NextResponse.json(
                { success: false, message: `Invalid status "${status}"` },
                { status: 400 }
            );
        }

        // Fetch existing order so we can detect the status transition
        const existingOrder = await Order.findById(id).select("status user").lean();
        if (!existingOrder) {
            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }

        const prevStatus = (existingOrder as any).status as string;

        const updatePayload: Record<string, unknown> = {};
        if (status !== undefined)       updatePayload.status       = status;
        if (whatsappSent !== undefined) updatePayload.whatsappSent = whatsappSent;

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            { $set: updatePayload },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedOrder) {
            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }

        // ── Transactional push notification ────────────────────────────────
        // Fires only on a genuine status transition (not re-saves of the same
        // status) and only when the order is linked to a user — guest orders
        // have no push subscriptions tied to them and must never be broadcast.
        // Fire-and-forget with error isolation: a push failure must never
        // affect the status update response, same pattern as the loyalty
        // and email hooks below.
        const orderUserId = (existingOrder as { user?: unknown }).user;
        const pushEvent = status ? STATUS_TO_EVENT[status] : undefined;

        if (pushEvent && status !== prevStatus && orderUserId) {
            try {
                notificationEngine.emit({
                    name: pushEvent,
                    data: { orderId: (updatedOrder as any).orderId },
                    target: { userId: String(orderUserId) },
                });
            } catch (pushErr) {
                console.error(`ORDER_STATUS_PUSH_ERROR (${pushEvent}):`, pushErr);
            }
        }

        // ── Loyalty trigger ────────────────────────────────────────────────
        // Fire only on the exact transition into "delivered" — not on re-saves,
        // and not if the order was already delivered before this PATCH.
        const isTransitionToDelivered =
            status === "delivered" &&
            prevStatus !== "delivered" &&
            !!(existingOrder as any).user;   // guest orders have no user

        if (isTransitionToDelivered) {
            // Intentionally fire-and-forget with error isolation:
            // a loyalty failure must NEVER roll back the status update.
            handleOrderDelivered(id).catch((loyaltyErr) => {
                console.error(
                    `[loyalty] handleOrderDelivered failed for order ${id}:`,
                    loyaltyErr
                );
            });

            // Order-delivered email — fully awaited so it cannot be cut off
            // by the function returning before a detached promise resolves.
            try {
                const orderUserId = (existingOrder as { user?: unknown }).user;

                const freshUser = await User.findById(orderUserId)
                    .select("email name")
                    .lean() as { email?: string } | null;

                const customerEmail = freshUser?.email;

                if (customerEmail) {
                    const deliveredOrder = updatedOrder as { customerName: string; orderId: string };
                    await sendOrderDeliveredEmail(customerEmail, {
                        customerName: deliveredOrder.customerName,
                        orderId:      deliveredOrder.orderId,
                    });
                }
            } catch (err) {
                console.error(`[email] order-delivered email failed for order ${id}:`, err);
            }
        }

        return NextResponse.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error("PATCH_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to update order" },
            { status: 500 }
        );
    }
}

// ── GET /api/orders/[id] ───────────────────────────────────────────────────
export async function GET(_req: NextRequest, context: RouteContext) {
    try {
        await connectDB();
        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid order ID" },
                { status: 400 }
            );
        }

        const order = await Order.findById(id).lean();
        if (!order) {
            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, order });
    } catch (error) {
        console.error("GET_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch order" },
            { status: 500 }
        );
    }
}