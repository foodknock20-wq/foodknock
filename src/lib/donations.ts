// src/lib/donations.ts
//
// Pre-Phase 17 — Phase 2: Street Animal Support donation. Shared, server-
// only helpers used by both the donation API routes and the extended
// Razorpay webhook. Keeps donation reconciliation logic in ONE place
// rather than duplicated between /api/donations/verify and the webhook,
// mirroring the existing src/lib/paymentReconciliation.ts pattern for the
// food-order flow — but simpler, because settling a donation has no further
// side effects (no order to create), so claim + completion happen in a
// single atomic update.

import Donation from "@/models/Donation";
import { MIN_DONATION_AMOUNT, MAX_DONATION_AMOUNT } from "@/lib/constants";

/**
 * Validates a client-supplied rupee amount and converts it to integer paise.
 * Returns null for anything invalid — NEVER trust the caller's amount
 * beyond what this returns. Whole rupees only (no float/paise fractions
 * from the client) — avoids floating-point money bugs entirely since every
 * valid result is amount*100, an exact integer.
 */
export function validateDonationAmountToPaise(amount: unknown): number | null {
    if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
    if (!Number.isInteger(amount)) return null;
    if (amount < MIN_DONATION_AMOUNT || amount > MAX_DONATION_AMOUNT) return null;
    return amount * 100;
}

/** Short, unique-enough Razorpay receipt string — never derived from client input. */
export function donationReceipt(): string {
    return `don_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
}

export type DonationDoc = {
    _id: unknown;
    userId: unknown;
    amountPaise: number;
    status: "pending" | "success" | "failed" | "cancelled";
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    verifiedAt: Date | null;
};

/**
 * Atomically transitions a pending Donation to SUCCESS. Guarded by
 * {razorpayPaymentId: {$exists:false}, status:"pending"} — only the first
 * caller (client /verify or webhook, whichever runs first) ever wins this
 * update; the other gets null back and must treat the donation as already
 * handled (idempotent re-read), never double-count it.
 */
export async function settleDonationSuccess(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    expectedOwnerId?: string
): Promise<DonationDoc | null> {
    const filter: Record<string, unknown> = {
        razorpayOrderId,
        razorpayPaymentId: { $exists: false },
        status: "pending",
    };
    if (expectedOwnerId) filter.userId = expectedOwnerId;

    return Donation.findOneAndUpdate(
        filter,
        { $set: { razorpayPaymentId, status: "success", verifiedAt: new Date() } },
        { new: true }
    ).lean<DonationDoc>();
}

export async function markDonationFailed(razorpayOrderId: string, reason: string): Promise<void> {
    await Donation.updateOne(
        { razorpayOrderId, status: "pending" },
        { $set: { status: "failed", failureReason: reason } }
    ).catch((err) => console.error("DONATION_MARK_FAILED_ERROR", { razorpayOrderId, err }));
}

/**
 * Webhook entry point for donation reconciliation. Returns true if
 * `razorpayOrderId` belongs to a Donation (caller should stop — this was
 * NOT a food-order payment, don't fall through to that logic). Returns
 * false if no matching Donation exists at all, meaning the webhook should
 * proceed with its normal food-order handling untouched.
 */
export async function handleDonationWebhookEvent(
    eventType: string,
    razorpayOrderId: string | undefined,
    razorpayPaymentId: string | undefined,
    amountPaise: number | undefined
): Promise<boolean> {
    if (!razorpayOrderId) return false;

    const donation = await Donation.findOne({ razorpayOrderId })
        .select("_id status amountPaise")
        .lean<{ _id: unknown; status: string; amountPaise: number } | null>();

    if (!donation) return false; // not a donation payment — let food-order logic handle it

    if (eventType === "payment.captured") {
        if (donation.status === "success") return true; // already reconciled — idempotent ack

        if (typeof amountPaise === "number" && amountPaise !== donation.amountPaise) {
            console.error("DONATION_WEBHOOK_AMOUNT_MISMATCH", {
                razorpayOrderId, expected: donation.amountPaise, reported: amountPaise,
            });
            await markDonationFailed(razorpayOrderId, "webhook_amount_mismatch");
            return true;
        }

        if (razorpayPaymentId) {
            await settleDonationSuccess(razorpayOrderId, razorpayPaymentId);
        }
        return true;
    }

    if (eventType === "payment.failed") {
        await markDonationFailed(razorpayOrderId, "razorpay_payment_failed");
        return true;
    }

    return true; // some other event type for a donation's Razorpay order — ack, nothing to do
}
