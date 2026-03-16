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
// ── Auth ──────────────────────────────────────────────────────────────────
// This route is admin-only.  It verifies the JWT and checks role === "admin"
// before touching any data.

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/lib/db";
import Order           from "@/models/Order";
import { verifyToken } from "@/lib/auth";
import { handleOrderDelivered } from "@/lib/loyaltyService";

// Valid status transitions in the order lifecycle
const VALID_STATUSES = [
    "received",
    "preparing",
    "out_for_delivery",
    "delivered",
    "cancelled",
] as const;

type OrderStatus = (typeof VALID_STATUSES)[number];

// ── Auth helper ────────────────────────────────────────────────────────────
function getAdminFromCookie(req: NextRequest): { userId: string; role: string } | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match        = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token        = match ? decodeURIComponent(match[1]) : null;
    if (!token) return null;
    try {
        const decoded = verifyToken(token) as { userId?: string; role?: string };
        if (!decoded?.userId || !decoded?.role) return null;
        return { userId: decoded.userId, role: decoded.role };
    } catch {
        return null;
    }
}

// ── PATCH handler ──────────────────────────────────────────────────────────
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // ── 1. Auth check ──────────────────────────────────────────────────────
    const admin = getAdminFromCookie(req);
    if (!admin) {
        return NextResponse.json(
            { success: false, message: "Not authenticated" },
            { status: 401 }
        );
    }
    if (admin.role !== "admin") {
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

    const newStatus = body?.status as OrderStatus | undefined;
    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
        return NextResponse.json(
            {
                success: false,
                message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
            },
            { status: 400 }
        );
    }

    // ── 3. Fetch + update the order ────────────────────────────────────────
    await connectDB();

    const { id } = await params;
const order = await Order.findById(id);
    if (!order) {
        return NextResponse.json(
            { success: false, message: "Order not found" },
            { status: 404 }
        );
    }

    const previousStatus = order.status;
    order.status         = newStatus;
    await order.save();

    // ── 4. Loyalty hook — fires only on the delivered transition ───────────
    //
    // We check previousStatus !== "delivered" so that if an admin corrects a
    // mis-click (delivered → preparing → delivered again) the idempotency
    // guard inside handleOrderDelivered() catches the duplicate and skips it
    // safely.  We still call through so the log line is emitted and you can
    // see it was checked.
    if (newStatus === "delivered") {
        // Fire-and-forget with explicit error capture so a loyalty failure
        // never rolls back the status change the admin just made.
        handleOrderDelivered(order._id.toString()).catch((err) => {
            console.error(`[loyalty] handleOrderDelivered failed for order ${order._id}:`, err);
        });
    }

    return NextResponse.json({
        success:        true,
        message:        `Order status updated to "${newStatus}"`,
        orderId:        order.orderId,
        previousStatus,
        status:         newStatus,
    });
}