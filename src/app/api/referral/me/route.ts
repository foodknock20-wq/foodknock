export const dynamic = "force-dynamic";

// src/app/api/referral/me/route.ts
//
// Pre-Phase 17 — Home/Search polish: minimal, authenticated endpoint
// exposing the CURRENT user's own real referral code + the real,
// already-configured reward terms (src/lib/loyaltyService.ts's
// LOYALTY_CONFIG) — reused, never duplicated/invented. No second referral
// code generator: reuses src/lib/referral.ts's uniqueReferralCode(), the
// exact function account creation already uses, as a self-healing
// fallback for any account that predates that field being guaranteed.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/apiAuth";
import { uniqueReferralCode } from "@/lib/referral";
import { LOYALTY_CONFIG } from "@/lib/loyaltyService";

export async function GET(req: Request) {
    try {
        const auth = await requireUser(req);
        if (!auth) {
            return NextResponse.json({ success: false, message: "Please sign in" }, { status: 401 });
        }

        await connectDB();

        const user = await User.findById(auth.userId).select("name referralCode");
        if (!user) {
            return NextResponse.json({ success: false, message: "Account not found" }, { status: 404 });
        }

        if (!user.referralCode) {
            user.referralCode = await uniqueReferralCode(user.name);
            await user.save();
        }

        return NextResponse.json({
            success: true,
            referralCode: user.referralCode,
            referrerReward: LOYALTY_CONFIG.REFERRER_REWARD,
            refereeReward: LOYALTY_CONFIG.REFEREE_REWARD,
        });
    } catch (error) {
        console.error("GET_REFERRAL_ME_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load referral code" }, { status: 500 });
    }
}
