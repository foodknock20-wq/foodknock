// src/lib/orderCancellation.ts
//
// ── PHASE 14: SINGLE AUTHORITY FOR ORDER CANCELLATION ───────────────────────
//
// Used by:
//   • POST /api/orders/[id]/cancel        (customer, 30-second window)
//   • POST /api/admin/orders/[id]/cancel  (admin, no window, reason required)
//
// Both callers delegate the ENTIRE cancellation — status transition, stock
// restoration, loyalty reversal, refund-status flagging, notification — to
// cancelOrder() below. Neither route re-implements any of this itself,
// mirroring the same "one authority" discipline createOrderCore.ts already
// established for order creation and changeOrderStatus() already
// established for status transitions.
//
// ── IDEMPOTENCY ──────────────────────────────────────────────────────────
// cancelOrder() is safe to call more than once for the same order (double
// click, retry after timeout, duplicate request):
//   • The status transition itself is changeOrderStatus()'s existing
//     idempotent no-op (already "cancelled" → changed:false, side effects
//     below are skipped entirely).
//   • Stock restoration is guarded by an atomic claim on
//     cancellation.stockRestoredAt (CAS pattern — same family as
//     createOrderCore's stock decrement and coupons.ts's usage reservation).
//   • Loyalty reversal is guarded the same way via
//     cancellation.loyaltyReversedAt, PLUS a LoyaltyLedger existence check
//     as defense-in-depth (mirrors redeemPoints()'s own guard).
//   • Refund-status flagging and the cancellation notification are
//     idempotent by construction (setting the same value twice / a
//     deterministically-tagged notification are both no-ops on retry).
//
// ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────
//   • Does NOT release coupon/offer usage — CouponRedemption's per-user
//     limit is permanent by design (Phase 11); the order's coupon/offer
//     snapshot remains the accurate historical financial record. Confirmed
//     product decision, see Phase 14 audit §8/§17.
//   • Does NOT call any Razorpay refund API — none exists in this codebase.
//     A captured Razorpay payment is flagged "pending_manual" and must be
//     refunded by hand via the Razorpay dashboard. Never fabricates a
//     "refund processed" state. Confirmed product decision, see audit §5/§17.
//   • Does NOT touch loyalty CREDITS (order_reward/referral) — structurally
//     impossible for a cancelled order to have earned them, since
//     cancellation can only happen from received/preparing/out_for_delivery,
//     never after "delivered" (see orderStatus.ts's TRANSITIONS table).

import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import LoyaltyLedger from "@/models/LoyaltyLedger";
import { changeOrderStatus, type StatusChangeActor } from "@/lib/orderStatus";
import { creditPointsAtomic } from "@/lib/loyaltyService";
import { notificationEngine } from "@/lib/notifications";
import { sendAdminOrderCancelledAlertEmail } from "@/lib/mailer";
import { buildGoogleMapsNavigationUrl } from "@/lib/googleMapsLink";

// ── Reason catalogs ──────────────────────────────────────────────────────
// Deliberately simple (Phase 14 spec §9/§10) — a dropdown, not a form.
// "other" is the only one that accepts a free-text note on either side.
export const CUSTOMER_CANCEL_REASONS = [
    "changed_mind",
    "ordered_by_mistake",
    "payment_issue",
    "delivery_issue",
    "other",
] as const;
export type CustomerCancelReason = (typeof CUSTOMER_CANCEL_REASONS)[number];

export const ADMIN_CANCEL_REASONS = [
    "out_of_stock",
    "kitchen_issue",
    "delivery_issue",
    "customer_request",
    "payment_issue",
    "operational_issue",
    "other",
] as const;
export type AdminCancelReason = (typeof ADMIN_CANCEL_REASONS)[number];

export interface CancelOrderParams {
    /** MongoDB _id of the order */
    orderId: string;
    actor:   StatusChangeActor;
    reason:  string;
    note?:   string;
}

export interface CancelOrderResult {
    order:            Record<string, unknown>;
    /** True when the order was already cancelled before this call — side effects were NOT re-run. */
    alreadyCancelled: boolean;
}

type RestorableItem = { productId: unknown; quantity: number };

/** Atomic claim + restore. Returns false (no-op) if already restored or the claim lost a race. */
async function restoreStock(orderId: string, items: RestorableItem[]): Promise<void> {
    if (items.length === 0) return;

    const claimed = await Order.findOneAndUpdate(
        { _id: orderId, "cancellation.stockRestoredAt": null },
        { $set: { "cancellation.stockRestoredAt": new Date() } }
    );
    if (!claimed) return; // already restored by an earlier attempt — idempotent no-op

    await Promise.all(
        items.map((item) =>
            Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } }).catch((err) =>
                console.error("STOCK_CANCEL_RESTORE_FAILED", { orderId, productId: item.productId, error: err })
            )
        )
    );
}

