export const dynamic = "force-dynamic";

// src/app/api/admin/payment-reconciliation/[id]/dismiss/route.ts
//
// Phase 17.1A (audit finding F1) — explicit admin disposition of a
// flagged case WITHOUT creating an order (e.g. confirmed manually
// refunded via the Razorpay dashboard, confirmed duplicate of a real
// order, confirmed to require no further action). Requires a note — see
// dismissReconciliation()'s own validation; this is a financial audit
// trail, not a silent close.

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { dismissReconciliation } from "@/lib/paymentReconciliation";

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

        const body = await req.json().catch(() => ({}));
        const note = typeof body?.note === "string" ? body.note : "";

        const outcome = await dismissReconciliation(id, admin.userId, note);
        return NextResponse.json(
            { success: outcome.ok, message: outcome.message },
            { status: outcome.ok ? 200 : 400 }
        );
    } catch (error) {
        console.error("ADMIN_PAYMENT_RECONCILIATION_DISMISS_ERROR", error);
        return NextResponse.json({ success: false, message: "Dismiss action failed unexpectedly" }, { status: 500 });
    }
}
