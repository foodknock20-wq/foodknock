// src/models/ReviewReward.ts
//
// Tracks Instagram review submissions for the "post a reel → free item" reward.
//
// Lifecycle:
//   user submits link → status: "pending"
//   admin approves    → status: "approved"  (rewardUsed: false)
//   order is placed   → rewardUsed: true  (written in verify/route.ts)
//   admin rejects     → status: "rejected"
//
// Constraints enforced here:
//   • One submission per user (sparse unique index on user field)
//   • rewardUsed can only go false → true  (enforced at app layer)

import { Schema, model, models } from "mongoose";

const ReviewRewardSchema = new Schema(
    {
        // The user who submitted the review
        user: {
            type:     Schema.Types.ObjectId,
            ref:      "User",
            required: true,
        },

        // The Instagram reel URL submitted by the user
        instagramLink: {
            type:     String,
            required: true,
            trim:     true,
        },

        // Moderation status — starts pending, admin moves to approved/rejected
        status: {
            type:    String,
            enum:    ["pending", "approved", "rejected"],
            default: "pending",
        },

        // Which free item the user receives on approval
        rewardItem: {
            type:    String,
            enum:    ["burger", "pizza"],
            default: "burger",
        },

        // Flipped to true once the free item is added to an order.
        // Prevents double-redemption.
        rewardUsed: {
            type:    Boolean,
            default: false,
        },

        // Optional note left by admin (rejection reason, etc.)
        adminNote: {
            type:    String,
            default: "",
            trim:    true,
        },
    },
    { timestamps: true }
);

// One reward per user — prevents re-submission after approval/rejection.
// sparse: true means users with no document don't clash on the null key.
ReviewRewardSchema.index({ user: 1 }, { unique: true, sparse: true });

const ReviewReward = models.ReviewReward || model("ReviewReward", ReviewRewardSchema);

export default ReviewReward;