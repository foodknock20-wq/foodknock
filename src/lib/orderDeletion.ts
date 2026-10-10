// src/lib/orderDeletion.ts
//
// ── PHASE 15C: THE SINGLE AUTHORITY FOR ORDER DELETION ──────────────────────
//
// Audited references before writing this (see Phase 15C chat report for
// the full trace): `LoyaltyLedger.order` and `CouponRedemption.order` both
// reference `Order._id` with no cascade — hard-deleting an order that
// redeemed loyalty or used a coupon would orphan those rows (dangling
// reference, broken ledger/redemption history). `PendingPayment` does NOT
// reference `Order._id` (it keeps its own decoupled `orderId` string and
// TTL-expires on its own), so it is never a blocker either way.
//
// CONCLUSION: a hard delete is only safe when an order has genuinely ZERO
// external references anywhere — never assumed, always re-verified against
// a fresh read of the order immediately before deleting (never trusts a
// client-asserted "this is safe to delete" flag). Every other order gets
// an additive, non-destructive archive instead: `archivedAt` is set,
// nothing else changes, and the record (and everything that references it)
// remains completely intact.
//
// This file is the ONLY place that decides between the two outcomes and
// the ONLY place that calls `Order.deleteOne()` for an admin-initiated
// delete. The route (`/api/admin/orders/[id]/delete`) just calls this.

import { connectDB } from "@/lib/db";
import Order from "@/models/Order";

export type OrderDeletionDoc = {
    _id: unknown;
    orderId: string;
    status: string;
    paymentMethod: string;
    razorpayPaymentId?: string | null;
    redeemedPoints?: number;
    coupon?: { couponId?: unknown } | null;
    offer?: { offerId?: unknown } | null;
    archivedAt?: Date | null;
};

/**
 * Strict, conservative, server-only precondition check. ALL must hold for
 * a hard delete to even be considered:
 *   - terminal + cancelled (never an active/live order)
 *   - COD (no Razorpay payment reference to lose)
 *   - no loyalty redemption (no LoyaltyLedger row references this order)
 *   - no coupon/offer (no CouponRedemption row references this order)
 * Any one of these failing means some other system still has a record
 * pointing at this order — archive, never delete.
 */
export function canHardDeleteOrder(order: OrderDeletionDoc): boolean {
    return (
        order.status === "cancelled" &&
        order.paymentMethod === "cod" &&
        !order.razorpayPaymentId &&
        (order.redeemedPoints ?? 0) === 0 &&
        !order.coupon?.couponId &&
        !order.offer?.offerId
    );
}

export type DeleteOrderOutcome =
    | { mode: "deleted" }
    | { mode: "archived"; reason: string };

/**
 * The only function that ever calls `Order.deleteOne()` for an
 * admin-initiated delete, or sets `archivedAt` as its safe fallback.
 * Re-reads the order fresh and re-checks `canHardDeleteOrder()` itself —
 * the caller's belief about safety is never trusted.
 */
export async function deleteOrAchiveOrder(orderId: string): Promise<DeleteOrderOutcome> {
    await connectDB();

    const order = await Order.findById(orderId)
        .select("orderId status paymentMethod razorpayPaymentId redeemedPoints coupon offer archivedAt")
        .lean<OrderDeletionDoc | null>();

    if (!order) {
        throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    if (order.status !== "cancelled") {
        // Never allow deleting/archiving an active, live order — matches
        // the explicit "never allow deletion of accidental/active orders"
        // requirement. Admins must cancel first.
        throw Object.assign(
            new Error('Only a cancelled order can be deleted. Cancel it first.'),
            { status: 409 }
        );
    }

    if (canHardDeleteOrder(order)) {
        await Order.deleteOne({ _id: orderId });
        return { mode: "deleted" };
    }

    await Order.updateOne({ _id: orderId }, { $set: { archivedAt: new Date() } });
    const reasons: string[] = [];
    if (order.paymentMethod !== "cod" || order.razorpayPaymentId) reasons.push("has a Razorpay payment reference");
    if ((order.redeemedPoints ?? 0) > 0) reasons.push("redeemed loyalty points");
    if (order.coupon?.couponId || order.offer?.offerId) reasons.push("used a coupon/offer");

    return {
        mode: "archived",
        reason: `Kept for audit integrity (this order ${reasons.join(", ")}) — hidden from the operational list instead of being permanently deleted.`,
    };
}
