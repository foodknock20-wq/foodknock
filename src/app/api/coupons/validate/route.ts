export const dynamic = "force-dynamic";

// src/app/api/coupons/validate/route.ts
//
// Phase 11 — customer-facing coupon preview. READ-ONLY: never reserves
// usage (see src/lib/coupons.ts header). This is a preview for UX only —
// the final order-creation path (createOrderCore) re-validates and
// reserves atomically regardless of what this endpoint returned, so a
// stale/replayed response from here can never affect what's actually
// charged (Phase 11 spec §16).
//
// Requires login (requireUser) — mirrors every order-creation path in
// this codebase (Phase 9: guest checkout is not allowed), and a coupon
// can't be checked for "already used by this user" without an identity.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/apiAuth";
import { calculateAuthoritativePricing, type ClientCartItemInput } from "@/lib/pricing";
import { validateCoupon } from "@/lib/coupons";

export async function POST(req: Request) {
    try {
        await connectDB();

        const user = await requireUser(req);
        if (!user) {
            return NextResponse.json(
                { success: false, reason: "LOGIN_REQUIRED", message: "Please log in to use a coupon." },
                { status: 401 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const code = String(body?.code ?? "");
        const rawItems: ClientCartItemInput[] = Array.isArray(body?.cartItems) ? body.cartItems : [];

        if (!code.trim()) {
            return NextResponse.json({ success: false, reason: "NOT_FOUND", message: "Enter a coupon code." }, { status: 400 });
        }

        // Authoritative subtotal — never trust a client-supplied subtotal,
        // identical discipline to every order-creation route.
        const { subtotal } = await calculateAuthoritativePricing(rawItems);

        const result = await validateCoupon({ code, subtotal, userId: user.userId });

        if (!result.valid) {
            return NextResponse.json({ success: false, reason: result.reason, message: result.message }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            code: result.code,
            discountType: result.discountType,
            discountValue: result.discountValue,
            discountAmount: result.discountAmount,
        });
    } catch (error) {
        console.error("COUPON_VALIDATE_ERROR", error);
        const status = (error as { status?: number })?.status || 500;
        const message = error instanceof Error ? error.message : "Couldn't apply the coupon right now. Please try again.";
        return NextResponse.json({ success: false, message }, { status });
    }
}
