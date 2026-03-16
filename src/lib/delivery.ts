// src/lib/delivery.ts
// Flat-rate delivery logic — no Google Maps, no geocoding.

export const MIN_ORDER_AMOUNT  = 130;
export const FREE_DELIVERY_AT  = 300;
export const FLAT_DELIVERY_FEE = 20;
export const PLATFORM_FEE      = 10;

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