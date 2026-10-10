export const dynamic = "force-dynamic";

// src/app/api/payment/verify/route.ts
//
// Step 2 of the Razorpay flow. Delegates order creation to createOrderCore.
//
// PAYMENT RELIABILITY (Phase 1A):
// Now looks up the PendingPayment created in Step 1 (create-order) and, when
// present, uses ITS stored server-trusted checkout context (not the
// re-submitted client body) to create the order — via the same atomic claim
// mechanism the webhook uses (src/lib/paymentReconciliation.ts). This makes
// the client path and the webhook path converge safely:
//   • client wins the claim  → client creates the order, webhook later no-ops
//   • webhook wins the claim → webhook creates the order, client polls briefly
//     then returns the order the webhook created
// If no PendingPayment is found (e.g. an in-flight checkout from before this
// deploy), falls back to the original client-trusted-items behavior so nothing
// breaks during the rollout window.

import { NextResponse } from "next/server";
import crypto            from "crypto";
import Razorpay           from "razorpay";
import { connectDB }     from "@/lib/db";
import User               from "@/models/User";
import Order               from "@/models/Order";
import PendingPayment     from "@/models/PendingPayment";
import { verifyToken }   from "@/lib/auth";
import { getShopStatus } from "@/models/Shop";
import { createOrderCore } from "@/lib/createOrderCore";
import { calculateAuthoritativePricing } from "@/lib/pricing";
import {
    claimPendingPayment,
    createOrderFromPendingPayment,
    amountMatches,
    waitForCompletion,
    type PendingPaymentDoc,
} from "@/lib/paymentReconciliation";

