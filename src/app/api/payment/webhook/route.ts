export const dynamic = "force-dynamic";

// src/app/api/payment/webhook/route.ts
//
// PAYMENT RELIABILITY (Phase 1A):
// Previously a stub — verified the signature and deduped by razorpayPaymentId
// but never actually created an order on `payment.captured`. This meant a
// payment captured without a completing client /verify call (browser closed,
// network dropped, etc.) left Razorpay holding money with no FoodKnock order.
//
// Now: on payment.captured, this route recovers the order using the
// PendingPayment context persisted by /api/payment/create-order (Step 1) —
// NEVER by trusting/guessing data from the webhook payload itself. If no
// PendingPayment exists, there is nothing safe to reconstruct from, so we
// log loudly for manual reconciliation and acknowledge the webhook (retrying
// won't produce the missing context).
//
// Concurrency: uses the same atomic claim as /api/payment/verify (see
// src/lib/paymentReconciliation.ts) so the client path and this webhook path
// converge on exactly one order no matter which one runs first, both, or
// neither (if the other already succeeded).
//
// Retry semantics: Razorpay retries webhooks on non-2xx responses for a
// bounded window. We lean on that deliberately:
//   • transient failure (DB hiccup, stock race) during order creation → 500
//     so Razorpay retries automatically
//   • permanent problem (missing context, amount mismatch, bad signature)
//     → 200 so Razorpay stops retrying a request that will never succeed

import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import PendingPayment from "@/models/PendingPayment";
import {
    claimPendingPayment,
    createOrderFromPendingPayment,
    amountMatches,
    type PendingPaymentDoc,
} from "@/lib/paymentReconciliation";
import { handleDonationWebhookEvent } from "@/lib/donations";

