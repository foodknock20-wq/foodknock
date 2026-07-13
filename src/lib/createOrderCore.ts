// src/lib/createOrderCore.ts
//
// ── SINGLE SOURCE OF TRUTH FOR ORDER CREATION ────────────────────────────────
//
// Used by:
//   • /api/payment/verify    (Razorpay online payment)
//   • /api/orders/cod        (Cash on Delivery)
//
// Handles:
//   1. Duplicate-payment guard  (razorpayPaymentId uniqueness, COD omits field)
//   2. Stock validation + decrement
//   3. Review Reward check
//   4. First-free-delivery check + consume
//   5. Loyalty point redemption (server-validated, ObjectId-safe)
//   6. Order document creation
//   7. Telegram admin notification
//   8. Order confirmation email (customer, when an email is available)
//   9. Admin new-order alert email
//  10. Order-placed transactional push notification (logged-in users only)
//
// FIX: razorpayPaymentId / razorpayOrderId are NEVER written as null.
//      For COD orders these fields are completely omitted from orderData so
//      MongoDB's sparse-unique index on razorpayPaymentId never sees a null
//      and E11000 duplicate-key errors cannot occur.
//
// PERF PASS (Orders/Loyalty audit):
//   1. Loyalty-balance lookup and customer-email lookup — previously TWO
//      separate `User.findById()` calls later in this function — are now
//      ONE combined lookup (`linkedUserSnapshot`), fetched once and reused
//      by both the redemption-cap check and the confirmation/admin-alert
//      emails. Same fields, same values, same error handling.
//      Expected Mongo: -1 query per order placed by a logged-in user.
//      Expected CPU/Duration: one fewer awaited round trip on the hot
//      checkout path (every COD + every Razorpay order).
//   2. Stock-decrement loop now fires all `product.save()` calls
//      concurrently via Promise.all instead of sequentially — mirrors the
//      identical fix already applied in src/app/api/orders/route.ts. The
//      preceding VALIDATION loop is intentionally left as a separate,
//      sequential, all-items-first pass (see comment at that loop) — this
//      file explicitly documents that Mongo transactions are not used here
//      (Atlas free-tier restriction, see loyaltyService.ts), so validating
//      every item BEFORE mutating any stock is a deliberate correctness
//      safeguard against partial decrements on a late validation failure.
//      Only the (already-fully-validated) SAVE step is parallelized.
//      Expected Duration: for a cart with N distinct products, collapses N
//      sequential round trips into 1 concurrent batch — the single largest
//      latency contributor in this function for multi-item carts.

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
import { sendOrderConfirmationEmail, sendAdminOrderAlertEmail } from "@/lib/mailer";
import { notificationEngine } from "@/lib/notifications";

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
    // Razorpay-specific — intentionally optional (never default to null)
    razorpayOrderId?:        string;
    razorpayPaymentId?:      string;
    razorpaySignature?:      string;
    // Loyalty — server-validated point count (0 when not used)
    validatedRedeemPoints?:  number;
}

