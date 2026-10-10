// src/models/PushSubscription.ts
// Stores web push subscriptions for sending promotional notifications.
// Linked to a user if logged in, anonymous otherwise.
//
// NEW: `fcmToken` — additive, optional field. Populated only when the
// client obtains one via the Firebase Web SDK (see usePushNotifications.ts).
// Subscriptions without one continue being delivered via raw Web Push
// exactly as before — zero behavior change for existing rows. No unique
// constraint is placed on this field: uniqueness isn't required for
// correctness here.

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

        // Firebase Cloud Messaging token — additive, optional. Present only
        // when the client obtained one via the Firebase Web SDK. Null/absent
        // means this subscription is delivered via raw Web Push only — a
        // fully valid, unchanged state.
        fcmToken: {
            type: String,
            default: null,
        },

        // Device/browser info for debugging
        userAgent: {
            type: String,
            default: "",
        },

        // Whether this subscription is still valid.
        // Phase 17.4: removed a redundant `index: true` here — it declared
        // the exact same standalone {isActive:1} index that the explicit
        // schema.index({isActive:1}) below (Phase 17.2, F8) already
        // creates, which Mongoose was warning about on every model load
        // ("Duplicate schema index on {isActive:1}"). The explicit
        // declaration below is kept — it carries the rationale comment.
        isActive: {
            type: Boolean,
            default: true,
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

// Phase 17.2 (F8): the broadcast send path (webPushProvider.ts's
// resolveTargets) queries {isActive:true} ALONE — the compound index
// above can't serve that efficiently since isActive isn't its leading
// key. A standalone index on isActive serves this exact query shape
// without duplicating/conflicting with the index above (different leading
// key, different purpose — user-scoped lookups vs. the broadcast fan-out).
PushSubscriptionSchema.index({ isActive: 1 });

const PushSubscription =
    models.PushSubscription || model("PushSubscription", PushSubscriptionSchema);

export default PushSubscription;