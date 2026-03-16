// src/models/Order.ts
// FIXED: Added missing MongoDB indexes for production query performance

import { Schema, model, models } from "mongoose";

const OrderItemSchema = new Schema(
    {
        productId: {
            type:     Schema.Types.ObjectId,
            ref:      "Product",
            required: false,
            default:  null,
        },
        name:     { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        price:    { type: Number, required: true, min: 0 },
        image:    { type: String, default: "" },
    },
    { _id: false }
);

const OrderSchema = new Schema(
    {
        orderId: {
            type:     String,
            required: true,
            unique:   true,
            index:    true,
        },

        user: {
            type:     Schema.Types.ObjectId,
            ref:      "User",
            required: false,
            default:  null,
        },

        customerName: { type: String, required: true, trim: true },
        phone:        { type: String, required: true, trim: true },
        address:      { type: String, required: true, trim: true },
        landmark:     { type: String, default: "", trim: true },

        orderType: {
            type:    String,
            enum:    ["delivery", "pickup"],
            default: "delivery",
        },

        items: { type: [OrderItemSchema], required: true },

        totalAmount: { type: Number, required: true, min: 0 },
        deliveryFee: { type: Number, default: 0, min: 0 },
        platformFee: { type: Number, default: 0, min: 0 },

        note: { type: String, default: "", trim: true },

        status: {
            type:    String,
            enum:    ["received", "preparing", "out_for_delivery", "delivered"],
            default: "received",
        },

        paymentMethod: {
            type:    String,
            enum:    ["cod", "razorpay"],
            default: "cod",
        },

        razorpayOrderId: {
            type:    String,
            default: null,
            index:   true,
        },

        razorpayPaymentId: {
            type:    String,
            unique:  true,
            sparse:  true,
            default: null,
        },

        whatsappSent: {
            type:    Boolean,
            default: false,
        },

        isFirstDeliveryFreeApplied: {
            type:    Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// ✅ ADDED: Indexes critical for production query performance
//
// 1. user + createdAt  — used by GET /api/orders/my (customer order history)
//    Without this, every "my orders" request does a full collection scan.
OrderSchema.index({ user: 1, createdAt: -1 });

// 2. status + createdAt — used by admin orders list with status filter
OrderSchema.index({ status: 1, createdAt: -1 });

// 3. createdAt alone — used by admin dashboard "recent orders" query
OrderSchema.index({ createdAt: -1 });

// 4. phone — used by order tracking and user order count aggregation
OrderSchema.index({ phone: 1 });

const Order = models.Order || model("Order", OrderSchema);

export default Order;
