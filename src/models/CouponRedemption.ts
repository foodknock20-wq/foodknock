// src/models/CouponRedemption.ts
//
// Phase 11 — the atomicity primitive for per-user coupon limits. Phase 11
// restricts perUserLimit to exactly 1 (see Coupon.ts header), which this
// model enforces with a TRUE race-proof guarantee via a unique compound
// index: two concurrent requests for the same (coupon, user) can both
// attempt an insert, but MongoDB's unique index rejects the second with
// E11000 — no read-then-write gap, no transaction needed. This is the
// same "let the DB's index be the lock" philosophy loyaltyService.ts
// documents for why this deployment avoids multi-document transactions.
//
// Lifecycle: created atomically alongside the Coupon.usedCount increment
// (src/lib/coupons.ts's reserveCouponUsage), BEFORE Order.create — `order`
// starts null and is backfilled after the order is successfully created.
// If order creation fails afterward, this document is deleted as part of
// the same compensating rollback that decrements Coupon.usedCount back
// (mirrors createOrderCore's existing stock-decrement rollback pattern).

import { Schema, model, models } from "mongoose";

const CouponRedemptionSchema = new Schema(
    {
        coupon: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
        user:   { type: Schema.Types.ObjectId, ref: "User",   required: true },
        order:  { type: Schema.Types.ObjectId, ref: "Order",  default: null },

        // Snapshot — survives the coupon being later edited/deleted.
        discountAmount: { type: Number, required: true, min: 0 },
    },
    { timestamps: true }
);

// THE atomicity guarantee for perUserLimit=1 — one redemption per
// (coupon, user) ever, enforced by the database itself.
CouponRedemptionSchema.index({ coupon: 1, user: 1 }, { unique: true });

const CouponRedemption = models.CouponRedemption || model("CouponRedemption", CouponRedemptionSchema);

export default CouponRedemption;
