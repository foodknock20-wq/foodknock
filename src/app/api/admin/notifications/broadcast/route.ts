export const dynamic = "force-dynamic";

// src/app/api/admin/notifications/broadcast/route.ts
//
// Admin Notification Center API.
//
// Three actions, one endpoint:
//   • mode: "test"      → send only to the calling admin's own subscription
//                          (identified by the endpoint their browser already
//                          holds — resolved to a subscriptionId server-side)
//   • mode: "broadcast" → send to every active push subscriber
//   • mode: "user"      → send to exactly one customer (target.userId) —
//                          used both by the Customer Detail page's "Send
//                          Notification" action AND (Notification System
//                          2.0) the Admin Notification Studio's searchable
//                          customer selector. Reuses the SAME engine call
//                          as the other two modes, so it inherits the
//                          existing per-user preference gate
//                          (notificationEngine.send() checks
//                          isCategoryEnabledForUser before delivering) and
//                          delivery logging — not a second notification path.
//
// All modes flow through notificationEngine.send(...) — the same direct-send
// path already used by the cron campaign route. This API never imports
// web-push or touches PushSubscription docs for delivery; it only resolves
// the test-mode endpoint to an _id so the engine can target it.
//
// Auth: requireAdmin() (src/lib/apiAuth.ts) — the shared, DB-verified admin
// check, not a hand-rolled JWT-role-claim read. Notification System 2.0 also
// adds a per-admin rate limit (Phase 29) and server-side destination
// validation (Phase 38) — see below.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";
import { notificationEngine } from "@/lib/notifications";
import { requireAdmin } from "@/lib/apiAuth";
import { isRateLimited } from "@/lib/rateLimit";
import { resolveSafeDestination } from "@/lib/notifications/safeDestination";
import { broadcastIdempotencyKey } from "@/lib/securityLogic";

// Phase 17.2 (F15): unlike the cron campaign route (deterministic
// campaignId + NotificationLog existence check), this admin-triggered
// endpoint had no idempotency guard at all — a double-click or a client
// network-retry on "user"/"broadcast" mode could reach real customers
// twice for the exact same message. Reuses the EXISTING isRateLimited()
// primitive (src/lib/rateLimit.ts) rather than inventing a new mechanism:
// with limit=1, the first call for a given exact-content key within the
// window succeeds, and an identical retry within that same window is
// blocked — a genuinely new/different broadcast (different title/body/
// target) is a different key and is never blocked. Key derivation itself
// lives in src/lib/securityLogic.ts (pure, unit-tested).
const BROADCAST_IDEMPOTENCY_WINDOW_MS = 30 * 1000;

// Phase 29 — per-admin send limits. "test" mode (self-only, used while
// composing) is exempt — it can only ever reach the calling admin's own
// browser, so it carries none of the accidental-spam risk this guards
// against. "user" and "broadcast" both reach real customers and share one
// budget per admin per hour.
const ADMIN_SEND_LIMIT = 30;
const ADMIN_SEND_WINDOW_MS = 60 * 60 * 1000;

type BroadcastBody = {
    mode: "test" | "broadcast" | "user";
    title: string;
    body: string;
    url?: string;
    /** Required for mode: "test" — the calling browser's own push endpoint. */
    endpoint?: string;
    /** Required for mode: "user" — the target customer's User _id. */
    targetUserId?: string;
    // ── Rich payload (Feature 3, Part 10) — all optional. An admin who only
    // fills in the original title/body/url form gets exactly the original
    // behavior; these just flow through to NotificationPayload untouched.
    imageUrl?: string;
    category?: string;
    priority?: string;
    accentColor?: string;
    badgeText?: string;
    ctaButtons?: Array<{ id: string; label: string; url?: string }>;
    campaignId?: string;
};