/** Atomic claim + compensating credit. Returns false (no-op) if already reversed. */
async function reverseLoyaltyRedemption(orderId: string, userId: string, points: number): Promise<void> {
    if (points <= 0) return;

    const claimed = await Order.findOneAndUpdate(
        { _id: orderId, "cancellation.loyaltyReversedAt": null },
        { $set: { "cancellation.loyaltyReversedAt": new Date() } }
    );
    if (!claimed) return; // already reversed by an earlier attempt — idempotent no-op

    // Defense-in-depth, mirrors redeemPoints()'s own ledger-existence guard.
    const already = await LoyaltyLedger.exists({ user: userId, order: orderId, type: "redemption_reversal", status: "completed" });
    if (already) return;

    await creditPointsAtomic({
        userId,
        points,
        type: "redemption_reversal",
        orderMongoId: orderId,
        note: `Reversed ${points} pts — order cancelled`,
    });
}

/** Honest refund-status flag. Never fabricates a completed refund — see file header. */
function resolveRefundStatus(paymentMethod: string, razorpayPaymentId: unknown): "not_applicable" | "pending_manual" {
    return paymentMethod === "razorpay" && razorpayPaymentId ? "pending_manual" : "not_applicable";
}

// ── Admin Telegram alert — customer-initiated cancellations only ──────────
// Mirrors createOrderCore.ts's notifyAdminTelegram() exactly (same env
// vars, same fetch call, same HTML-escaping requirement for Telegram's
// parse_mode:"HTML") — a self-contained sibling for the cancellation event,
// not a shared abstraction, since the two messages have unrelated shapes
// and createOrderCore.ts's existing, working notifyAdminTelegram() is
// deliberately left untouched. Called ONLY from the branch in cancelOrder()
// that runs exactly once per genuine cancellation (transition.changed ===
// true) — never on an idempotent retry, an already-cancelled rejection, or
// a failed/expired request, so duplicate Telegram alerts are impossible
// for the same reason duplicate stock restoration is impossible.
function escapeTelegramHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface CancellationAlertContext {
    orderId:          string;
    customerName:     string;
    totalAmount:      number;
    paymentMethod:    string;
    address:          string;
    landmark:         string;
    orderType:        string;
    deliveryLatitude:  number | null;
    deliveryLongitude: number | null;
    reason:           string;
    note:             string;
    cancelledByType:  string;
    cancelledAt:      Date;
    refundStatus:     "not_applicable" | "pending_manual" | "completed";
}

function notifyAdminTelegramCancelled(ctx: CancellationAlertContext): void {
    (async () => {
        try {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const chatId   = process.env.TELEGRAM_CHAT_ID;
            if (!botToken || !chatId) { console.warn("Telegram env vars missing — cancellation alert skipped"); return; }

            const mapsUrl = ctx.orderType === "delivery"
                ? buildGoogleMapsNavigationUrl(ctx.deliveryLatitude, ctx.deliveryLongitude)
                : null;
            const navLine = mapsUrl
                ? `\n📍 <b>Delivery Address Navigation:</b> <a href="${mapsUrl.replace(/&/g, "&amp;")}">Google Maps</a>`
                : "";

            const refundLine = ctx.refundStatus === "pending_manual"
                ? "\n💳 <b>Refund:</b> PENDING — process manually via Razorpay dashboard"
                : ctx.refundStatus === "completed"
                    ? "\n💳 <b>Refund:</b> Completed"
                    : "\n💳 <b>Refund:</b> Not required (COD)";

            const noteLine = ctx.note ? `\n📝 <b>Note:</b> ${escapeTelegramHtml(ctx.note)}` : "";

            const text = `
🚫 <b>Order Cancelled — FoodKnock</b>

🧾 <b>Order ID:</b> <code>${escapeTelegramHtml(ctx.orderId)}</code>
👤 <b>Customer:</b> ${escapeTelegramHtml(ctx.customerName)}
💰 <b>Amount:</b> ₹${ctx.totalAmount}
${ctx.paymentMethod === "cod" ? "💵" : "💳"} <b>Payment:</b> ${ctx.paymentMethod.toUpperCase()}
📍 <b>Address:</b> ${escapeTelegramHtml(ctx.address || "-")}${ctx.landmark ? ` · ${escapeTelegramHtml(ctx.landmark)}` : ""}${navLine}
❌ <b>Cancelled by:</b> ${escapeTelegramHtml(ctx.cancelledByType)}
🏷️ <b>Reason:</b> ${escapeTelegramHtml(ctx.reason)}${noteLine}
🕐 <b>At:</b> ${ctx.cancelledAt.toLocaleString("en-IN")}${refundLine}
`.trim();

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
            });
        } catch (err) {
            console.error("ORDER_CANCELLED_TELEGRAM_ERROR", err);
        }
    })();
}

