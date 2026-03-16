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
        // Optional — birthday gift feature; not required at registration.
        dob: {
            type:     Date,
            required: false,
        },
        email: {
            type:      String,
            required:  true,
            unique:    true,
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

        // ── Loyalty ───────────────────────────────────────────────────────────
        //
        // DELIBERATELY no `min: 0` validator on loyaltyPoints.
        //
        // Mongoose schema validators run on the hydrated document in Node memory
        // (after $inc has been applied in memory) and can block the findByIdAndUpdate
        // write from reaching MongoDB.  A `min: 0` validator would fire on the result
        // of a valid redemption ($inc: -50 on a balance of 50 → 0) and reject the
        // write, leaving the cached balance unchanged while the corresponding
        // LoyaltyLedger entry was still created — the exact desync the user reported.
        //
        // Non-negative balance is enforced at the application layer in
        // loyaltyService.redeemPoints() which checks balance >= requestedPoints
        // before issuing the $inc.  No DB-level validator is needed.
        loyaltyPoints: {
            type:    Number,
            default: 0,
        },

        // 8-char alphanumeric referral code, generated at registration.
        referralCode: {
            type:      String,
            trim:      true,
            uppercase: true,
        },

        // ObjectId of the user who referred this account. Set once at signup.
        referredBy: {
            type:    Schema.Types.ObjectId,
            ref:     "User",
            default: null,
        },

        // True once the referral bonus has been granted. Single-use flag.
        referralRewardGranted: {
            type:    Boolean,
            default: false,
        },

        // Number of orders that have reached "delivered" status.
        deliveredOrderCount: {
            type:    Number,
            default: 0,
        },

        // ── First-order free delivery ─────────────────────────────────────────
        //
        // Set to true AFTER the first delivery order is successfully created
        // for this user.  The flag is written as a post-order step — never
        // before — so a failed order creation never consumes the benefit.
        //
        // Eligibility logic (see firstFreeDelivery.ts):
        //   eligible = firstDeliveryFreeUsed === false
        //              AND deliveredOrderCount === 0
        //
        // The deliveredOrderCount guard handles existing users who were created
        // before this field existed and therefore have firstDeliveryFreeUsed
        // as undefined/false in the DB despite already having placed orders.
        // Both conditions must be true; either one failing disqualifies the user.
        //
        // New users: firstDeliveryFreeUsed defaults to false, deliveredOrderCount
        // defaults to 0, so they qualify automatically on first delivery order.
        //
        // Existing users: deliveredOrderCount will be > 0 if they ever had an
        // order reach "delivered", so the guard catches them without a migration.
        firstDeliveryFreeUsed: {
            type:    Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Sparse unique index: users without a referralCode (null/undefined) don't clash.
UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true });

UserSchema.index({ phone: 1 });
UserSchema.index({ email: 1 });

const User = models.User || model("User", UserSchema);

export default User;