export async function POST(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json(
            { success: false, message: "Admin access required" },
            { status: 403 }
        );
    }

    try {
        await connectDB();

        const data = (await req.json()) as Partial<BroadcastBody>;
        const {
            mode, title, body, url, endpoint, targetUserId,
            imageUrl, category, priority, accentColor, badgeText, ctaButtons, campaignId,
        } = data;

        if (mode !== "test" && mode !== "broadcast" && mode !== "user") {
            return NextResponse.json(
                { success: false, message: 'mode must be "test", "broadcast", or "user"' },
                { status: 400 }
            );
        }

        if (!title?.trim() || !body?.trim()) {
            return NextResponse.json(
                { success: false, message: "Title and message are required" },
                { status: 400 }
            );
        }

        // Phase 29 — "test" only ever reaches the admin's own browser, so it's
        // exempt. "user"/"broadcast" reach real customers and share one
        // per-admin hourly budget, preventing an accidental double-send loop
        // or repeated-click spam from reaching customers many times over.
        if (mode !== "test") {
            const limited = await isRateLimited(`admin-notify-send:${admin.userId}`, ADMIN_SEND_LIMIT, ADMIN_SEND_WINDOW_MS);
            if (limited) {
                return NextResponse.json(
                    { success: false, message: "Too many notifications sent recently. Please wait before sending more." },
                    { status: 429 }
                );
            }
        }

        // Phase 38 — never trust/forward an arbitrary client-supplied
        // destination. Same allowlist the service worker enforces at
        // delivery time; validating here too means an unsafe/malformed URL
        // never even reaches NotificationLog or the engine.
        const safeUrl = resolveSafeDestination(url?.trim() || "/menu");

        // Phase 17.2 (F15) — idempotency guard for modes that reach real
        // customers. A duplicate submission (double-click, client retry)
        // with the EXACT same content within the window is blocked; a
        // genuinely different broadcast is a different key and always
        // goes through.
        if (mode !== "test") {
            const idemKey = broadcastIdempotencyKey({
                adminId: admin.userId, mode, title: title!.trim(), body: body!.trim(), url: safeUrl, targetUserId,
            });
            const duplicate = await isRateLimited(idemKey, 1, BROADCAST_IDEMPOTENCY_WINDOW_MS);
            if (duplicate) {
                return NextResponse.json(
                    { success: false, message: "This exact notification was just sent — please wait before resending the same message." },
                    { status: 409 }
                );
            }
        }

        // Validate against the known unions rather than trusting arbitrary
        // request-body strings — an invalid value is simply omitted (falls
        // back to applyBranding()'s defaults) rather than passed through.
        const VALID_CATEGORIES = [
            "order_update", "offer", "reward", "lunch_deal", "evening_deal",
            "festival", "flash_sale", "price_drop", "system", "general",
        ];
        const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];

        const richPayloadFields = {
            ...(imageUrl ? { imageUrl } : {}),
            ...(category && VALID_CATEGORIES.includes(category) ? { category: category as any } : {}),
            ...(priority && VALID_PRIORITIES.includes(priority) ? { priority: priority as any } : {}),
            ...(accentColor ? { accentColor } : {}),
            ...(badgeText ? { badgeText } : {}),
            ...(Array.isArray(ctaButtons) && ctaButtons.length > 0 ? { ctaButtons } : {}),
            ...(campaignId ? { campaignId } : {}),
        };

        // ── Test mode — only the admin's own subscription ──────────────────
        if (mode === "test") {
            if (!endpoint) {
                return NextResponse.json(
                    { success: false, message: "endpoint is required for test notifications" },
                    { status: 400 }
                );
            }

            const sub = await PushSubscription
                .findOne({ endpoint, isActive: true })
                .select("_id")
                .lean() as { _id: { toString(): string } } | null;

            if (!sub) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "No active subscription found for this browser. Enable notifications first.",
                    },
                    { status: 404 }
                );
            }

            const [result] = await notificationEngine.send(
                ["push"],
                { subscriptionIds: [sub._id.toString()] },
                { title, body, url: safeUrl, ...richPayloadFields }
            );

            return NextResponse.json({
                success: true,
                mode: "test",
                sent: result?.sent ?? 0,
                failed: result?.failed ?? 0,
            });
        }

        // ── User mode — exactly one customer (Phase 15F, Customer Detail) ──
        if (mode === "user") {
            if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
                return NextResponse.json(
                    { success: false, message: "A valid targetUserId is required" },
                    { status: 400 }
                );
            }

            const [result] = await notificationEngine.send(
                ["push"],
                { userId: targetUserId },
                { title, body, url: safeUrl, ...richPayloadFields }
            );

            return NextResponse.json({
                success: true,
                mode: "user",
                sent: result?.sent ?? 0,
                failed: result?.failed ?? 0,
            });
        }

        // ── Broadcast mode — all active subscribers ─────────────────────────
        // Uses the same awaited notificationEngine.send(...) path as the
        // existing broadcastCampaign() shim (src/lib/webpush.ts), so the
        // admin sees real sent/failed/deactivated counts instead of firing
        // an unawaited event into the void.
        const [result] = await notificationEngine.send(
            ["push"],
            { broadcast: true },
            { title, body, url: safeUrl, ...richPayloadFields }
        );

        return NextResponse.json({
            success: true,
            mode: "broadcast",
            sent: result?.sent ?? 0,
            failed: result?.failed ?? 0,
            deactivated: result?.deactivated ?? 0,
        });
    } catch (error) {
        console.error("ADMIN_BROADCAST_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to send notification" },
            { status: 500 }
        );
    }
}