export const dynamic = "force-dynamic";

// src/app/api/spin/route.ts
//
// Phase 12 — Digital Spin & Win. GET returns the current balance/catalog
// for rendering the wheel (no result, no mutation). POST executes exactly
// one spin via src/lib/spin.ts's authoritative transaction. Guests are
// rejected outright — requireUser() re-verifies against the live User
// document, never trusts a client-supplied userId or balance.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/apiAuth";
import User from "@/models/User";
import { getSpinCatalog, performSpin, SPIN_COST_POINTS } from "@/lib/spin";

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) {
        return NextResponse.json({ success: false, message: "Please log in to use Spin & Eat." }, { status: 401 });
    }

    try {
        await connectDB();
        const [catalog, userDoc] = await Promise.all([
            getSpinCatalog(),
            User.findById(user.userId).select("loyaltyPoints").lean<{ loyaltyPoints?: number } | null>(),
        ]);

        const balance = Number(userDoc?.loyaltyPoints ?? 0);

        return NextResponse.json({
            success: true,
            balance,
            spinCost: SPIN_COST_POINTS,
            canSpin: balance >= SPIN_COST_POINTS,
            // Weight is deliberately omitted — odds aren't customer-facing.
            // specialBandGated IS exposed (just a boolean flag, no amount/
            // odds) so the UI can give the ₹200 OFF slot a distinct visual
            // treatment without inferring it from the label string.
            slots: catalog.filter((c) => c.active).map((c) => ({
                slotIndex: c.slotIndex,
                label: c.label,
                rewardType: c.rewardType,
                specialBandGated: c.specialBandGated,
            })),
        });
    } catch (error) {
        console.error("SPIN_STATUS_ERROR", error);
        return NextResponse.json({ success: false, message: "Couldn't load Spin & Eat right now." }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) {
        return NextResponse.json({ success: false, message: "Please log in to use Spin & Eat." }, { status: 401 });
    }

    try {
        await connectDB();
        const body = await req.json().catch(() => ({}));
        const idempotencyKey =
            typeof body?.idempotencyKey === "string" && body.idempotencyKey.length <= 100
                ? body.idempotencyKey
                : null;
        const result = await performSpin(user.userId, idempotencyKey);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("SPIN_EXECUTE_ERROR", { userId: user.userId, error });
        const status = (error as { status?: number })?.status || 500;
        const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
        return NextResponse.json({ success: false, message }, { status });
    }
}
