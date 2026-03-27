// src/models/PushSubscription.ts
// Stores web push subscriptions for sending promotional notifications.
// Linked to a user if logged in, anonymous otherwise.

import mongoose, { Schema, model, models } from "mongoose";

const PushSubscriptionSchema = new Schema(
    {
        // Optional user link — null for anonymous subscribers
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: false,
            default: null,
            index: true,
        },

        // Web Push endpoint URL (unique per browser/device)
        endpoint: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        // Encryption keys from PushSubscription.toJSON()
        p256dh: {
            type: String,
            required: true,
        },
        auth: {
            type: String,
            required: true,
        },

        // Device/browser info for debugging
        userAgent: {
            type: String,
            default: "",
        },

        // Whether this subscription is still valid
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },

        // Number of consecutive send failures (auto-deactivate after threshold)
        failCount: {
            type: Number,
            default: 0,
        },

        // Notification preferences (extensible)
        preferences: {
            offers:         { type: Boolean, default: true },
            lunchAlerts:    { type: Boolean, default: true },
            eveningAlerts:  { type: Boolean, default: true },
        },
    },
    { timestamps: true }
);

// Compound index: find all active subs for a user quickly
PushSubscriptionSchema.index({ user: 1, isActive: 1 });

const PushSubscription =
    models.PushSubscription || model("PushSubscription", PushSubscriptionSchema);

export default PushSubscription;