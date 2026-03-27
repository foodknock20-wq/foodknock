// src/models/User.ts

import mongoose, { Schema, model, models } from "mongoose";

const AddressSchema = new Schema(
    {
        line1:    { type: String, trim: true },
        line2:    { type: String, trim: true },
        city:     { type: String, trim: true },
        state:    { type: String, trim: true },
        pincode:  { type: String, trim: true },
        landmark: { type: String, trim: true },
    },
    { _id: false }
);

const UserSchema = new Schema(
    {
        name: {
            type:     String,
            required: true,
            trim:     true,
        },
        dob: {
            type:     Date,
            required: false,
        },
        email: {
            type:      String,
            required:  true,
            unique:    true,      // ✅ ye hi kaafi hai (index auto banega)
            lowercase: true,
            trim:      true,
        },
        phone: {
            type:     String,
            required: true,
            trim:     true,
        },
        password: {
            type:     String,
            required: true,
        },
        role: {
            type:    String,
            enum:    ["user", "admin"],
            default: "user",
        },
        address:  AddressSchema,
        isActive: {
            type:    Boolean,
            default: true,
        },

        // Loyalty
        loyaltyPoints: {
            type:    Number,
            default: 0,
        },

        referralCode: {
            type:      String,
            trim:      true,
            uppercase: true,
        },

        referredBy: {
            type:    Schema.Types.ObjectId,
            ref:     "User",
            default: null,
        },

        referralRewardGranted: {
            type:    Boolean,
            default: false,
        },

        deliveredOrderCount: {
            type:    Number,
            default: 0,
        },

        firstDeliveryFreeUsed: {
            type:    Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// ✅ Referral code unique + sparse
UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true });

// ✅ Phone index (fast lookup)
UserSchema.index({ phone: 1 });

// ❌ REMOVED THIS (duplicate)
// UserSchema.index({ email: 1 });

const User = models.User || model("User", UserSchema);

export default User;