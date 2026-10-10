// src/lib/coupons.ts
//
// Phase 11 — THE single authoritative place coupon validity and discount
// amount are decided. Every caller (the customer-facing preview endpoint,
// /api/payment/create-order, /api/orders/cod, and createOrderCore's final
// re-check) calls validateCoupon()/calculateCouponDiscount() here. Never
// reimplement this logic per-caller — same discipline Phase 2A applied to
// item pricing and Phase 10 applied to distance/serviceability.
//
// ── TRUST MODEL ──────────────────────────────────────────────────────────
// validateCoupon() is READ-ONLY — it never mutates usedCount or creates a
// CouponRedemption. It's safe to call as many times as needed (preview,
// create-order, verify) purely to compute "is this valid right now and
// what's the discount" without side effects.
//
// reserveCouponUsage() is the ONLY function that mutates usage state, and
// it does so atomically (mirrors createOrderCore's existing stock-decrement
// pattern — a single conditional findOneAndUpdate, not read-then-write).
// It must be called exactly once, immediately before Order.create, and
// ONLY from createOrderCore — never from a "validate" or "preview" step,
// because a coupon must never be consumed by a payment that then fails or
// is abandoned (Phase 11 spec §21).
//
// ── WHY NO MONGO TRANSACTIONS ────────────────────────────────────────────
// Same constraint documented in loyaltyService.ts: this deployment's Atlas
// tier doesn't reliably support multi-document transactions. The global
// usage limit is protected by one atomic $inc guarded by a $lt condition
// (exactly like Product.stock). The per-user limit (capped at 1 for Phase
// 11 — see Coupon.ts) is protected by CouponRedemption's unique index,
// which gives a TRUE race-proof guarantee without needing a transaction at
// all: the database's own unique-index enforcement IS the lock.

import mongoose from "mongoose";
import Coupon, { type CouponDiscountType, type CouponSource } from "@/models/Coupon";
import CouponRedemption from "@/models/CouponRedemption";
import { generateCouponCode, normalizeCouponCode } from "@/lib/couponCode";

export type CouponInvalidReason =
    | "NOT_FOUND"
    | "PAUSED"
    | "NOT_YET_ACTIVE"
    | "EXPIRED"
    | "USAGE_LIMIT_REACHED"
    | "ALREADY_USED_BY_USER"
    | "MIN_ORDER_NOT_MET"
    | "LOGIN_REQUIRED";

export type CouponValidationResult =
    | {
          valid: true;
          couponId: string;
          code: string;
          discountType: CouponDiscountType;
          discountValue: number;
          maximumDiscount: number | null;
          discountAmount: number;
          /** Phase 12 — true for FREE_DELIVERY coupons: deliveryFee should be
           *  zeroed instead of discounting the subtotal. discountAmount is
           *  always 0 in that case (subtotal is never touched). */
          freeDelivery: boolean;
      }
    | {
          valid: false;
          reason: CouponInvalidReason;
          message: string;
      };

type CouponLean = {
    _id: mongoose.Types.ObjectId;
    code: string;
    discountType: CouponDiscountType;
    discountValue: number;
    minimumOrderValue: number;
    maximumDiscount: number | null;
    usageLimit: number | null;
    usedCount: number;
    status: "ACTIVE" | "PAUSED";
    startsAt: Date | null;
    expiresAt: Date | null;
};

/**
 * FIXED: flat value. PERCENTAGE: subtotal × value/100, capped at
 * maximumDiscount, never exceeding subtotal. FREE_DELIVERY never discounts
 * the subtotal at all (0) — it's handled by zeroing deliveryFee at the
 * call site instead (see createOrderCore.ts).
 */
export function calculateCouponDiscount(
    subtotal: number,
    discountType: CouponDiscountType,
    discountValue: number,
    maximumDiscount: number | null
): number {
    if (discountType === "FREE_DELIVERY") return 0;
    const raw = discountType === "FIXED" ? discountValue : (subtotal * discountValue) / 100;
    const capped = maximumDiscount != null ? Math.min(raw, maximumDiscount) : raw;
    // Never exceed the subtotal itself and never go negative.
    return Math.max(0, Math.min(Number(capped.toFixed(2)), subtotal));
}

/**
 * Read-only authoritative check. `userId` null means "not logged in" —
 * checkout requires login for every order path in this codebase (Phase 9),
 * so this surfaces as a clear, distinct reason rather than silently
 * skipping the per-user check.
 */
