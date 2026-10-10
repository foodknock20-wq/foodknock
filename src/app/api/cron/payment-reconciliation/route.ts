export const dynamic = "force-dynamic";

// src/app/api/cron/payment-reconciliation/route.ts
//
// Phase 17.1A (audit finding F1) — scheduled, bounded, detection-only
// background scan for Razorpay payments captured without a matching
// FoodKnock order. Mirrors the existing /api/push/send-campaign cron's
// auth pattern exactly (Bearer CRON_SECRET, fail-closed if unset).
//
// DELIBERATELY DOES NOT AUTO-CREATE ORDERS. scanForOrphanedPayments()
// only ever: (a) self-heals a PendingPayment whose order already exists
// elsewhere, (b) extends retention so evidence survives, and (c) flags a
// genuinely orphaned, captured payment "pending_review" for an admin to
// act on via the admin-gated recover/dismiss endpoints. See
// src/lib/paymentReconciliation.ts's header comment and the Phase 17.1A
// delivery report for the full rationale behind keeping actual order
// creation admin-triggered only.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { scanForOrphanedPayments } from "@/lib/paymentReconciliation";

export async function POST(req: NextRequest) {
    try {
        const cronSecret = process.env.CRON_SECRET;
        const authHeader = req.headers.get("authorization");

        if (!cronSecret) {
            console.error("PAYMENT_RECONCILIATION_CRON_ERROR: CRON_SECRET missing in environment");
            return NextResponse.json({ success: false, message: "CRON_SECRET is not configured" }, { status: 500 });
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            console.error("PAYMENT_RECONCILIATION_CRON_ERROR: Unauthorized cron request");
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const summary = await scanForOrphanedPayments();

        console.log("PAYMENT_RECONCILIATION_CRON_SUMMARY", summary);
        return NextResponse.json({ success: true, summary });
    } catch (error) {
        // A transient DB/provider error during the scan must not be
        // reported as success, and must not crash in a way that leaves no
        // trace — log loudly, ack with a clear failure so monitoring can
        // alert, and let the next scheduled tick retry naturally (the scan
        // is idempotent — see isReconcileCandidate in paymentReconciliationLogic.ts).
        console.error("PAYMENT_RECONCILIATION_CRON_UNHANDLED_ERROR", error);
        return NextResponse.json({ success: false, message: "Scan failed" }, { status: 500 });
    }
}

// Allow the same manual-trigger convenience the push-campaign cron offers
// (GET delegates to POST) — still fully gated by the same CRON_SECRET
// check inside POST, nothing here bypasses it.
export async function GET(req: NextRequest) {
    return POST(req);
}