/** Mirrors the Telegram alert's data, routed to the existing admin-email infrastructure (sendAdminOrderCancelledAlertEmail / mailer.ts) instead. Same call-site discipline — fire-and-forget, cancelOrder()'s one-time-per-genuine-transition branch only. */
function notifyAdminEmailCancelled(ctx: CancellationAlertContext): void {
    const mapsUrl = ctx.orderType === "delivery"
        ? buildGoogleMapsNavigationUrl(ctx.deliveryLatitude, ctx.deliveryLongitude)
        : null;

    sendAdminOrderCancelledAlertEmail({
        orderId:       ctx.orderId,
        customerName:  ctx.customerName,
        totalAmount:   ctx.totalAmount,
        paymentMethod: ctx.paymentMethod,
        address:       ctx.address,
        landmark:      ctx.landmark,
        orderType:     ctx.orderType,
        reason:        ctx.reason,
        note:          ctx.note,
        cancelledByType: ctx.cancelledByType,
        cancelledAt:   ctx.cancelledAt,
        refundStatus:  ctx.refundStatus,
        mapsUrl,
    }).catch((err) => console.error("ORDER_CANCELLED_EMAIL_ERROR", err));
}

export async function cancelOrder(params: CancelOrderParams): Promise<CancelOrderResult> {
    await connectDB();

    const orderBefore = await Order.findById(params.orderId)
        .select(
            "orderId items redeemedPoints user paymentMethod razorpayPaymentId customerName " +
            "totalAmount address landmark orderType deliveryLatitude deliveryLongitude"
        )
        .lean<{
            _id: unknown;
            orderId: string;
            items: Array<{ productId?: unknown; quantity: number }>;
            redeemedPoints?: number;
            user?: unknown;
            paymentMethod: string;
            razorpayPaymentId?: string;
            customerName: string;
            totalAmount: number;
            address: string;
            landmark?: string;
            orderType: string;
            deliveryLatitude?: number | null;
            deliveryLongitude?: number | null;
        } | null>();

    if (!orderBefore) {
        throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    const transition = await changeOrderStatus(params.orderId, "cancelled", {
        changedBy: params.actor,
        reason:    params.reason,
        note:      params.note,
    });

    if (!transition.changed) {
        // Idempotent retry (already cancelled) OR a genuinely invalid
        // transition would have thrown above — this branch only runs for
        // "already in the target state", so side effects already ran the
        // first time and must not be repeated.
        return { order: transition.order, alreadyCancelled: true };
    }

    const restorableItems: RestorableItem[] = (orderBefore.items ?? [])
        .filter((i) => i.productId)
        .map((i) => ({ productId: i.productId, quantity: i.quantity }));

    await restoreStock(params.orderId, restorableItems);

    const redeemedPoints = Number(orderBefore.redeemedPoints) || 0;
    const userId = orderBefore.user ? String(orderBefore.user) : null;

    if (userId && redeemedPoints > 0) {
        await reverseLoyaltyRedemption(params.orderId, userId, redeemedPoints);
    }

    const refundStatus = resolveRefundStatus(orderBefore.paymentMethod, orderBefore.razorpayPaymentId);
    await Order.updateOne(
        { _id: params.orderId },
        { $set: { "cancellation.refundStatus": refundStatus } }
    ).catch((err) => console.error("CANCEL_REFUND_FLAG_FAILED", { orderId: params.orderId, error: err }));

    // ── Admin Telegram + Email — CUSTOMER-initiated cancellations only ────
    // An admin who just cancelled an order themselves doesn't need to be
    // alerted about their own action — this mirrors the spec's explicit
    // "customer cancels → admin is notified" direction. Reached ONLY from
    // this one-time-per-genuine-transition branch (never on the
    // `!transition.changed` early return above), so a retried/duplicate/
    // expired/rejected request can never trigger a second alert — same
    // idempotency guarantee as the stock/loyalty side effects above.
    if (params.actor.type === "customer") {
        const cancelledAt = (transition.order as { cancellation?: { cancelledAt?: Date } })?.cancellation?.cancelledAt
            ?? new Date();
        const alertCtx = {
            orderId:           orderBefore.orderId,
            customerName:      orderBefore.customerName,
            totalAmount:       orderBefore.totalAmount,
            paymentMethod:     orderBefore.paymentMethod,
            address:           orderBefore.address,
            landmark:          orderBefore.landmark ?? "",
            orderType:         orderBefore.orderType,
            deliveryLatitude:  orderBefore.deliveryLatitude ?? null,
            deliveryLongitude: orderBefore.deliveryLongitude ?? null,
            reason:            params.reason,
            note:              params.note ?? "",
            cancelledByType:   params.actor.type,
            cancelledAt:       new Date(cancelledAt),
            refundStatus,
        };
        notifyAdminTelegramCancelled(alertCtx);
        notifyAdminEmailCancelled(alertCtx);
    }

    // Transactional push — guest (no user) orders have no subscriptions to
    // target and must never be broadcast, same rule as every other
    // order-lifecycle event in createOrderCore.ts / orders/[id]/route.ts.
    if (userId) {
        try {
            notificationEngine.emit({
                name:   "order.cancelled",
                data:   { orderId: orderBefore.orderId, reason: params.reason },
                target: { userId },
            });
        } catch (err) {
            console.error("ORDER_CANCELLED_NOTIFY_ERROR", err);
        }
    }

    const finalOrder = await Order.findById(params.orderId).lean();
    return { order: finalOrder as Record<string, unknown>, alreadyCancelled: false };
}