export async function POST(req: Request) {
    try {
        const body = await req.text();
        const signature = req.headers.get("x-razorpay-signature") || "";

        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            // Misconfiguration, not a payment problem — ack so Razorpay doesn't
            // retry-storm an endpoint that will never succeed until fixed, but
            // log loudly since this silently disables webhook recovery entirely.
            console.error("WEBHOOK_SECRET_MISSING — webhook recovery disabled");
            return NextResponse.json({ success: false });
        }

        const expected = crypto
            .createHmac("sha256", webhookSecret)
            .update(body)
            .digest("hex");

        if (expected !== signature) {
            console.error("WEBHOOK_INVALID_SIGNATURE");
            // Ack (200) — an invalid signature will never become valid on
            // retry, so there's nothing to gain from Razorpay retrying this.
            return NextResponse.json({ success: false });
        }

        const event = JSON.parse(body);

        // ── Pre-Phase 17 Phase 2: Street Animal Support donation ─────────
        // Donations use a SEPARATE Razorpay order (never a food order), so
        // this check runs for both captured/failed events BEFORE the food-
        // order-only logic below, and short-circuits (ack + return) only
        // when the order_id actually belongs to a Donation document. For
        // every food-order payment this is a single no-op lookup (no
        // Donation document matches) and execution falls through to the
        // existing, byte-for-byte-unchanged food-order reconciliation.
        if (event.event === "payment.captured" || event.event === "payment.failed") {
            const donationPayment = event.payload?.payment?.entity;
            const isDonationPayment = await (async () => {
                if (!donationPayment?.order_id) return false;
                await connectDB();
                return handleDonationWebhookEvent(
                    event.event,
                    donationPayment.order_id,
                    donationPayment.id,
                    donationPayment.amount
                );
            })();
            if (isDonationPayment) {
                return NextResponse.json({ success: true });
            }
        }

        if (event.event !== "payment.captured") {
            // Other event types (payment.failed, order.paid, etc.) — no
            // reconciliation action needed from this route today. Ack.
            return NextResponse.json({ success: true });
        }

        const payment = event.payload?.payment?.entity;
        const razorpayPaymentId: string | undefined = payment?.id;
        const razorpayOrderId:   string | undefined = payment?.order_id;
        const amountPaise:       number | undefined = payment?.amount;

        if (!razorpayPaymentId || !razorpayOrderId) {
            console.error("WEBHOOK_MALFORMED_PAYLOAD", { event: event.event });
            return NextResponse.json({ success: true }); // ack — malformed, retry won't help
        }

        await connectDB();

        // ── Already reconciled? ─────────────────────────────────────────
        const existingOrder = await Order.findOne({ razorpayPaymentId })
            .select("_id orderId")
            .lean();

        if (existingOrder) {
            console.log("WEBHOOK_ALREADY_RECONCILED", { razorpayPaymentId, orderId: (existingOrder as any).orderId });
            return NextResponse.json({ success: true });
        }

        // ── Locate trusted checkout context ─────────────────────────────
        const pending = await PendingPayment.findOne({ razorpayOrderId })
            .lean<PendingPaymentDoc>();

        if (!pending) {
            // No safe way to reconstruct the order — do NOT guess customer
            // data from the webhook payload. This requires manual
            // reconciliation (Razorpay dashboard ↔ support) for this payment.
            console.error("WEBHOOK_NO_PENDING_PAYMENT_CONTEXT — manual reconciliation required", {
                razorpayPaymentId, razorpayOrderId,
            });
            return NextResponse.json({ success: true }); // ack — won't improve with retries
        }

        if (pending.status === "completed") {
            // Idempotent — e.g. client path already finished between our
            // existingOrder check and now.
            console.log("WEBHOOK_PENDING_ALREADY_COMPLETED", { razorpayOrderId, orderId: pending.orderId });
            return NextResponse.json({ success: true });
        }

        // ── Amount integrity check ──────────────────────────────────────
        if (typeof amountPaise === "number" && !amountMatches(pending, amountPaise)) {
            console.error("WEBHOOK_AMOUNT_MISMATCH — order NOT created, manual review required", {
                razorpayPaymentId, razorpayOrderId,
                expectedPaise: Math.round(pending.expectedAmount * 100),
                reportedPaise: amountPaise,
            });
            await PendingPayment.updateOne(
                { razorpayOrderId, status: "created" },
                { $set: { status: "failed", failureReason: "webhook_amount_mismatch" } }
            ).catch((e) => console.error("WEBHOOK_MARK_MISMATCH_FAILED_ERROR", e));
            return NextResponse.json({ success: true }); // ack — retrying won't change the amount
        }

        // ── Atomic claim ─────────────────────────────────────────────────
        const claimed = await claimPendingPayment(razorpayOrderId, razorpayPaymentId);

        if (!claimed) {
            // Client path is already processing (or just completed) this
            // payment concurrently — nothing more for the webhook to do.
            console.log("WEBHOOK_CLAIM_LOST — client path already handling it", {
                razorpayPaymentId, razorpayOrderId,
            });
            return NextResponse.json({ success: true });
        }

        // ── Recover the order ────────────────────────────────────────────
        try {
            const result = await createOrderFromPendingPayment(claimed, razorpayPaymentId);
            console.log("WEBHOOK_RECOVERED_ORDER", {
                razorpayPaymentId, razorpayOrderId, orderId: result.orderId,
            });
            return NextResponse.json({ success: true });
        } catch (createErr) {
            // createOrderFromPendingPayment already released the claim and
            // logged details. This may be transient (DB hiccup) or a genuine
            // business-rule failure (e.g. stock ran out between payment and
            // now) — either way, return 500 so Razorpay retries; if the
            // underlying issue is permanent, each retry is a cheap no-op
            // after the first attempt until someone restocks / investigates.
            console.error("WEBHOOK_ORDER_RECOVERY_FAILED", {
                razorpayPaymentId, razorpayOrderId,
                error: createErr instanceof Error ? createErr.message : createErr,
            });
            return NextResponse.json({ success: false }, { status: 500 });
        }
    } catch (err) {
        console.error("WEBHOOK_UNHANDLED_ERROR", err);
        // Unknown failure — ask Razorpay to retry.
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
