export const dynamic = "force-dynamic";

// src/app/api/admin/payment-reconciliation/[id]/recover/route.ts
//
// Phase 17.1A (audit finding F1) — admin-triggered recovery attempt for
// one orphaned-payment case. Thin wrapper: all the actual safety logic
// (fresh Razorpay re-verification, amount/currency match, existing-order
// check, atomic claim, canonical createOrderCore reuse, verified-outcome
// read-back) lives in src/lib/paymentReconciliation.ts's attemptRecovery()
// — this route only enforces admin authorization and input validation.

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { attemptRecovery } from "@/lib/paymentReconciliation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
    }

    try {
        await connectDB();
        const { id } = await params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid reconciliation record id" }, { status: 400 });
        }

        const outcome = await attemptRecovery(id, admin.userId);

        if (outcome.ok) {
            return NextResponse.json({
                success: true,
                alreadyResolved: outcome.alreadyResolved,
                orderId: outcome.orderId,
            });
        }

        const statusByReason: Record<string, number> = {
            not_found: 404,
            already_terminal: 409,
            not_captured: 409,
            amount_mismatch: 409,
            currency_mismatch: 409,
            claim_lost_still_processing: 202,
            recovery_failed: 500,
        };

        return NextResponse.json(
            { success: false, reason: outcome.reason, message: outcome.message },
            { status: statusByReason[outcome.reason] ?? 500 }
        );
    } catch (error) {
        console.error("ADMIN_PAYMENT_RECONCILIATION_RECOVER_ERROR", error);
        return NextResponse.json({ success: false, message: "Recovery attempt failed unexpectedly" }, { status: 500 });
    }
}
