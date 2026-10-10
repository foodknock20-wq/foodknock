export const dynamic = "force-dynamic";

// src/app/api/admin/payment-reconciliation/route.ts
//
// Phase 17.1A (audit finding F1) — admin-only, paginated list of
// PendingPayment rows that reconciliation has touched (or that are
// currently a live candidate for it). Read-only. Mirrors the existing
// admin/donations list pattern: bounded server-side pagination, no
// unbounded query, never exposes more than the operational fields an
// admin needs (no raw Razorpay payloads, no unnecessary customer PII
// beyond what's already needed to recognize the checkout).

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import PendingPayment from "@/models/PendingPayment";
import { parseAdminPagination, buildPaginationMeta } from "@/lib/adminPagination";

const VALID_STATES = ["all", "pending_review", "recovered", "recovery_failed", "dismissed", "unreviewed"] as const;

export async function GET(req: NextRequest) {
    try {
        const admin = await requireAdmin(req);
        if (!admin) {
            return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
        }

        await connectDB();

        const searchParams = req.nextUrl.searchParams;
        const { page, limit, skip } = parseAdminPagination(searchParams, { defaultLimit: 25, maxLimit: 100 });

        const stateParam = searchParams.get("state") ?? "pending_review";
        const state = (VALID_STATES as readonly string[]).includes(stateParam) ? stateParam : "pending_review";
        const search = (searchParams.get("search") ?? "").trim().slice(0, 100);

        const filter: Record<string, unknown> = {};
        if (state === "unreviewed") {
            filter.reconciliationState = null;
            filter.status = { $in: ["created", "failed"] };
        } else if (state !== "all") {
            filter.reconciliationState = state;
        } else {
            filter.reconciliationState = { $ne: null };
        }
        if (search) {
            filter.$or = [
                { razorpayOrderId: { $regex: search, $options: "i" } },
                { razorpayPaymentId: { $regex: search, $options: "i" } },
                { "payload.customerName": { $regex: search, $options: "i" } },
                { "payload.phone": { $regex: search, $options: "i" } },
            ];
        }

        const [rows, total] = await Promise.all([
            PendingPayment.find(filter)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .select(
                    "razorpayOrderId razorpayPaymentId status expectedAmount orderId createdAt expiresAt " +
                    "reconciliationState reviewReason reviewNote reviewedAt recoveryAttempts lastRecoveryError " +
                    "payload.customerName payload.phone"
                )
                .lean(),
            PendingPayment.countDocuments(filter),
        ]);

        const items = (rows as Array<Record<string, unknown>>).map((r) => ({
            id:                 String(r._id),
            razorpayOrderId:    r.razorpayOrderId,
            razorpayPaymentId:  r.razorpayPaymentId ?? null,
            status:             r.status,
            expectedAmount:     r.expectedAmount,
            orderId:            r.orderId ?? null,
            customerName:       (r.payload as { customerName?: string } | undefined)?.customerName ?? "—",
            // Last 4 digits only — enough for an admin to recognize the
            // customer against a support ticket without exposing the full
            // phone number in a list view.
            phoneLast4:         String((r.payload as { phone?: string } | undefined)?.phone ?? "").slice(-4),
            createdAt:          r.createdAt,
            expiresAt:          r.expiresAt ?? null,
            reconciliationState: r.reconciliationState ?? null,
            reviewReason:       r.reviewReason ?? null,
            reviewNote:         r.reviewNote ?? "",
            reviewedAt:         r.reviewedAt ?? null,
            recoveryAttempts:   r.recoveryAttempts ?? 0,
            lastRecoveryError:  r.lastRecoveryError ?? "",
        }));

        return NextResponse.json({
            success: true,
            items,
            meta: buildPaginationMeta(total, page, limit),
            filters: { state, search },
        });
    } catch (error) {
        console.error("ADMIN_PAYMENT_RECONCILIATION_LIST_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load reconciliation records" }, { status: 500 });
    }
}
