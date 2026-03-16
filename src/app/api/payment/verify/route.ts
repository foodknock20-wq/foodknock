export const dynamic = "force-dynamic";

// src/app/api/payment/verify/route.ts
//
// Verifies Razorpay payment signature, validates stock, creates the Order.
//
// ── Review Reward integration ────────────────────────────────────────────────
// Before creating the order we check if the authenticated user has an approved,
// unused ReviewReward document AND the cart subtotal ≥ ₹150.  If so, we inject
// a zero-price free item (Free Burger / Free Pizza) into the items array and
// mark the reward as used AFTER the order is successfully created.
//
// The reward is consumed with findOneAndUpdate + $set to ensure atomicity even
// if two requests arrive simultaneously (only one will see rewardUsed: false).

import { NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";
import ReviewReward from "@/models/ReviewReward";
import { generateOrderId } from "@/lib/utils";
import { verifyToken } from "@/lib/auth";
import { calculateDeliveryFee, PLATFORM_FEE } from "@/lib/delivery";
import {
    checkFirstFreeDelivery,
    consumeFirstFreeDelivery,
} from "@/lib/firstFreeDelivery";
import { getShopStatus } from "@/models/Shop";

// ── Minimum subtotal for review reward to apply ───────────────────────────────
const REVIEW_REWARD_MIN_SUBTOTAL = 150;

async function notifyAdminTelegram(params: {
    orderId: string;
    customerName: string;
    phone: string;
    address: string;
    landmark: string;
    note: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    totalAmount: number;
    orderType: string;
    paymentMethod: string;
    isFirstDeliveryFreeApplied: boolean;
    reviewRewardApplied: boolean;
}) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (!botToken || !chatId) {
            console.warn("Telegram env vars missing");
            return;
        }

        const itemLines = params.items
            .map((i) => `• ${i.name} ×${i.quantity} — ₹${i.price * i.quantity}`)
            .join("\n");

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
${params.reviewRewardApplied ? "\n🎁 <b>Review Reward Applied!</b>" : ""}

🛒 <b>Items:</b>
${itemLines}

💰 <b>Total:</b> ₹${params.totalAmount}
`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        });
    } catch (err) {
        console.error("TELEGRAM ERROR", err);
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();

        // ── Shop closed guard ─────────────────────────────────────────────
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
            note = "",
            orderType,
            items: rawItems,
        } = body;

        const items = rawItems ?? [];
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
                orderId: existingOrder.orderId,
                message: "Order already exists",
            });
        }

        // ── Auth check ────────────────────────────────────────────────────
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
        let linkedUserId: string | null = null;

        if (token) {
            try {
                const decoded = verifyToken(token) as { userId?: string };
                if (decoded?.userId) {
                    const user = await User.findById(decoded.userId)
                        .select("_id isActive")
                        .lean();
                    if (user && user.isActive !== false) {
                        linkedUserId = String(user._id);
                    }
                }
            } catch {}
        }

        // ── Validate stock ────────────────────────────────────────────────
        const productIds = items
            .filter((i: any) => mongoose.Types.ObjectId.isValid(i._id))
            .map((i: any) => new mongoose.Types.ObjectId(i._id));

        const products = await Product.find({ _id: { $in: productIds } });
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
                    {
                        success: false,
                        message: `${product.name} only has ${product.stock} left`,
                    },
                    { status: 400 }
                );
            }
        }

        // ── Update stock ──────────────────────────────────────────────────
        for (const item of items) {
            const product = productMap.get(item._id)!;
            product.stock -= item.quantity;
            if (product.stock <= 0) {
                product.stock = 0;
                product.isAvailable = false;
            }
            await product.save();
        }

        // ── Calculate subtotal ────────────────────────────────────────────
        const subtotal = items.reduce(
            (sum: number, i: any) => sum + i.price * i.quantity,
            0
        );

        // ── Review Reward check ───────────────────────────────────────────
        // Atomically claim the reward: update only if still approved + unused.
        // findOneAndUpdate returns null if no matching document → no reward.
        let reviewRewardApplied = false;
        let reviewRewardRewardItem: string | null = null;

        if (linkedUserId && subtotal >= REVIEW_REWARD_MIN_SUBTOTAL) {
            const claimed = await ReviewReward.findOneAndUpdate(
                { user: linkedUserId, status: "approved", rewardUsed: false },
                { $set: { rewardUsed: true } },
                { new: false, returnDocument: "before" } // we want the pre-update doc
            ).lean<{ rewardItem: string } | null>();

            if (claimed) {
                reviewRewardApplied = true;
                reviewRewardRewardItem = claimed.rewardItem ?? "burger";
            }
        }

        // Inject free item AFTER stock validation so it never fails a stock check
        const finalItems = reviewRewardApplied
            ? [
                  ...items,
                  {
                      name:
                          reviewRewardRewardItem === "pizza"
                              ? "Free Pizza 🍕"
                              : "Free Burger 🍔",
                      quantity: 1,
                      price: 0,
                      image: "",
                      productId: null,
                  },
              ]
            : items;

        // ── First-free-delivery check ─────────────────────────────────────
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

        const platformFee = PLATFORM_FEE;
        const totalAmount = subtotal + deliveryFee + platformFee;
        // Free item price = 0, so totalAmount is unchanged

        // ── Create order ──────────────────────────────────────────────────
        const newOrderId = generateOrderId();

        const order = await Order.create({
            orderId: newOrderId,
            customerName: customerName?.trim(),
            phone: phone?.trim(),
            address: orderType === "delivery" ? address?.trim() : "Pickup",
            landmark,
            note,
            orderType,
            items: finalItems,
            deliveryFee,
            platformFee,
            totalAmount,
            status: "received",
            paymentMethod,
            razorpayOrderId,
            razorpayPaymentId,
            isFirstDeliveryFreeApplied: firstDeliveryFree,
            ...(linkedUserId ? { user: linkedUserId } : {}),
        });

        // ── Consume first-free-delivery flag ──────────────────────────────
        if (firstDeliveryFree) {
            consumeFirstFreeDelivery(linkedUserId).catch(console.error);
        }

        // ── Telegram notify ───────────────────────────────────────────────
        notifyAdminTelegram({
            orderId: newOrderId,
            customerName,
            phone,
            address,
            landmark,
            note,
            items: finalItems,
            totalAmount,
            orderType,
            paymentMethod,
            isFirstDeliveryFreeApplied: firstDeliveryFree,
            reviewRewardApplied,
        });

        return NextResponse.json({
            success: true,
            orderId: newOrderId,
            order,
            reviewRewardApplied,
        });
    } catch (error) {
        console.error("VERIFY PAYMENT ERROR", error);
        return NextResponse.json(
            { success: false, message: "Order creation failed" },
            { status: 500 }
        );
    }
}