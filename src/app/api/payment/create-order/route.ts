export const dynamic = "force-dynamic";

// src/app/api/payment/create-order/route.ts
//
// Step 1 of the Razorpay payment flow.
//
// ── Why this route must be aware of first-free-delivery ──────────────────────
//
// The Razorpay order is created here with a fixed amount that the user pays.
// If this route ignores the first-free-delivery benefit and includes a delivery
// fee, two things break simultaneously:
//
//   1. The user is shown the wrong amount in the Razorpay popup and overcharged.
//   2. The amount Razorpay captures differs from what /api/payment/verify will
//      record as totalAmount on the Order (which correctly waives the fee).
//      This creates a permanent audit discrepancy.
//
// Fix: call checkFirstFreeDelivery() here (Phase 1 — read-only, no mutation)
// and use deliveryFee = 0 when eligible.  The verify route runs the same
// read-only check independently.  Because consumeFirstFreeDelivery() has not
// been called yet, both checks see the same DB state and both return eligible.
// The flag is only written once, after Order.create() succeeds in verify.
//
// Required env vars:
//   RAZORPAY_KEY_ID
//   RAZORPAY_KEY_SECRET

import { NextResponse }  from "next/server";
import Razorpay          from "razorpay";
import { connectDB }     from "@/lib/db";
import User              from "@/models/User";
import { verifyToken }   from "@/lib/auth";
import { calculateDeliveryFee, PLATFORM_FEE } from "@/lib/delivery";
import { checkFirstFreeDelivery }             from "@/lib/firstFreeDelivery";
import { getShopStatus }                      from "@/models/Shop";

const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
    try {
        // ── Shop closed guard ─────────────────────────────────────────────
        // Check before doing any further work so we fail fast.
        const { isOpen } = await getShopStatus();
        if (!isOpen) {
            return NextResponse.json(
                { success: false, message: "Shop is currently closed" },
                { status: 503 }
            );
        }

        const body = await req.json();

        // We only trust prices + quantities from the client — never names or images
        const items: Array<{ price: number; quantity: number }> = body.items ?? [];

        if (!items.length) {
            return NextResponse.json(
                { success: false, message: "Cart is empty" },
                { status: 400 }
            );
        }

        const orderType: string = body.orderType ?? "delivery";

        // ── Auth resolution ───────────────────────────────────────────────
        //
        // Extract the logged-in user's ID so we can check first-free-delivery
        // eligibility.  A missing or invalid token simply means guest — we
        // continue without the benefit rather than returning an error.
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
        let linkedUserId: string | null = null;

        if (token) {
            try {
                const decoded = verifyToken(token) as { userId?: string };
                if (decoded?.userId) {
                    await connectDB();
                    const user = await User.findById(decoded.userId)
                        .select("_id isActive")
                        .lean();

                    // Blocked users: let the order attempt fail later at verify.
                    // Here we just silently skip eligibility for them.
                    if (user && (user as { isActive?: boolean }).isActive !== false) {
                        linkedUserId = String((user as { _id: unknown })._id);
                    }
                }
            } catch {
                // Invalid token — treat as guest, continue without benefit
            }
        }

        // ── Server-side pricing ───────────────────────────────────────────
        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

        // Phase 1: read-only eligibility check.
        // Does NOT write to the DB.  consumeFirstFreeDelivery() is called
        // only in /api/payment/verify, after Order.create() succeeds.
        const { eligible: firstDeliveryFree } = await checkFirstFreeDelivery(
            linkedUserId,
            orderType
        );

        const deliveryFee = orderType === "pickup"
            ? 0
            : firstDeliveryFree
                ? 0                               // 🎁 first-order perk
                : calculateDeliveryFee(subtotal);

        const platformFee = PLATFORM_FEE;
        const totalAmount = subtotal + deliveryFee + platformFee;

        // ── Create Razorpay order ─────────────────────────────────────────
        // Amount must be in paise (₹1 = 100 paise)
        const razorpayOrder = await razorpay.orders.create({
            amount:   totalAmount * 100,
            currency: "INR",
            receipt:  `rcpt_${Date.now()}`,
            notes: {
                orderType,
                customerName:      body.customerName ?? "",
                firstDeliveryFree: String(firstDeliveryFree),
            },
        });

        return NextResponse.json({
            success:         true,
            razorpayOrderId: razorpayOrder.id,
            amount:          totalAmount,       // ₹, not paise
            currency:        "INR",
            keyId:           process.env.RAZORPAY_KEY_ID,  // public key, safe to expose
            // Echo breakdown so checkout page can validate its displayed total
            subtotal,
            deliveryFee,
            platformFee,
            isFirstDeliveryFreeApplied: firstDeliveryFree,
        });
    } catch (error) {
        console.error("CREATE_RAZORPAY_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to create payment order" },
            { status: 500 }
        );
    }
}