const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
    try {
        await connectDB();

        const { isOpen } = await getShopStatus();
        if (!isOpen) {
            return NextResponse.json(
                { success: false, message: "Shop is currently closed" },
                { status: 400 }
            );
        }

        const body = await req.json();
        const {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            paymentMethod,
            customerName,
            phone,
            address,
            landmark = "",
            note     = "",
            orderType,
            items: rawItems,
            validatedRedeemPoints: clientValidatedPoints,
            latitude:  bodyLatitude  = null,
            longitude: bodyLongitude = null,
            deliveryInstructions = "",
            couponCode = null,
        } = body;

        // ── Verify Razorpay signature ─────────────────────────────────────
        if (paymentMethod === "razorpay") {
            const secret = process.env.RAZORPAY_KEY_SECRET;
            if (!secret) {
                return NextResponse.json(
                    { success: false, message: "Razorpay secret missing" },
                    { status: 500 }
                );
            }
            const expectedSig = crypto
                .createHmac("sha256", secret)
                .update(`${razorpayOrderId}|${razorpayPaymentId}`)
                .digest("hex");
            if (expectedSig !== razorpaySignature) {
                console.error("VERIFY_INVALID_SIGNATURE", { razorpayOrderId, razorpayPaymentId });
                return NextResponse.json(
                    { success: false, message: "Invalid payment signature" },
                    { status: 400 }
                );
            }
        }

        // ── Auth check (Phase 9: guest checkout no longer allowed) ─────────
        // The "reconciled" path below (a PendingPayment exists) doesn't
        // actually use this route's linkedUserId — it uses the user already
        // captured server-side at /api/payment/create-order time (which now
        // itself requires login, so that value is always non-null for any
        // NEW checkout). This check's job is to guard the legacy fallback
        // path (no PendingPayment found) which DOES use linkedUserId
        // directly, and to fail fast/clearly rather than silently falling
        // back to a null "guest" user as it previously did.
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
        let linkedUserId: string | null = null;

        if (token) {
            try {
                const decoded = verifyToken(token) as { userId?: string };
                if (decoded?.userId) {
                    const user = await User.findById(decoded.userId)
                        .select("_id isActive")
                        .lean() as { _id: unknown; isActive?: boolean } | null;
                    if (user && user.isActive !== false) {
                        linkedUserId = String(user._id);
                    }
                }
            } catch {}
        }

        if (!linkedUserId) {
            return NextResponse.json(
                { success: false, message: "Please log in to place an order" },
                { status: 401 }
            );
        }

        // ── Reconciled path: a PendingPayment exists from create-order ─────
        if (paymentMethod === "razorpay" && razorpayOrderId) {
            const pending = await PendingPayment.findOne({ razorpayOrderId })
                .lean<PendingPaymentDoc>();

            if (pending) {
                // Already completed (e.g. webhook beat us, or this is a
                // duplicate client retry) — idempotent response.
                if (pending.status === "completed" && pending.orderId) {
                    const order = await Order.findOne({ orderId: pending.orderId }).lean();
                    console.log("VERIFY_IDEMPOTENT_ALREADY_COMPLETED", {
                        razorpayOrderId, orderId: pending.orderId,
                    });
                    return NextResponse.json({
                        success: true,
                        orderId: pending.orderId,
                        order,
                        reviewRewardApplied:   false,
                        loyaltyPointsRedeemed: 0,
                    });
                }

                // Independently confirm the payment with Razorpay itself
                // rather than trusting only the client-supplied signature —
                // strongest amount/status check available without a full
                // pricing-system rewrite (see audit §7 / Phase 2 note).
                try {
                    const payment = await razorpay.payments.fetch(razorpayPaymentId);
                    const capturedLike = payment.status === "captured" || payment.status === "authorized";
                    if (!capturedLike) {
                        console.error("VERIFY_PAYMENT_NOT_CAPTURED", {
                            razorpayOrderId, razorpayPaymentId, status: payment.status,
                        });
                        return NextResponse.json(
                            { success: false, message: "Payment not confirmed by Razorpay" },
                            { status: 400 }
                        );
                    }
                    if (!amountMatches(pending, Number(payment.amount))) {
                        console.error("VERIFY_AMOUNT_MISMATCH", {
                            razorpayOrderId, razorpayPaymentId,
                            expectedPaise: Math.round(pending.expectedAmount * 100),
                            reportedPaise: payment.amount,
                        });
                        return NextResponse.json(
                            { success: false, message: "Payment amount mismatch" },
                            { status: 400 }
                        );
                    }
                } catch (fetchErr) {
                    // Razorpay API unreachable — don't block a legitimately
                    // signature-verified payment on a transient network blip;
                    // log and continue with the HMAC-verified claim path.
                    console.error("VERIFY_RAZORPAY_FETCH_ERROR", { razorpayOrderId, error: fetchErr });
                }

                const claimed = await claimPendingPayment(razorpayOrderId, razorpayPaymentId);

                if (claimed) {
                    console.log("VERIFY_CLAIM_WON", { razorpayOrderId, razorpayPaymentId });
                    const result = await createOrderFromPendingPayment(claimed, razorpayPaymentId);
                    return NextResponse.json({
                        success:               true,
                        orderId:               result.orderId,
                        order:                 result.order,
                        reviewRewardApplied:   result.reviewRewardApplied,
                        loyaltyPointsRedeemed: result.loyaltyPointsRedeemed,
                    });
                }

                // Lost the claim — webhook (or a concurrent client retry) is
                // already processing this payment. Poll briefly rather than
                // erroring out on a payment that definitely succeeded.
                console.log("VERIFY_CLAIM_LOST_POLLING", { razorpayOrderId, razorpayPaymentId });
                const resolved = await waitForCompletion(razorpayOrderId);
                if (resolved) {
                    return NextResponse.json({
                        success:               true,
                        orderId:               resolved.orderId,
                        order:                 resolved.order,
                        reviewRewardApplied:   false,
                        loyaltyPointsRedeemed: 0,
                    });
                }

                console.error("VERIFY_CLAIM_LOST_TIMEOUT", { razorpayOrderId, razorpayPaymentId });
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Payment received! Your order is still being finalized — please check 'My Orders' in a moment.",
                    },
                    { status: 202 }
                );
            }

            console.warn("VERIFY_NO_PENDING_PAYMENT_FOUND — legacy client-trusted fallback", {
                razorpayOrderId,
            });
        }

        // ── Legacy fallback: no PendingPayment context available ───────────
        // Preserves pre-Phase-1A behavior so in-flight checkouts started
        // before this deploy still complete. Not protected by the webhook
        // recovery path (there is no stored context for the webhook to use).
        //
        // PHASE 2A: even on this fallback path, item pricing is re-derived
        // from the live Product documents — client-supplied item.price is
        // never trusted. See src/lib/pricing.ts.
        const { items } = await calculateAuthoritativePricing(rawItems ?? []);

        const result = await createOrderCore({
            paymentMethod:          "razorpay",
            customerName,
            phone,
            address,
            landmark,
            note,
            orderType,
            items,
            linkedUserId,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            validatedRedeemPoints:  clientValidatedPoints ?? 0,
            latitude:  typeof bodyLatitude  === "number" ? bodyLatitude  : null,
            longitude: typeof bodyLongitude === "number" ? bodyLongitude : null,
            deliveryInstructions: String(deliveryInstructions ?? "").trim().slice(0, 300),
            // Phase 11 — legacy fallback only (no PendingPayment snapshot
            // exists for this path); createOrderCore validates+reserves
            // fresh against its own authoritative subtotal.
            couponCode: couponCode ? String(couponCode) : null,
        });

        return NextResponse.json({
            success:               true,
            orderId:               result.orderId,
            order:                 result.order,
            reviewRewardApplied:   result.reviewRewardApplied,
            loyaltyPointsRedeemed: result.loyaltyPointsRedeemed,
        });
    } catch (error: any) {
        console.error("VERIFY PAYMENT ERROR", error);
        return NextResponse.json(
            { success: false, message: error?.message || "Order creation failed" },
            { status: error?.status || 500 }
        );
    }
}
