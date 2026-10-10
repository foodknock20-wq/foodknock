export const dynamic = "force-dynamic";

// src/app/api/admin/orders/[id]/status/route.ts
//
// PATCH /api/admin/orders/:id/status
//
// Updates an order's status.  When the new status is "delivered" this route
// calls handleOrderDelivered() which:
//   • awards order_reward points to the customer
//   • on the customer's very first delivered order, also fires the referral
//     bonuses (referral_referee to the customer, referral_referrer to the
//     person who referred them)
//
// All loyalty writes are idempotent — clicking "Mark Delivered" a second
// time is completely safe and simply logs a skip message.
//
// Order-delivered email (fire-and-forget at the route boundary) is fully
// awaited internally inside its own try/catch.
//
// ── Auth ──────────────────────────────────────────────────────────────────
// This route is admin-only.  It verifies the JWT and checks role === "admin"
// before touching any data.
//
// PHASE 5: confirmed unused by the frontend (the admin dashboard's
// OrderTable.tsx calls PATCH /api/orders/[id] instead — see that route) but
// still a reachable, correctly-admin-gated endpoint performing the exact
// same action. Previously had its own independent status whitelist and its
// own read-then-write transition logic — now converged onto the same
// changeOrderStatus() authority as /api/orders/[id], so there is exactly
// one place that decides whether a transition is valid and exactly one
// atomic write path, instead of two implementations that could silently
// drift apart.

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/lib/db";
import User            from "@/models/User";
import { requireAdmin } from "@/lib/apiAuth";
import { handleOrderDelivered } from "@/lib/loyaltyService";
import { sendOrderDeliveredEmail } from "@/lib/mailer";
import { notificationEngine } from "@/lib/notifications";
import { changeOrderStatus, isOrderStatus } from "@/lib/orderStatus";

// Phase 17.2: previously a hand-rolled getAdminFromCookie() (JWT-claim-only,
// no live isActive re-check) — now uses the centralized, DB-verified
// requireAdmin(). This route remains CONFIRMED DEAD per the file header
// above (OrderTable.tsx calls PATCH /api/orders/[id] instead) — not
// removed in this pass since compatibility with any undiscovered external
// caller can't be fully ruled out; see the Phase 17.2 report for the
// recommended deprecation plan.

// ── PATCH handler ──────────────────────────────────────────────────────────
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // ── 1. Auth check ──────────────────────────────────────────────────────
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json(
            { success: false, message: "Admin access required" },
            { status: 403 }
        );
    }

    // ── 2. Parse + validate body ───────────────────────────────────────────
    let body: { status?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const newStatus = body?.status;
    if (!newStatus || !isOrderStatus(newStatus)) {
        return NextResponse.json(
            { success: false, message: "status must be a valid order status" },
            { status: 400 }
        );
    }

    // Phase 14: cancellation always requires a reason — route through the
    // dedicated cancel endpoint instead (same rule as /api/orders/[id]).
    if (newStatus === "cancelled") {
        return NextResponse.json(
            {
                success: false,
                message: "Use POST /api/admin/orders/{id}/cancel to cancel an order — a reason is required.",
            },
            { status: 400 }
        );
    }

    // ── 3. Centralized, atomic status transition (Phase 5) ─────────────────
    // changeOrderStatus() validates the transition, writes it atomically,
    // and reports whether this was a genuine change or an idempotent no-op
    // (order already in that status) — see src/lib/orderStatus.ts.
    await connectDB();

    const { id } = await params;
    let transition;
    try {
        transition = await changeOrderStatus(id, newStatus, { changedBy: { type: "admin", userId: admin.userId } });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, message: err?.message || "Failed to update order status" },
            { status: err?.status || 500 }
        );
    }

    const order = transition.order as {
        _id: unknown; orderId: string; customerName: string; user?: unknown;
    };

    // ── 4. Loyalty hook — fires only on a genuine transition into "delivered" ─
    // `transition.changed` is false for an idempotent repeat (order was
    // already "delivered") — handleOrderDelivered() also has its own
    // independent LoyaltyLedger-based guard (see loyaltyService.ts), so
    // this is defense-in-depth, not the only protection.
    if (newStatus === "delivered" && transition.changed) {
        // Fire-and-forget with explicit error capture so a loyalty failure
        // never rolls back the status change the admin just made.
        handleOrderDelivered(String(order._id)).catch((err) => {
            console.error(`[loyalty] handleOrderDelivered failed for order ${order._id}:`, err);
        });

        if (order.user) {
            try {
                const freshUser = await User.findById(order.user).select("email name").lean() as { email?: string } | null;
                const customerEmail = freshUser?.email;
                if (customerEmail) {
                    await sendOrderDeliveredEmail(customerEmail, {
                        customerName: order.customerName,
                        orderId:      order.orderId,
                    });
                }
            } catch (err) {
                console.error(`[email] order-delivered email failed for order ${order._id}:`, err);
            }

            // ── Push + WhatsApp via the existing Notification Engine ──────
            // One emit() call. Push and WhatsApp both fire from it because
            // notifications/engine.ts's own EVENT_DEFAULT_CHANNELS already
            // maps "order.delivered" to ["push", "whatsapp"].
            try {
                notificationEngine.emit({
                    name: "order.delivered",
                    data: { orderId: order.orderId, customerName: order.customerName },
                    target: { userId: String(order.user) },
                });
            } catch (err) {
                console.error(`[notify] order.delivered emit failed for order ${order._id}:`, err);
            }
        }
    }

    return NextResponse.json({
        success:        true,
        message:        `Order status updated to "${newStatus}"`,
        orderId:        order.orderId,
        previousStatus: transition.previousStatus,
        status:         newStatus,
    });
}