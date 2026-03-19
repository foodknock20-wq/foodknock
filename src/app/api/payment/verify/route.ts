export const dynamic = "force-dynamic";

// src/app/api/payment/verify/route.ts
//
// Step 2 of the Razorpay flow.
//
// ── THE FIX ───────────────────────────────────────────────────────────────────
//
// ROOT CAUSE of missing ledger entries:
//
//   The old checkout called redeemAfterOrder(vd.orderId) where vd.orderId is
//   the SHORT display string like "FK-XXXX". This was passed to
//   POST /api/loyalty → redeemPoints({ orderId: "FK-XXXX" }) →
//   _applyPoints({ orderMongoId: "FK-XXXX" }) →
//   LoyaltyLedger.create({ order: "FK-XXXX" })
//
//   BUT LoyaltyLedger.order is Schema.Types.ObjectId. Mongoose SILENTLY stores
//   null when you pass a non-ObjectId string. So:
//     • The $inc on User.loyaltyPoints DID fire (balance went down)
//     • The LoyaltyLedger entry was created with order: null
//     • The idempotency guard (exists check by order+type) never matched
//     • Next time same order → another deduction → balance goes negative
//     • The loyalty page showed nothing because the entry had no order link
//
// THE FIX:
//   1. verify receives validatedRedeemPoints from create-order (already validated)
//   2. Stores redeemedPoints + redeemedAmount directly on the Order document
//   3. Calls redeemPoints() with order._id.toString() — the REAL MongoDB ObjectId
//   4. No separate POST /api/loyalty call needed from checkout
//   5. No recalculation — create-order is the authoritative source

import { NextResponse } from "next/server";
import crypto           from "crypto";
import mongoose         from "mongoose";
import { connectDB }    from "@/lib/db";
import Order            from "@/models/Order";
import Product          from "@/models/Product";
import User             from "@/models/User";
import ReviewReward     from "@/models/ReviewReward";
import { generateOrderId }   from "@/lib/utils";
import { verifyToken }       from "@/lib/auth";
import {
    calculateDeliveryFee,
    PLATFORM_FEE,
} from "@/lib/delivery";
import {
    checkFirstFreeDelivery,
    consumeFirstFreeDelivery,
} from "@/lib/firstFreeDelivery";
import { getShopStatus }                from "@/models/Shop";
import { redeemPoints, LOYALTY_CONFIG, pointsToRupees } from "@/lib/loyaltyService";

const REVIEW_REWARD_MIN_SUBTOTAL = 150;

// ── Telegram ──────────────────────────────────────────────────────────────────
async function notifyAdminTelegram(params: {
    orderId:                    string;
    customerName:               string;
    phone:                      string;
    address:                    string;
    landmark:                   string;
    note:                       string;
    items:                      Array<{ name: string; quantity: number; price: number }>;
    totalAmount:                number;
    orderType:                  string;
    paymentMethod:              string;
    isFirstDeliveryFreeApplied: boolean;
    reviewRewardApplied:        boolean;
    loyaltyPointsRedeemed:      number;
    loyaltyAmountSaved:         number;
}) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId   = process.env.TELEGRAM_CHAT_ID;
        if (!botToken || !chatId) { console.warn("Telegram env vars missing"); return; }

        const itemLines = params.items
            .map((i) => `• ${i.name} ×${i.quantity} — ₹${i.price * i.quantity}`)
            .join("\n");

        const loyaltyLine = params.loyaltyPointsRedeemed > 0
            ? `\n✨ <b>Loyalty: ${params.loyaltyPointsRedeemed} pts redeemed (−₹${params.loyaltyAmountSaved} discount)</b>`
            : "";

        const text = `
🔥 <b>New Order — FoodKnock</b>

🧾 <b>Order ID:</b> <code>${params.orderId}</code>
👤 <b>Customer:</b> ${params.customerName}
📞 <b>Phone:</b> ${params.phone}
🛵 <b>Type:</b> ${params.orderType}
💳 <b>Payment:</b> ${params.paymentMethod.toUpperCase()}
📍 <b>Address:</b> ${params.address || "-"}
🏷️ <b>Landmark:</b> ${params.landmark || "-"}
📝 <b>Note:</b> ${params.note || "-"}
${params.reviewRewardApplied ? "\n🎁 <b>Review Reward Applied!</b>" : ""}${loyaltyLine}

🛒 <b>Items:</b>
${itemLines}

💰 <b>Total charged:</b> ₹${params.totalAmount}
`.trim();

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        });
    } catch (err) {
        console.error("TELEGRAM ERROR", err);
    }
}

