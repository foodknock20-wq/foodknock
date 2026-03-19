// src/lib/delivery.ts
// Flat-rate delivery logic — no Google Maps, no geocoding.

export const MIN_ORDER_AMOUNT  = 189;
export const FREE_DELIVERY_AT  = 339;
export const FLAT_DELIVERY_FEE = 29;
export const PLATFORM_FEE      = 1;

/**
 * Returns the delivery fee in ₹.
 * Free when subtotal ≥ FREE_DELIVERY_AT.
 */
export function calculateDeliveryFee(subtotal: number): number {
    return subtotal >= FREE_DELIVERY_AT ? 0 : FLAT_DELIVERY_FEE;
}

/**
 * Grand total = subtotal + deliveryFee + platformFee
 */
export function calculateGrandTotal(subtotal: number): number {
    return subtotal + calculateDeliveryFee(subtotal) + PLATFORM_FEE;
}

/**
 * How much more the user needs to add to unlock free delivery.
 * Returns 0 if already unlocked.
 */
export function amountToFreeDelivery(subtotal: number): number {
    return Math.max(0, FREE_DELIVERY_AT - subtotal);
}

// ── Loyalty redemption helpers ────────────────────────────────────────────────

/** ₹ value of 1 loyalty point (must match LOYALTY_CONFIG.POINT_VALUE_INR) */
export const POINT_VALUE_INR = 0.5;

/** Max fraction of grand total that can be paid with points */
export const MAX_REDEMPTION_PCT = 0.20;

/**
 * How many points the user is allowed to redeem against a given order.
 *
 * @param grandTotal   subtotal + deliveryFee + platformFee (before any discount)
 * @param userBalance  current loyalty point balance
 * @returns            maximum redeemable points (floored, never negative)
 */
export function maxRedeemablePoints(grandTotal: number, userBalance: number): number {
    const maxByOrder = Math.floor((grandTotal * MAX_REDEMPTION_PCT) / POINT_VALUE_INR);
    return Math.max(0, Math.min(userBalance, maxByOrder));
}

/**
 * Convert loyalty points to their ₹ equivalent.
 */
export function pointsToRupees(points: number): number {
    return Number((points * POINT_VALUE_INR).toFixed(2));
}

/**
 * Single source-of-truth for the amount charged to the customer.
 *
 * Used by:
 *   - /api/payment/create-order  (sets Razorpay order amount)
 *   - /api/payment/verify        (validates & records totalAmount)
 *   - checkout page UI           (displays payable total)
 *
 * @param subtotal          sum of item prices × quantities
 * @param deliveryFee       0 if pickup / first-free-delivery / free-delivery threshold reached
 * @param redeemedAmount    ₹ value of loyalty points the user is redeeming (≥ 0)
 * @returns                 amount in ₹, clamped to a minimum of ₹1
 *                          (Razorpay rejects zero-amount orders; a ₹1 floor is safe)
 */
export function calculateFinalAmount(
    subtotal:       number,
    deliveryFee:    number,
    redeemedAmount: number = 0,
): number {
    const gross = subtotal + deliveryFee + PLATFORM_FEE;
    // Never allow the redeemed amount to exceed the gross total
    const safeDiscount = Math.min(Math.max(0, redeemedAmount), gross);
    // Razorpay requires amount > 0; floor at ₹1
    return Math.max(1, gross - safeDiscount);
}