// src/models/Order.ts
// FIXED: razorpayPaymentId / razorpayOrderId have NO default: null
//        so the fields are never written to MongoDB unless explicitly set.
//        This prevents E11000 duplicate-key errors on the sparse unique index.

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

        // ── Loyalty redemption ─────────────────────────────────────────────
        redeemedPoints: { type: Number, default: 0, min: 0 },
        redeemedAmount: { type: Number, default: 0, min: 0 },

        note: { type: String, default: "", trim: true },

        status: {
            type:    String,
            enum:    ["received", "preparing", "out_for_delivery", "delivered", "cancelled"],
            default: "received",
        },

        paymentMethod: {
            type:    String,
            enum:    ["cod", "razorpay"],
            default: "cod",
        },

        // ── Razorpay fields ────────────────────────────────────────────────
        // NO `default: null` on either field.
        // When absent the key is simply not stored, which means the sparse
        // unique index on razorpayPaymentId correctly ignores those documents.
        // Multiple COD orders can coexist without any index collision.
        razorpayOrderId: {
            type:  String,
            index: true,
            // intentionally no default
        },

        razorpayPaymentId: {
            type:   String,
            unique: true,
            sparse: true,
            // intentionally no default
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

OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ phone: 1 });

const Order = models.Order || model("Order", OrderSchema);

export default Order;
