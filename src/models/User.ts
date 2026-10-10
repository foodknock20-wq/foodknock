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

// ── Saved addresses (Phase 9 — Account 2.0) ─────────────────────────────
// Additive array field, separate from the legacy single `address` object
// above (which is left untouched for backward compatibility with
// /api/auth/me and the checkout prefill). Each entry gets a real _id so
// it can be individually edited/deleted/defaulted. lat/lng are optional
// and unused today — reserved for Phase 10 (Location + Serviceability)
// so that phase doesn't need another schema migration.
const AddressItemSchema = new Schema(
    {
        label:                { type: String, trim: true, default: "" },
        flatNo:                { type: String, trim: true, default: "" },
        addressLine:           { type: String, trim: true, required: true },
        locality:              { type: String, trim: true, default: "" },
        city:                  { type: String, trim: true, required: true },
        state:                 { type: String, trim: true, required: true },
        pincode:               { type: String, trim: true, required: true },
        landmark:              { type: String, trim: true, default: "" },
        deliveryInstructions:  { type: String, trim: true, default: "" },
        lat:                   { type: Number, default: null },
        lng:                   { type: Number, default: null },
        isDefault:             { type: Boolean, default: false },
    },
    { timestamps: true }
);

// ── Forgot Password / OTP state ─────────────────────────────────────────
// Fully optional, additive subdocument. Existing user documents simply do
// not have this key until they first use the forgot-password flow —
// Mongoose treats it as undefined, which every field check below already
// accounts for (see src/lib/otp.ts helpers). No migration required.
const PasswordResetSchema = new Schema(
    {
        otpHash: { type: String, default: null },
        otpExpiresAt: { type: Date, default: null },
        otpAttempts: { type: Number, default: 0 },
        lockedUntil: { type: Date, default: null },
        requestCount: { type: Number, default: 0 },
        requestWindowStart: { type: Date, default: null },
        lastRequestedAt: { type: Date, default: null },
        resetTokenHash: { type: String, default: null },
        resetTokenExpiresAt: { type: Date, default: null },
    },
    { _id: false }
);

// ── Login brute-force protection state ──────────────────────────────────
// Fully optional, additive subdocument — same treatment as
// PasswordResetSchema above. Existing user documents simply do not have
// this key until their first login attempt is recorded; MongoDB's $inc
// creates the nested path automatically on first write, no migration
// required.
const LoginSecuritySchema = new Schema(
    {
        failedAttempts: { type: Number, default: 0 },
        lockedUntil: { type: Date, default: null },
    },
    { _id: false }
);

// ── Notification preferences (Feature 3, Part 6) ────────────────────────
// Fully optional, additive subdocument — same treatment as PasswordReset/
// LoginSecurity above. A user who signed up before this feature existed
// simply has no `notificationPreferences` key at all; every read path
// (see src/lib/notifications/preferences.ts) merges whatever is stored
// with NOTIFICATION_PREFERENCE_DEFAULTS, so a missing subdocument reads
// as "everything ON" — matching the spec ("Everything ON by default")
// without requiring a migration. Individual keys default to `true` here
// too, so even a partially-set subdocument behaves correctly for every
// other field.
const NotificationPreferencesSchema = new Schema(
    {
        orderUpdates:   { type: Boolean, default: true },
        offers:         { type: Boolean, default: true },
        rewards:        { type: Boolean, default: true },
        lunchDeals:     { type: Boolean, default: true },
        eveningDeals:   { type: Boolean, default: true },
        festivalOffers: { type: Boolean, default: true },
        flashSales:     { type: Boolean, default: true },
        priceDrops:     { type: Boolean, default: true },
        systemUpdates:  { type: Boolean, default: true },
    },
    { _id: false }
);

const UserSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        dob: { type: Date, required: false },
        email: {
            type: String, required: true, unique: true, lowercase: true, trim: true,
        },
        phone: { type: String, required: true, trim: true },
        password: { type: String, required: true },
        role: { type: String, enum: ["user", "admin"], default: "user" },
        address: AddressSchema,
        addresses: { type: [AddressItemSchema], default: [] },
        isActive: { type: Boolean, default: true },

        loyaltyPoints: { type: Number, default: 0 },
        referralCode: { type: String, trim: true, uppercase: true },
        referredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        referralRewardGranted: { type: Boolean, default: false },
        deliveredOrderCount: { type: Number, default: 0 },
        firstDeliveryFreeUsed: { type: Boolean, default: false },

        // Forgot Password / OTP state — optional, see PasswordResetSchema above.
        passwordReset: { type: PasswordResetSchema, default: undefined },

        // Login brute-force protection — optional, see LoginSecuritySchema above.
        loginSecurity: { type: LoginSecuritySchema, default: undefined },

        // Notification preferences — optional, see NotificationPreferencesSchema above.
        notificationPreferences: { type: NotificationPreferencesSchema, default: undefined },
    },
    { timestamps: true }
);

// ✅ Referral code unique + sparse
UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true });

// ✅ Phone index (fast lookup)
UserSchema.index({ phone: 1 });

// ❌ REMOVED THIS (duplicate)
// UserSchema.index({ email: 1 });

// ── Stale-model guard (Next.js dev-server hot-reload safety) ─────────────
// `mongoose.models.User` persists across hot reloads in dev. If the User
// model was ever compiled BEFORE a given field existed, the cached model
// is missing that path entirely — any $set against it is silently dropped
// under Mongoose's default strict mode. Detect that stale state and force
// a clean recompilation. No-op in any environment where the model is
// compiled fresh (every production cold start, and any dev session
// started after these fields were added).
if (
    models.User &&
    (!models.User.schema.path("loginSecurity") ||
        !models.User.schema.path("notificationPreferences") ||
        !models.User.schema.path("addresses"))
) {
    mongoose.deleteModel("User");
}

const User = models.User || model("User", UserSchema);

export default User;