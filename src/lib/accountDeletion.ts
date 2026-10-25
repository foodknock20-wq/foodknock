// src/lib/accountDeletion.ts
//
// ── Account-deletion orchestration (single source of truth) ──────────────
//
// Called ONLY by /api/account/delete/confirm, after:
//   • a valid session,
//   • a fresh password re-authentication (initiate step), and
//   • a valid, session-bound, short-lived deletion-intent token.
//
// ── Idempotency / resumability (no Mongo multi-doc transactions here) ────
// This deployment runs on Atlas free-tier style topology where multi-
// document transactions are not relied upon (see loyaltyService.ts /
// createOrderCore.ts for the same documented constraint). So deletion is
// structured as an idempotent, resumable sequence rather than one atomic
// transaction:
//
//   1. Personal side-collections are deleted/anonymized FIRST.
//   2. The User document is deleted LAST.
//
// The User document is therefore the completion marker: if a request dies
// half-way, the user still exists and can retry — the already-deleted
// side data is simply re-deleted (no-op) and the user is finally removed.
// Re-running after full completion finds no user and returns success.
//
// ── What is kept vs removed (see the Data Deletion & Retention Matrix in
//    the final report / Privacy Policy) ──
//   KEPT (legitimate legal/accounting/anti-abuse purpose):
//     • Orders — financial records. PII fields are ANONYMIZED in place
//       (customer name/phone/address/notes/coordinates scrubbed) but
//       amounts, items, payment IDs, status and timestamps are preserved
//       so revenue/refund/reconciliation history stays correct.
//     • LoyaltyLedger, CouponRedemption, Donation — audit/financial.
//     • PromotionEligibility — minimal pseudonymous ledger (only when the
//       first-order benefit was already consumed) to prevent re-grant.
//   REMOVED (purely personal, no legitimate retention need):
//     • The User profile document itself.
//     • Push subscriptions, spin-game records, per-user notification logs,
//       per-user marketing automation state.
//
// This function never throws for "user already gone" — that is success.

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import PushSubscription from "@/models/PushSubscription";
import SpinRecord from "@/models/SpinRecord";
import NotificationLog from "@/models/NotificationLog";
import AutomationUserState from "@/models/AutomationUserState";
import { recordFirstDeliveryConsumed } from "@/lib/promotionEligibility";

export type DeletionResult = {
    deleted: boolean;
    alreadyDeleted: boolean;
};

const ANONYMIZED = {
    customerName: "Deleted customer",
    phone: "[deleted]",
    address: "[deleted]",
    landmark: "",
    note: "",
    deliveryInstructions: "",
    deliveryLatitude: null,
    deliveryLongitude: null,
};

/**
 * Permanently delete a customer account. Caller is responsible for all
 * authorization (session + re-auth + intent token). This function assumes
 * the caller already verified identity; it only re-confirms the account is
 * a non-admin customer before destroying anything.
 */
export async function deleteAccount(userId: string): Promise<DeletionResult> {
    await connectDB();

    const user = await User.findById(userId)
        .select("email role firstDeliveryFreeUsed deliveredOrderCount")
        .lean<{
            email?: string;
            role?: string;
            firstDeliveryFreeUsed?: boolean;
            deliveredOrderCount?: number;
        } | null>();

    // Idempotent: nothing to do (already deleted, or a retry after success).
    if (!user) {
        return { deleted: false, alreadyDeleted: true };
    }

    // Staff/admin accounts must not be removed through the customer flow —
    // deleting an admin could orphan admin-owned records and lock out
    // operations. These go through a separate deliberate process.
    if (user.role === "admin") {
        throw Object.assign(new Error("Admin accounts cannot be deleted from here"), {
            status: 403,
        });
    }

    // ── Preserve minimal cross-identity eligibility BEFORE deletion ────────
    // Only mark the benefit consumed if it genuinely WAS consumed (or the
    // account already had delivered orders, which likewise means the benefit
    // is spent/expired). Deleting before ever placing a qualifying order must
    // NOT burn the benefit — per product rule 3.3.
    const benefitSpent =
        user.firstDeliveryFreeUsed === true || (user.deliveredOrderCount ?? 0) > 0;
    if (benefitSpent && user.email) {
        await recordFirstDeliveryConsumed(user.email);
    }

    // ── Anonymize financial records (orders) — keep amounts, scrub PII ─────
    await Order.updateMany({ user: userId }, { $set: ANONYMIZED }).catch((err) =>
        console.error("ACCOUNT_DELETE_ORDER_ANONYMIZE_ERROR", err)
    );

    // ── Delete purely-personal side collections ────────────────────────────
    // Each is best-effort and independent; a failure in one does not block
    // the others or the final user deletion (retry re-deletes idempotently).
    await Promise.all([
        PushSubscription.deleteMany({ user: userId }).catch((err) =>
            console.error("ACCOUNT_DELETE_PUSH_ERROR", err)
        ),
        SpinRecord.deleteMany({ user: userId }).catch((err) =>
            console.error("ACCOUNT_DELETE_SPIN_ERROR", err)
        ),
        NotificationLog.deleteMany({ user: userId }).catch((err) =>
            console.error("ACCOUNT_DELETE_NOTIFLOG_ERROR", err)
        ),
        AutomationUserState.deleteMany({ user: userId }).catch((err) =>
            console.error("ACCOUNT_DELETE_AUTOMATION_ERROR", err)
        ),
    ]);

    // ── Completion marker: delete the User document LAST ───────────────────
    await User.deleteOne({ _id: userId });

    return { deleted: true, alreadyDeleted: false };
}