export interface CreateOrderResult {
    orderId:                    string;
    order:                      unknown;
    reviewRewardApplied:        boolean;
    loyaltyPointsRedeemed:      number;
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
        // ⚠️  NO default = null here — keep these as undefined when absent
        //     so they are never written to the DB as null.
        razorpayOrderId,
        razorpayPaymentId,
        validatedRedeemPoints: clientValidatedPoints = 0,
    } = input;

    // ── Duplicate guard (Razorpay only) ───────────────────────────────────
    // Only run when we actually have a payment ID (never for COD).
    if (paymentMethod === "razorpay" && razorpayPaymentId) {
        const existing = await Order.findOne({ razorpayPaymentId }).lean();
        if (existing) {
            return {
                orderId:                    (existing as any).orderId,
                order:                      existing,
                reviewRewardApplied:        false,
                loyaltyPointsRedeemed:      0,
                isFirstDeliveryFreeApplied: (existing as any).isFirstDeliveryFreeApplied ?? false,
            };
        }
    }

    // ── Stock validation ──────────────────────────────────────────────────
    const productIds = rawItems
        .filter((i) => mongoose.Types.ObjectId.isValid(i._id))
        .map((i) => new mongoose.Types.ObjectId(i._id));

    // NOTE: intentionally NOT .lean() and NOT .select()-projected here.
    // These documents are mutated (stock decrement) and persisted via
    // .save() below — .save() re-validates the FULL document against the
    // schema (required fields etc.), so a partial projection would cause
    // spurious "required field missing" validation errors on save() even
    // though we only intend to change `stock`/`isAvailable`. Fetching the
    // full document here is the correct, safe approach for a document that
    // will be saved back.
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
    // PERF: all saves fire concurrently — see file-header comment for the
    // full rationale (why the preceding validation loop stays sequential
    // and separate, while only this already-fully-validated mutation step
    // is parallelized).
    await Promise.all(
        rawItems.map((item) => {
            const product = productMap.get(item._id)!;
            product.stock -= item.quantity;
            if (product.stock <= 0) {
                product.stock       = 0;
                product.isAvailable = false;
            }
            return product.save();
        })
    );

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

    // ── PERF: single combined lookup for loyaltyPoints + email ─────────────
    // Replaces what were previously TWO separate User.findById() calls
    // later in this function (one for the loyalty-redemption balance check
    // below, one for the order-confirmation/admin-alert email lookup
    // further down) with ONE query, executed once, whenever a logged-in
    // user is placing the order. Same fields, same values, same error
    // handling as before — only the number of round trips changes.
    const linkedUserSnapshot: { loyaltyPoints?: number; email?: string } | null =
        linkedUserId
            ? await User.findById(linkedUserId)
                  .select("loyaltyPoints email")
                  .lean()
                  .catch((err) => {
                      console.error("LINKED_USER_LOOKUP_ERROR", err);
                      return null;
                  })
            : null;

    // ── Loyalty: security cap ─────────────────────────────────────────────
    let verifiedRedeemPoints = 0;
    let redeemedAmount       = 0;

    const echoedPoints = Math.max(0, Math.floor(Number(clientValidatedPoints ?? 0)));

    if (linkedUserId && echoedPoints >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
        const liveBalance = Number(linkedUserSnapshot?.loyaltyPoints ?? 0);

        const capped = Math.min(echoedPoints, liveBalance);
        if (capped >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
            verifiedRedeemPoints = capped;
            redeemedAmount       = pointsToRupees(verifiedRedeemPoints);
        }
    }

    // ── Total ─────────────────────────────────────────────────────────────
    const totalAmount = Math.max(1, grossTotal - redeemedAmount);

    // ── Build orderData — razorpay fields added ONLY when present ─────────
    //
    // CRITICAL: razorpayPaymentId has a unique sparse index in MongoDB.
    // A sparse index ignores documents where the field is absent (undefined),
    // but it DOES index null values — so multiple nulls trigger E11000.
    // Solution: never include these keys unless they hold a real string value.
    //
    const newOrderId = generateOrderId();

    const orderData: Record<string, unknown> = {
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

    // ✅ Razorpay fields: only written when paymentMethod is razorpay AND the
    //    values are non-empty strings. This guarantees the field is either a
    //    real unique string or completely absent — never null.
    if (paymentMethod === "razorpay" && razorpayPaymentId) {
        orderData.razorpayPaymentId = razorpayPaymentId;
        // razorpayOrderId is useful for support but not indexed; still guard it.
        if (razorpayOrderId) {
            orderData.razorpayOrderId = razorpayOrderId;
        }
    }

    // 🛡️  Belt-and-suspenders safety: if either field somehow crept in as a
    //     falsy value (null / undefined / ""), remove it entirely so MongoDB
    //     never receives it.
    if (!orderData.razorpayPaymentId) delete orderData.razorpayPaymentId;
    if (!orderData.razorpayOrderId)   delete orderData.razorpayOrderId;

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
                orderMongoId: String((order as any)._id), // ← _id, NOT orderId string
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

    // ── Order-placed transactional push notification ──────────────────────
    // Only logged-in users have push subscriptions tied to their account
    // (guest checkout has no user to target — never broadcast this event).
    // Fire-and-forget with error isolation, same pattern as Telegram above:
    // a push failure must never affect order creation or the response.
    if (linkedUserId) {
        try {
            notificationEngine.emit({
                name: "order.placed",
                data: { orderId: newOrderId },
                target: { userId: linkedUserId },
            });
        } catch (pushErr) {
            console.error("ORDER_PLACED_PUSH_ERROR", pushErr);
        }
    }

    // ── Customer email (shared by confirmation + admin alert) ─────────────
    // PERF: sourced from linkedUserSnapshot fetched once above — no extra
    // query here. Preserves the exact same Promise<string | undefined>
    // shape the two .then() chains below already expect, so nothing
    // downstream needs to change.
    const customerEmailPromise: Promise<string | undefined> =
        Promise.resolve(linkedUserSnapshot?.email);

    // ── Order confirmation email (customer) ────────────────────────────────
    // Only sent when we actually have an email to send to. Fire-and-forget:
    // a failed/skipped email must never affect the order response.
    customerEmailPromise
        .then((customerEmail) => {
            if (!customerEmail) return;
            return sendOrderConfirmationEmail(customerEmail, {
                customerName,
                orderId:       newOrderId,
                items:         finalItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
                totalAmount,
                deliveryFee,
                platformFee:   PLATFORM_FEE,
                address:       orderData.address as string,
                orderType,
                paymentMethod,
                createdAt:     (order as unknown as { createdAt?: Date }).createdAt ?? new Date(),
            });
        })
        .catch((err) => console.error("ORDER_CONFIRMATION_EMAIL_ERROR", err));

    // ── Admin new-order alert email ────────────────────────────────────────
    customerEmailPromise
        .then((customerEmail) =>
            sendAdminOrderAlertEmail({
                orderId:         newOrderId,
                customerName,
                customerEmail,
                phone,
                address:         orderData.address as string,
                landmark,
                note,
                orderType,
                totalAmount,
                deliveryFee,
                platformFee:     PLATFORM_FEE,
                redeemedPoints:  verifiedRedeemPoints,
                redeemedAmount,
                paymentMethod,
                items:           finalItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
                createdAt:       (order as unknown as { createdAt?: Date }).createdAt ?? new Date(),
            })
        )
        .catch((err) => console.error("ADMIN_ORDER_ALERT_EMAIL_ERROR", err));

    return {
        orderId:                    newOrderId,
        order,
        reviewRewardApplied,
        loyaltyPointsRedeemed:      pointsToDeduct,
        isFirstDeliveryFreeApplied: firstDeliveryFree,
    };
}