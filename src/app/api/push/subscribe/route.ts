export const dynamic = "force-dynamic";

// src/app/api/push/subscribe/route.ts
// POST — saves or updates a Web Push subscription in the DB.
// Links to the logged-in user if authenticated; otherwise stores anonymously.
//
// NEW: now also accepts an optional `fcmToken` in the body. Existing
// callers that don't send one are completely unaffected — fcmToken simply
// stays null, same as every subscription created before this change.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";
import { verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const body = await req.json();
        const { endpoint, keys, userAgent, fcmToken } = body;

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return NextResponse.json(
                { success: false, message: "Invalid subscription data" },
                { status: 400 }
            );
        }

        const safeFcmToken = typeof fcmToken === "string" && fcmToken.trim() ? fcmToken.trim() : null;

        // ── Optional user link ────────────────────────────────────────────
        let userId: string | null = null;
        try {
            const cookieHeader = req.headers.get("cookie") ?? "";
            const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
            const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
            if (token) {
                const decoded = verifyToken(token) as { userId?: string };
                if (decoded?.userId) userId = decoded.userId;
            }
        } catch { /* anonymous is fine */ }

        // ── Upsert — update if endpoint exists, insert if new ────────────
        const existing = await PushSubscription.findOne({ endpoint });

        if (existing) {
            existing.p256dh    = keys.p256dh;
            existing.auth      = keys.auth;
            existing.isActive  = true;
            existing.failCount = 0;
            if (userId) existing.user = userId;
            if (userAgent) existing.userAgent = userAgent;
            if (safeFcmToken) existing.fcmToken = safeFcmToken;
            await existing.save();
            return NextResponse.json({ success: true, message: "Subscription updated" });
        }

        await PushSubscription.create({
            endpoint,
            p256dh:    keys.p256dh,
            auth:      keys.auth,
            fcmToken:  safeFcmToken,
            userAgent: userAgent ?? "",
            user:      userId,
            isActive:  true,
        });

        return NextResponse.json(
            { success: true, message: "Subscription saved" },
            { status: 201 }
        );
    } catch (error) {
        console.error("PUSH_SUBSCRIBE_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to save subscription" },
            { status: 500 }
        );
    }
}