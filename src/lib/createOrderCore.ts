// src/lib/createOrderCore.ts
//
// ── SINGLE SOURCE OF TRUTH FOR ORDER CREATION ────────────────────────────────
//
// Used by:
//   • /api/payment/verify    (Razorpay online payment)
//   • /api/orders/cod        (Cash on Delivery)
//
// Handles:
//   1. Duplicate-payment guard  (razorpayPaymentId uniqueness, COD uses null)
//   2. Stock validation + decrement
//   3. Review Reward check
//   4. First-free-delivery check + consume
//   5. Loyalty point redemption (server-validated, ObjectId-safe)
//   6. Order document creation
//   7. Telegram admin notification

import mongoose from "mongoose";
import crypto   from "crypto";

import { connectDB }             from "@/lib/db";
import Order                     from "@/models/Order";
import Product                   from "@/models/Product";
import User                      from "@/models/User";
import ReviewReward               from "@/models/ReviewReward";
import { generateOrderId }       from "@/lib/utils";
import {
    calculateDeliveryFee,
    PLATFORM_FEE,
} from "@/lib/delivery";
import {
    checkFirstFreeDelivery,
    consumeFirstFreeDelivery,
} from "@/lib/firstFreeDelivery";
import {
    redeemPoints,
    LOYALTY_CONFIG,
    pointsToRupees,
} from "@/lib/loyaltyService";

