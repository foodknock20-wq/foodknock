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
import { requireAdmin, requireUser } from "@/lib/apiAuth";
import { changeOrderStatus, isOrderStatus } from "@/lib/orderStatus";

type RouteContext = { params: Promise<{ id: string }> };

// Maps an order status to the transactional push event fired on transition
// INTO that status. "received" has no push — order.placed is emitted at
// creation time (src/lib/createOrderCore.ts), not on a status PATCH.
const STATUS_TO_EVENT: Partial<Record<string, NotificationEventName>> = {
    preparing:         "order.preparing",
    out_for_delivery:  "order.out_for_delivery",
    delivered:         "order.delivered",
};

// ── PATCH /api/orders/[id] ─────────────────────────────────────────────────
// This is the admin dashboard's live order-status-update endpoint (see
// src/components/admin/orders/OrderTable.tsx's handleStatusChange).
//
// PHASE 3: admin-only, server-verified (previously had no authorization).
//
// PHASE 5: status mutation now goes entirely through changeOrderStatus()
// (src/lib/orderStatus.ts) — the single, atomic, transition-validated
// authority for Order.status. This route no longer reads-then-writes the
// status itself, so it can no longer race a concurrent transition request,
// and it can no longer accept an invalid jump (e.g. "received" straight to
// "delivered"). /api/admin/orders/[id]/status implements the same action
// and has been converged onto the same authority — see that file.
export async function PATCH(req: NextRequest, context: RouteContext) {
    try {
        const admin = await requireAdmin(req);
        if (!admin) {
            return NextResponse.json(
                { success: false, message: "Admin access required" },
                { status: 403 }
            );
        }

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

        if (status !== undefined && !isOrderStatus(status)) {
            return NextResponse.json(
                { success: false, message: `Invalid status "${status}"` },
                { status: 400 }
            );
        }

        // Phase 14: cancellation ALWAYS requires a reason (admin or
        // customer) — never silent. This generic status route is for the
        // forward lifecycle only; route cancellation through the dedicated
        // POST /api/admin/orders/[id]/cancel instead, which enforces that.
        if (status === "cancelled") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Use POST /api/admin/orders/{id}/cancel to cancel an order — a reason is required.",
                },
                { status: 400 }
            );
        }

        let orderDoc: Record<string, unknown> | null;
        let transitionChanged = false;

        if (status !== undefined) {
            const result = await changeOrderStatus(id, status, { changedBy: { type: "admin", userId: admin.userId } });
            orderDoc = result.order;
            transitionChanged = result.changed;
        } else {
            orderDoc = await Order.findById(id).lean();
            if (!orderDoc) {
                return NextResponse.json(
                    { success: false, message: "Order not found" },
                    { status: 404 }
                );
            }
        }

        // `whatsappSent` is an unrelated bookkeeping flag, not a status —
        // applied as its own simple write, same as before.
        if (whatsappSent !== undefined) {
            orderDoc = await Order.findByIdAndUpdate(
                id,
                { $set: { whatsappSent } },
                { new: true, runValidators: true }
            ).lean();
        }

        // ── Transactional push notification ────────────────────────────────
        // Fires only on a genuine status transition (not re-saves of the same
        // status) and only when the order is linked to a user — guest orders
        // have no push subscriptions tied to them and must never be broadcast.
        // Fire-and-forget with error isolation: a push failure must never
        // affect the status update response, same pattern as the loyalty
        // and email hooks below.
        const orderUserId = (orderDoc as { user?: unknown })?.user;
        const pushEvent = status && transitionChanged ? STATUS_TO_EVENT[status] : undefined;

        if (pushEvent && orderUserId) {
            try {
                notificationEngine.emit({
                    name: pushEvent,
                    data: { orderId: (orderDoc as any).orderId },
                    target: { userId: String(orderUserId) },
                });
            } catch (pushErr) {
                console.error(`ORDER_STATUS_PUSH_ERROR (${pushEvent}):`, pushErr);
            }
        }

        // ── Loyalty trigger ────────────────────────────────────────────────
        // Fire only on the exact transition into "delivered" — not on
        // re-saves/idempotent repeats (transitionChanged === false covers
        // that), and not for guest orders. handleOrderDelivered() has its
        // own independent LoyaltyLedger-based idempotency guard regardless
        // (see loyaltyService.ts), so this is defense-in-depth, not the
        // only protection against double-crediting.
        const isTransitionToDelivered =
            status === "delivered" && transitionChanged && !!orderUserId;

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
                const freshUser = await User.findById(orderUserId)
                    .select("email name")
                    .lean() as { email?: string } | null;

                const customerEmail = freshUser?.email;

                if (customerEmail) {
                    const deliveredOrder = orderDoc as { customerName: string; orderId: string };
                    await sendOrderDeliveredEmail(customerEmail, {
                        customerName: deliveredOrder.customerName,
                        orderId:      deliveredOrder.orderId,
                    });
                }
            } catch (err) {
                console.error(`[email] order-delivered email failed for order ${id}:`, err);
            }
        }

        return NextResponse.json({ success: true, order: orderDoc });
    } catch (error: any) {
        console.error("PATCH_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: error?.message || "Failed to update order" },
            { status: error?.status || 500 }
        );
    }
}

// ── GET /api/orders/[id] ───────────────────────────────────────────────────
// PHASE 3: previously had NO authorization — any request that knew (or
// enumerated) a Mongo _id could read another customer's full order PII
// (name, phone, address, items, total). Now requires either the
// authenticated owner of the order or an admin.
export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const session = await requireUser(req);
        if (!session) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

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

        const isOwner = (order as any).user && String((order as any).user) === session.userId;
        if (session.role !== "admin" && !isOwner) {
            // Same 404 as "not found" — don't confirm to an unauthorized
            // caller that this order ID exists at all (see Phase 3 §23).
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