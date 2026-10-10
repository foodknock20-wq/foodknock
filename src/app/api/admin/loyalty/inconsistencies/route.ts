export const dynamic = "force-dynamic";

// src/app/api/admin/loyalty/inconsistencies/route.ts
//
// Phase 17.1B — read-only diagnostic (GET) + explicit, bounded,
// admin-triggered repair (POST) for two distinct loyalty-integrity gaps:
//
//   1. "redemption" candidates — createOrderCore.ts called redeemPoints()
//      after Order.create() succeeded, and that call failed. See
//      findInconsistentLoyaltyRedemptions()/retryFailedLoyaltyRedemption()
//      in src/lib/loyaltyService.ts.
//   2. "staleClaim" candidates — a process crashed between claiming a
//      (user, order, type) ledger slot and finalizing it. See
//      findStalePendingLedgerClaims()/resolveStalePendingClaim() in the
//      same file, and loyaltyLogic.ts's resolveStaleClaim() for the exact
//      disambiguation rule (never a guess).
//
// GET never mutates anything. POST repairs exactly ONE item per call
// (never a bulk/unbounded operation) and only ever performs the same
// logic the original operation itself would have — never a second,
// parallel mutation mechanism, never a reversal of an order or payment.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import {
    findInconsistentLoyaltyRedemptions,
    retryFailedLoyaltyRedemption,
    findStalePendingLedgerClaims,
    resolveStalePendingClaim,
} from "@/lib/loyaltyService";

export async function GET(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    try {
        await connectDB();
        const limitParam = Number(req.nextUrl.searchParams.get("limit"));
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;

        const [redemptionCandidates, staleClaims] = await Promise.all([
            findInconsistentLoyaltyRedemptions(limit),
            findStalePendingLedgerClaims(limit),
        ]);

        return NextResponse.json({
            success: true,
            redemptionCandidates: { count: redemptionCandidates.length, items: redemptionCandidates },
            staleClaims: { count: staleClaims.length, items: staleClaims },
        });
    } catch (err) {
        console.error("ADMIN_LOYALTY_INCONSISTENCIES_GET_ERROR", err);
        return NextResponse.json(
            { success: false, message: "Failed to load inconsistencies" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    try {
        await connectDB();
        const body = await req.json().catch(() => ({}));
        const orderMongoId = typeof body?.orderMongoId === "string" ? body.orderMongoId : "";
        const claimId       = typeof body?.claimId === "string" ? body.claimId : "";

        if (orderMongoId) {
            if (!mongoose.Types.ObjectId.isValid(orderMongoId)) {
                return NextResponse.json({ success: false, message: "Invalid orderMongoId" }, { status: 400 });
            }
            const outcome = await retryFailedLoyaltyRedemption(orderMongoId);
            if (!outcome.ok) {
                return NextResponse.json({ success: false, message: outcome.reason }, { status: 409 });
            }
            return NextResponse.json({
                success: true,
                kind: "redemption",
                alreadyConsistent: outcome.alreadyConsistent,
                balanceAfter: outcome.alreadyConsistent ? undefined : outcome.balanceAfter,
            });
        }

        if (claimId) {
            if (!mongoose.Types.ObjectId.isValid(claimId)) {
                return NextResponse.json({ success: false, message: "Invalid claimId" }, { status: 400 });
            }
            const outcome = await resolveStalePendingClaim(claimId);
            if (!outcome.ok) {
                return NextResponse.json({ success: false, message: outcome.message }, { status: 409 });
            }
            return NextResponse.json({
                success: true,
                kind: "staleClaim",
                action: outcome.action,
                balanceAfter: outcome.action === "marked_completed" ? outcome.balanceAfter : undefined,
            });
        }

        return NextResponse.json(
            { success: false, message: "Either orderMongoId or claimId is required" },
            { status: 400 }
        );
    } catch (err) {
        console.error("ADMIN_LOYALTY_INCONSISTENCIES_POST_ERROR", err);
        return NextResponse.json(
            { success: false, message: "Repair attempt failed unexpectedly" },
            { status: 500 }
        );
    }
}