import { COD_MAX_ORDER_AMOUNT } from "@/lib/constants";

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

        const paymentEmoji = params.paymentMethod === "cod" ? "💵" : "💳";

        const text = `
🔥 <b>New Order — FoodKnock</b>

🧾 <b>Order ID:</b> <code>${params.orderId}</code>
👤 <b>Customer:</b> ${params.customerName}
📞 <b>Phone:</b> ${params.phone}
🛵 <b>Type:</b> ${params.orderType}
${paymentEmoji} <b>Payment:</b> ${params.paymentMethod.toUpperCase()}
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

// ── Input & Output types ──────────────────────────────────────────────────────

export interface CreateOrderInput {
    paymentMethod:           "razorpay" | "cod";
    customerName:            string;
    phone:                   string;
    address:                 string;
    landmark?:               string;
    note?:                   string;
    orderType:               string;
    items:                   Array<{
        _id:       string;
        name:      string;
        price:     number;
        quantity:  number;
        image?:    string;
    }>;
    linkedUserId:            string | null;
    // Razorpay-specific (null for COD)
    razorpayOrderId?:        string | null;
    razorpayPaymentId?:      string | null;
    razorpaySignature?:      string | null;
    // Loyalty — server-validated point count from create-order (0 for COD if not used)
    validatedRedeemPoints?:  number;
}

export interface CreateOrderResult {
    orderId:               string;
    order:                 unknown;
    reviewRewardApplied:   boolean;
    loyaltyPointsRedeemed: number;
    isFirstDeliveryFreeApplied: boolean;
}

// ── Core function ─────────────────────────────────────────────────────────────

export async function createOrderCore(
    input: CreateOrderInput
): Promise<CreateOrderResult> {
    await connectDB();

    const {
        paymentMethod,
        customerName,
        phone,
        address,
        landmark = "",
        note     = "",
        orderType,
        items: rawItems,
        linkedUserId,
        razorpayOrderId   = null,
        razorpayPaymentId = null,
        validatedRedeemPoints: clientValidatedPoints = 0,
    } = input;

    // ── Duplicate guard (Razorpay only) ───────────────────────────────────
    if (paymentMethod === "razorpay" && razorpayPaymentId) {
        const existing = await Order.findOne({ razorpayPaymentId }).lean();
        if (existing) {
            return {
                orderId:               (existing as any).orderId,
                order:                 existing,
                reviewRewardApplied:   false,
                loyaltyPointsRedeemed: 0,
                isFirstDeliveryFreeApplied: (existing as any).isFirstDeliveryFreeApplied ?? false,
            };
        }
    }

    // ── Stock validation ──────────────────────────────────────────────────
    const productIds = rawItems
        .filter((i) => mongoose.Types.ObjectId.isValid(i._id))
        .map((i) => new mongoose.Types.ObjectId(i._id));

    const products   = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    for (const item of rawItems) {
        const product = productMap.get(item._id);
        if (!product) {
            throw Object.assign(new Error(`${item.name} not found`), { status: 404 });
        }
        if (product.stock < item.quantity) {
            throw Object.assign(
                new Error(`${product.name} only has ${product.stock} left`),
                { status: 400 }
            );
        }
    }

    // ── Decrement stock ───────────────────────────────────────────────────
    for (const item of rawItems) {
        const product = productMap.get(item._id)!;
        product.stock -= item.quantity;
        if (product.stock <= 0) {
            product.stock       = 0;
            product.isAvailable = false;
        }
        await product.save();
    }

    // ── Subtotal ──────────────────────────────────────────────────────────
    const subtotal: number = rawItems.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
    );

    // ── Review Reward ─────────────────────────────────────────────────────
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
              ...rawItems,
              {
                  name:      reviewRewardRewardItem === "pizza" ? "Free Pizza 🍕" : "Free Burger 🍔",
                  quantity:  1,
                  price:     0,
                  image:     "",
                  productId: null,
              },
          ]
        : rawItems;

    // ── First-free-delivery ───────────────────────────────────────────────
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

    if (paymentMethod === "cod" && grossTotal >= COD_MAX_ORDER_AMOUNT) {
    throw Object.assign(
        new Error(`COD not available above ₹${COD_MAX_ORDER_AMOUNT}`),
        { status: 400 }
    );
    }

    // ── Loyalty: security cap ─────────────────────────────────────────────
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

    // ── Total ─────────────────────────────────────────────────────────────
    const totalAmount = Math.max(1, grossTotal - redeemedAmount);

    // ── Create Order ──────────────────────────────────────────────────────
    const newOrderId = generateOrderId();

    const orderData: any = {
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
    isFirstDeliveryFreeApplied: firstDeliveryFree,
    ...(linkedUserId ? { user: linkedUserId } : {}),
};

// ✅ ONLY FOR RAZORPAY
if (paymentMethod === "razorpay") {
    orderData.razorpayOrderId   = razorpayOrderId;
    orderData.razorpayPaymentId = razorpayPaymentId;
}

// 🔥 FORCE SAFETY (VERY IMPORTANT)
if (paymentMethod === "cod") {
    delete orderData.razorpayPaymentId;
    delete orderData.razorpayOrderId;
}


const order = await Order.create(orderData);

    // ── Consume first-free-delivery ───────────────────────────────────────
    if (firstDeliveryFree) {
        consumeFirstFreeDelivery(linkedUserId).catch(console.error);
    }

    // ── Deduct loyalty points ─────────────────────────────────────────────
    const pointsToDeduct = Number((order as any).redeemedPoints) || 0;

    if (linkedUserId && pointsToDeduct > 0) {
        try {
            await redeemPoints({
                userId:       linkedUserId,
                points:       pointsToDeduct,
                orderMongoId: String((order as any)._id), // ← _id, NOT orderId
                note:         `Redeemed ${pointsToDeduct} pts at checkout — ₹${redeemedAmount} discount`,
            });
            console.log(
                `[loyalty] redeemed ${pointsToDeduct} pts for order ${newOrderId} (mongo: ${(order as any)._id})`
            );
        } catch (loyaltyErr) {
            console.error("LOYALTY_DEDUCTION_ERROR", {
                orderId:        newOrderId,
                orderMongoId:   String((order as any)._id),
                userId:         linkedUserId,
                pointsToDeduct,
                error:          loyaltyErr,
            });
        }
    }

    // ── Telegram ──────────────────────────────────────────────────────────
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

    return {
        orderId:               newOrderId,
        order,
        reviewRewardApplied,
        loyaltyPointsRedeemed: pointsToDeduct,
        isFirstDeliveryFreeApplied: firstDeliveryFree,
    };
}