// ── POST handler ──────────────────────────────────────────────────────────────
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
            // Server-validated point count echoed from create-order response.
            // This is already validated — we only do a light balance cap here.
            validatedRedeemPoints: clientValidatedPoints,
        } = body;

        const items: any[] = rawItems ?? [];
        if (!items.length) {
            return NextResponse.json(
                { success: false, message: "Cart empty" },
                { status: 400 }
            );
        }

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
                return NextResponse.json(
                    { success: false, message: "Invalid payment signature" },
                    { status: 400 }
                );
            }
        }

        // ── Duplicate order protection ────────────────────────────────────
        const existingOrder = await Order.findOne({ razorpayPaymentId }).lean();
        if (existingOrder) {
            return NextResponse.json({
                success: true,
                orderId: (existingOrder as any).orderId,
                message: "Order already exists",
            });
        }

        // ── Auth check ────────────────────────────────────────────────────
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

        // ── Stock validation ──────────────────────────────────────────────
        const productIds = items
            .filter((i: any) => mongoose.Types.ObjectId.isValid(i._id))
            .map((i: any) => new mongoose.Types.ObjectId(i._id));

        const products   = await Product.find({ _id: { $in: productIds } });
        const productMap = new Map(products.map((p) => [String(p._id), p]));

        for (const item of items) {
            const product = productMap.get(item._id);
            if (!product) {
                return NextResponse.json(
                    { success: false, message: `${item.name} not found` },
                    { status: 404 }
                );
            }
            if (product.stock < item.quantity) {
                return NextResponse.json(
                    { success: false, message: `${product.name} only has ${product.stock} left` },
                    { status: 400 }
                );
            }
        }

        // ── Update stock ──────────────────────────────────────────────────
        for (const item of items) {
            const product = productMap.get(item._id)!;
            product.stock -= item.quantity;
            if (product.stock <= 0) {
                product.stock       = 0;
                product.isAvailable = false;
            }
            await product.save();
        }

        // ── Subtotal ──────────────────────────────────────────────────────
        const subtotal: number = items.reduce(
            (sum: number, i: any) => sum + i.price * i.quantity,
            0
        );

        // ── Review Reward ─────────────────────────────────────────────────
        let reviewRewardApplied    = false;
        let reviewRewardRewardItem: string | null = null;

        if (linkedUserId && subtotal >= REVIEW_REWARD_MIN_SUBTOTAL) {
            const claimed = await ReviewReward.findOneAndUpdate(
                { user: linkedUserId, status: "approved", rewardUsed: false },
                { $set: { rewardUsed: true } },
                { new: false, returnDocument: "before" }
            ).lean<{ rewardItem: string } | null>();

            if (claimed) {
                reviewRewardApplied    = true;
                reviewRewardRewardItem = claimed.rewardItem ?? "burger";
            }
        }

        const finalItems = reviewRewardApplied
            ? [
                  ...items,
                  {
                      name:      reviewRewardRewardItem === "pizza" ? "Free Pizza 🍕" : "Free Burger 🍔",
                      quantity:  1,
                      price:     0,
                      image:     "",
                      productId: null,
                  },
              ]
            : items;

        // ── First-free-delivery ───────────────────────────────────────────
        const { eligible: firstDeliveryFree } = await checkFirstFreeDelivery(
            linkedUserId,
            orderType
        );

        const deliveryFee =
            orderType === "pickup"
                ? 0
                : firstDeliveryFree
                    ? 0
                    : calculateDeliveryFee(subtotal);

        const grossTotal = subtotal + deliveryFee + PLATFORM_FEE;

        // ── Loyalty: security cap only — NO recalculation ─────────────────
        //
        // create-order already did the full validation. We only verify the
        // echoed value doesn't exceed the user's CURRENT live balance.
        // This prevents a tampered client from redeeming more than they have.
        //
        // We do NOT re-run maxRedeemablePoints() — that would risk producing
        // a different result and causing the Razorpay amount vs discount mismatch.
        let verifiedRedeemPoints = 0;
        let redeemedAmount       = 0;

        const echoedPoints = Math.max(0, Math.floor(Number(clientValidatedPoints ?? 0)));

        if (linkedUserId && echoedPoints >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
            const freshUser = await User.findById(linkedUserId)
                .select("loyaltyPoints")
                .lean() as { loyaltyPoints?: number } | null;
            const liveBalance = Number(freshUser?.loyaltyPoints ?? 0);

            const capped = Math.min(echoedPoints, liveBalance);
            if (capped >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
                verifiedRedeemPoints = capped;
                redeemedAmount       = pointsToRupees(verifiedRedeemPoints);
            }
        }

        // ── Total amount ──────────────────────────────────────────────────
        const totalAmount = Math.max(1, grossTotal - redeemedAmount);

        // ── Create Order ──────────────────────────────────────────────────
        // redeemedPoints + redeemedAmount stored on Order for audit trail.
        const newOrderId = generateOrderId();

        const order = await Order.create({
            orderId:      newOrderId,
            customerName: customerName?.trim(),
            phone:        phone?.trim(),
            address:      orderType === "delivery" ? address?.trim() : "Pickup",
            landmark,
            note,
            orderType,
            items:        finalItems,
            deliveryFee,
            platformFee:  PLATFORM_FEE,
            totalAmount,
            redeemedPoints: verifiedRedeemPoints,
            redeemedAmount,
            status:       "received",
            paymentMethod,
            razorpayOrderId,
            razorpayPaymentId,
            isFirstDeliveryFreeApplied: firstDeliveryFree,
            ...(linkedUserId ? { user: linkedUserId } : {}),
        });

        // ── Consume first-free-delivery ───────────────────────────────────
        if (firstDeliveryFree) {
            consumeFirstFreeDelivery(linkedUserId).catch(console.error);
        }

        // ── Deduct loyalty points ─────────────────────────────────────────
        //
        // CRITICAL: pass order._id.toString() — the REAL MongoDB ObjectId string.
        //
        // DO NOT pass order.orderId (the short "FK-XXXX" display string).
        // LoyaltyLedger.order is a Schema.Types.ObjectId field. Passing a
        // non-ObjectId string causes Mongoose to silently store null, which:
        //   1. Breaks the idempotency guard (exists check won't match)
        //   2. Allows double deductions on retry
        //   3. Makes the entry invisible in the loyalty page transaction history
        //
        // Using order._id.toString() ensures Mongoose casts it correctly.
        const pointsToDeduct = Number((order as any).redeemedPoints) || 0;

        if (linkedUserId && pointsToDeduct > 0) {
            try {
                await redeemPoints({
                    userId:       linkedUserId,
                    points:       pointsToDeduct,
                    orderMongoId: String((order as any)._id), // ← _id, NOT orderId
                    note:         `Redeemed ${pointsToDeduct} pts at checkout — ₹${redeemedAmount} discount`,
                });
                console.log(`[loyalty] redeemed ${pointsToDeduct} pts for order ${newOrderId} (mongo: ${(order as any)._id})`);
            } catch (loyaltyErr) {
                // Order is paid — do not fail the response.
                // order.redeemedPoints is the audit trail for reconciliation.
                console.error("LOYALTY_DEDUCTION_ERROR", {
                    orderId:        newOrderId,
                    orderMongoId:   String((order as any)._id),
                    userId:         linkedUserId,
                    pointsToDeduct,
                    error:          loyaltyErr,
                });
            }
        }

        // ── Telegram notification ─────────────────────────────────────────
        notifyAdminTelegram({
            orderId:                    newOrderId,
            customerName,
            phone,
            address,
            landmark,
            note,
            items:                      finalItems,
            totalAmount,
            orderType,
            paymentMethod,
            isFirstDeliveryFreeApplied: firstDeliveryFree,
            reviewRewardApplied,
            loyaltyPointsRedeemed:      pointsToDeduct,
            loyaltyAmountSaved:         redeemedAmount,
        }).catch(console.error);

        return NextResponse.json({
            success:               true,
            orderId:               newOrderId,
            order,
            reviewRewardApplied,
            loyaltyPointsRedeemed: pointsToDeduct,
        });
    } catch (error) {
        console.error("VERIFY PAYMENT ERROR", error);
        return NextResponse.json(
            { success: false, message: "Order creation failed" },
            { status: 500 }
        );
    }
}