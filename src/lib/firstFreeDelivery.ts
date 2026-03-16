// src/lib/firstFreeDelivery.ts
//
// Shared helper used by BOTH order-creation routes:
//   - /api/payment/verify  (Razorpay + COD via payment flow)
//   - /api/orders          (legacy direct COD)
//
// ── Why the old implementation was broken ────────────────────────────────────
//
// The previous version ran a single function that:
//   1. Atomically set firstDeliveryFreeUsed = true   ← benefit consumed HERE
//   2. Returned eligible: true
//   ... then the caller tried to create the order
//
// If Order.create() (or any step after) threw an error, the benefit was already
// gone.  The user lost their free delivery with nothing to show for it.
//
// ── Fixed design (two-phase) ─────────────────────────────────────────────────
//
//   Phase 1 — checkFirstFreeDelivery()   READ-ONLY eligibility check.
//             Does NOT mutate the user.  Safe to call before order creation.
//
//   Phase 2 — consumeFirstFreeDelivery() Called AFTER Order.create() succeeds.
//             Performs the atomic CAS write.  If this step fails the user
//             keeps the benefit and can retry — the order was already saved
//             with deliveryFee = 0, so the business cost is the same either way.
//
// ── Existing-user guard ───────────────────────────────────────────────────────
//
// Users created before firstDeliveryFreeUsed existed have it as undefined/false
// in MongoDB despite potentially having many past orders.  We guard against this
// by also requiring deliveredOrderCount === 0.  Both conditions must be true.
//
//   eligible = firstDeliveryFreeUsed === false
//              AND deliveredOrderCount === 0
//
// This is purely a read-time check — no migration script required.

import User from "@/models/User";

// ─── Phase 1: Read-only eligibility check ────────────────────────────────────
//
// Call this BEFORE creating the order.  Returns whether the benefit applies.
// Does NOT mutate any document.
//
// Rules:
//   1. Must be a logged-in user  (linkedUserId !== null)
//   2. Must be a delivery order  (orderType === "delivery")
//   3. firstDeliveryFreeUsed must be false  (flag not yet consumed)
//   4. deliveredOrderCount must be 0        (no prior delivered orders — old-user guard)
export async function checkFirstFreeDelivery(
    linkedUserId: string | null,
    orderType: string
): Promise<{ eligible: boolean }> {
    if (!linkedUserId)              return { eligible: false };
    if (orderType !== "delivery")   return { eligible: false };

    const user = await User.findOne({
        _id:                   linkedUserId,
        firstDeliveryFreeUsed: false,
        deliveredOrderCount:   0,
    })
        .select("_id")
        .lean();

    return { eligible: user !== null };
}

// ─── Phase 2: Consume the benefit ────────────────────────────────────────────
//
// Call this AFTER Order.create() succeeds.
// Uses an atomic compare-and-set so concurrent requests cannot double-consume:
//   findOneAndUpdate({ _id, firstDeliveryFreeUsed: false, deliveredOrderCount: 0 })
// Only one winner gets a non-null result.  If the CAS fails (already consumed
// or deliveredOrderCount advanced since Phase 1), it's a silent no-op — the
// order was already saved with deliveryFee = 0 so no corrective action needed.
//
// Errors here are non-fatal and must be caught by the caller.
export async function consumeFirstFreeDelivery(
    linkedUserId: string | null
): Promise<void> {
    if (!linkedUserId) return;

    await User.findOneAndUpdate(
        {
            _id:                   linkedUserId,
            firstDeliveryFreeUsed: false,
            deliveredOrderCount:   0,
        },
        { $set: { firstDeliveryFreeUsed: true } }
    );
    // Intentionally no return value — callers treat this as fire-and-forget
    // after order creation.  A failed write here is acceptable: the user simply
    // gets another eligibility check on their next order, and since
    // deliveredOrderCount will be > 0 by then (after their first delivered
    // order), they won't qualify anyway.
}