export async function validateCoupon(params: {
    code: string;
    subtotal: number;
    userId: string | null;
}): Promise<CouponValidationResult> {
    const normalized = normalizeCouponCode(params.code);

    if (!normalized) {
        return { valid: false, reason: "NOT_FOUND", message: "That coupon code isn't valid." };
    }

    const coupon = await Coupon.findOne({ code: normalized }).lean<CouponLean>();
    if (!coupon) {
        return { valid: false, reason: "NOT_FOUND", message: "That coupon code isn't valid." };
    }

    if (coupon.status === "PAUSED") {
        return { valid: false, reason: "PAUSED", message: "This coupon isn't available right now." };
    }

    const now = Date.now();
    if (coupon.startsAt && coupon.startsAt.getTime() > now) {
        return { valid: false, reason: "NOT_YET_ACTIVE", message: "This coupon isn't active yet." };
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < now) {
        return { valid: false, reason: "EXPIRED", message: "This coupon has expired." };
    }

    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
        return { valid: false, reason: "USAGE_LIMIT_REACHED", message: "This coupon is no longer available." };
    }

    if (!params.userId) {
        return { valid: false, reason: "LOGIN_REQUIRED", message: "Please log in to use a coupon." };
    }

    const alreadyUsed = await CouponRedemption.exists({ coupon: coupon._id, user: params.userId });
    if (alreadyUsed) {
        return { valid: false, reason: "ALREADY_USED_BY_USER", message: "You've already used this coupon." };
    }

    if (params.subtotal < coupon.minimumOrderValue) {
        const shortfall = Math.ceil(coupon.minimumOrderValue - params.subtotal);
        return {
            valid: false,
            reason: "MIN_ORDER_NOT_MET",
            message: `Add ₹${shortfall} more to use this coupon.`,
        };
    }

    const discountAmount = calculateCouponDiscount(
        params.subtotal,
        coupon.discountType,
        coupon.discountValue,
        coupon.maximumDiscount
    );

    return {
        valid: true,
        couponId: String(coupon._id),
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maximumDiscount: coupon.maximumDiscount,
        discountAmount,
        freeDelivery: coupon.discountType === "FREE_DELIVERY",
    };
}

/**
 * THE atomic mutation. Call exactly once, immediately before Order.create,
 * only from createOrderCore. Throws (with .status=400) if the coupon is no
 * longer usable at this exact instant — the caller must treat that
 * identically to a stock-decrement failure (order creation aborts).
 */
export async function reserveCouponUsage(params: {
    couponId: string;
    userId: string;
    discountAmount: number;
}): Promise<{ redemptionId: string }> {
    // Step 1 — atomic global-limit reserve. Mirrors Product's
    // findOneAndUpdate({stock:{$gte:qty}}, {$inc:{stock:-qty}}) exactly:
    // the database, not application code, decides whether a slot existed
    // at the instant of the write.
    const reserved = await Coupon.findOneAndUpdate(
        {
            _id: params.couponId,
            status: "ACTIVE",
            $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
    );

    if (!reserved) {
        throw Object.assign(new Error("This coupon is no longer available."), { status: 400 });
    }

    // Step 2 — atomic per-user reserve via the unique index. If this
    // throws E11000, someone else (or this same user, duplicate request)
    // already holds this coupon's one-and-only redemption slot.
    try {
        const redemption = await CouponRedemption.create({
            coupon: params.couponId,
            user: params.userId,
            discountAmount: params.discountAmount,
        });
        return { redemptionId: String(redemption._id) };
    } catch (err) {
        // Roll back step 1 — this reservation never happened.
        await Coupon.updateOne({ _id: params.couponId }, { $inc: { usedCount: -1 } }).catch((rollbackErr) =>
            console.error("COUPON_USAGE_ROLLBACK_FAILED", { couponId: params.couponId, error: rollbackErr })
        );

        if ((err as { code?: number })?.code === 11000) {
            throw Object.assign(new Error("You've already used this coupon."), { status: 400 });
        }
        throw err;
    }
}

/** Compensating rollback — order creation failed AFTER reserveCouponUsage succeeded. */
export async function releaseCouponUsage(params: { couponId: string; redemptionId: string }): Promise<void> {
    await Promise.all([
        Coupon.updateOne({ _id: params.couponId }, { $inc: { usedCount: -1 } }),
        CouponRedemption.deleteOne({ _id: params.redemptionId }),
    ]).catch((err) =>
        console.error("COUPON_USAGE_RELEASE_FAILED", { couponId: params.couponId, redemptionId: params.redemptionId, error: err })
    );
}

/**
 * Phase 12 — system-issued single-use coupon (Spin rewards, future campaign
 * offers). This is NOT the admin creation path (src/lib/adminCoupons.ts) —
 * no admin-facing validation UX, always usageLimit:1/perUserLimit:1, always
 * tagged with a `source` for analytics. Goes through the exact same
 * Coupon collection and validateCoupon()/reserveCouponUsage() path as any
 * manually-created coupon — this is reuse, not a second coupon system.
 */
export async function issueSystemCoupon(params: {
    discountType: CouponDiscountType;
    discountValue: number;
    minimumOrderValue?: number;
    maximumDiscount?: number | null;
    expiresInDays: number;
    source: CouponSource;
    campaignId?: string | null;
    offerId?: string | null;
    description?: string;
}): Promise<{ couponId: string; code: string }> {
    let code = generateCouponCode();
    for (let attempt = 0; attempt < 5 && (await Coupon.exists({ code })); attempt++) {
        code = generateCouponCode();
    }

    const expiresAt = new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000);

    const doc = await Coupon.create({
        code,
        discountType: params.discountType,
        discountValue: params.discountValue,
        minimumOrderValue: params.minimumOrderValue ?? 0,
        maximumDiscount: params.maximumDiscount ?? null,
        usageLimit: 1,
        perUserLimit: 1,
        status: "ACTIVE",
        expiresAt,
        source: params.source,
        campaignId: params.campaignId ?? null,
        offerId: params.offerId ?? null,
        description: params.description ?? "",
    });

    return { couponId: String(doc._id), code: doc.code };
}

/** Best-effort — links a committed redemption to its now-existing order. Never blocks/fails order creation. */
export async function linkCouponRedemptionToOrder(redemptionId: string, orderId: string): Promise<void> {
    await CouponRedemption.updateOne({ _id: redemptionId }, { $set: { order: orderId } }).catch((err) =>
        console.error("COUPON_REDEMPTION_LINK_ORDER_FAILED", { redemptionId, orderId, error: err })
    );
}
