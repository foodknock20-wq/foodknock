// src/lib/notifications/providers/webPushProvider.ts
// FoodKnock Notification Engine — Web Push delivery provider.
//
// This is the existing src/lib/webpush.ts send/broadcast logic, moved
// behind the DeliveryProvider contract. Behavior for every EXISTING
// subscription (one without an fcmToken) is completely unchanged: same
// VAPID setup, same per-subscription send/expire/fail handling, same DB
// updates, same `web-push` package call.
//
// Two additive changes only, both tied to a confirmed requirement:
//   1. FCM dispatch branch — subscriptions that have an fcmToken (see
//      PushSubscription.ts) are sent via the Firebase Admin SDK instead
//      of raw `web-push`, for more reliable Android/TWA delivery. This
//      is a dispatch decision made INSIDE this same provider class,
//      under the SAME "push" channel — engine.ts, types.ts's
//      NotificationChannel union, and provider registration are
//      completely untouched.
//   2. Broadcast preference filtering — engine.ts's preference gate only
//      runs `if (target.userId)`. A `{broadcast:true}` target has no
//      single userId, so admin broadcasts previously ignored every
//      recipient's Notification Preferences entirely. This is the one
//      place individual linked users are actually known during broadcast
//      resolution, so it's the correct place to filter — reuses the
//      EXISTING isCategoryEnabledForUser() check engine.ts already
//      performs for userId-targeted sends; no new preference logic is
//      introduced.

import webpush from "web-push";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";
import { sendFcmMessage, isFcmTokenDead } from "@/lib/firebase/admin";
import { isCategoryEnabledForUser } from "../preferences";
import type {
    DeliveryProvider,
    DeliveryResult,
    NotificationAction,
    NotificationPayload,
    NotificationTarget,
} from "../types";

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL   = process.env.VAPID_CONTACT_EMAIL ?? "foodknock20@gmail.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC, VAPID_PRIVATE);
} else {
    console.error("WEBPUSH_INIT_ERROR: Missing VAPID keys in environment");
}

// Whether FCM sending is configured — checked once, not per-send. A
// deployment without Firebase env vars simply falls back to raw Web Push
// for every subscription, even ones that somehow have an fcmToken stored.
const FCM_CONFIGURED = !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
);

type PushSubscriptionDoc = {
    _id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    fcmToken: string | null;
    /** Needed only for broadcast preference filtering below — null for anonymous subscriptions, which are never gated (no user record to check a preference for). */
    user: string | null;
};

type WebPushPayload = {
    title: string;
    body: string;
    url: string;
    icon?: string;
    badge?: string;
    actions?: NotificationAction[];
    /** Large hero image — Chrome/Android render this as the notification's banner image. */
    image?: string;
    tag?: string;
};

function toWebPushPayload(payload: NotificationPayload): WebPushPayload {
    return {
        title: payload.title,
        body:  payload.body,
        url:   payload.url ?? "/menu",
        icon:  payload.icon ?? "/icon-192.png",
        badge: payload.badge ?? "/icon-192.png",
        // Omit entirely when not provided — sw.js falls back to its existing
        // hardcoded "Order Now / Later" actions, preserving current campaign
        // behavior exactly as before.
        ...(payload.actions?.length ? { actions: payload.actions } : {}),
        // Rich Notifications (Feature 3) — both optional, both omitted
        // entirely when unset so a payload with neither produces a wire
        // payload byte-for-byte identical to before this was added.
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
        ...(payload.tag ? { tag: payload.tag } : {}),
    };
}

type SendOutcome = "sent" | "expired" | "failed";

async function sendToSubscription(
    sub: PushSubscriptionDoc,
    payload: WebPushPayload
): Promise<SendOutcome> {
    // FCM branch — only for subscriptions that actually have a token AND
    // when FCM is configured. Every other subscription uses the
    // unchanged raw Web Push path below.
    if (sub.fcmToken && FCM_CONFIGURED) {
        const result = await sendFcmMessage({ token: sub.fcmToken, payload, url: payload.url });
        if (result.ok) return "sent";
        if (isFcmTokenDead(result.code)) {
            console.warn(`FCM token dead for subscription ${sub._id} (${result.code}) — will be deactivated.`);
            return "expired";
        }
        console.error(`FCM send error for ${sub._id}:`, result.error);
        return "failed";
    }

    // Unchanged — original raw Web Push path.
    const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        return "sent";
    } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return "expired";
        console.error(`Push send error for ${sub._id}:`, err);
        return "failed";
    }
}

type LeanSubscriptionDoc = {
    _id: { toString(): string };
    endpoint: string;
    p256dh: string;
    auth: string;
    fcmToken?: string | null;
    user?: { toString(): string } | null;
};

function toSubscriptionDoc(d: LeanSubscriptionDoc): PushSubscriptionDoc {
    return {
        _id: d._id.toString(),
        endpoint: d.endpoint,
        p256dh: d.p256dh,
        auth: d.auth,
        fcmToken: d.fcmToken ?? null,
        user: d.user ? d.user.toString() : null,
    };
}

/**
 * Filters a broadcast's resolved subscriptions by each linked user's
 * category preference, reusing the SAME isCategoryEnabledForUser() check
 * engine.send() already performs for userId-targeted sends. Anonymous
 * subscriptions (user: null) have no preferences to check and are always
 * included — there is no user record to have disabled anything.
 */
async function filterBroadcastByPreference(
    subs: PushSubscriptionDoc[],
    category: NotificationPayload["category"]
): Promise<PushSubscriptionDoc[]> {
    if (!category) return subs;

    const checked = await Promise.all(
        subs.map(async (sub) => ({
            sub,
            allowed: sub.user ? await isCategoryEnabledForUser(sub.user, category) : true,
        }))
    );

    return checked.filter((c) => c.allowed).map((c) => c.sub);
}

async function resolveTargetSubscriptions(
    target: NotificationTarget,
    category: NotificationPayload["category"]
): Promise<PushSubscriptionDoc[]> {
    await connectDB();

    if (target.subscriptionIds?.length) {
        const docs = await PushSubscription
            .find({ _id: { $in: target.subscriptionIds }, isActive: true })
            .lean();
        // Test-send targets a specific subscription an admin explicitly
        // chose — never preference-filtered, same as before this change.
        return (docs as unknown as LeanSubscriptionDoc[]).map(toSubscriptionDoc);
    }

    if (target.userId) {
        const docs = await PushSubscription
            .find({ user: target.userId, isActive: true })
            .lean();
        // Already gated one layer up by engine.send()'s own preference
        // check before this provider is ever called for a userId target —
        // no double-filtering needed or performed here.
        return (docs as unknown as LeanSubscriptionDoc[]).map(toSubscriptionDoc);
    }

    if (target.broadcast) {
        const docs = await PushSubscription.find({ isActive: true }).lean();
        const all = (docs as unknown as LeanSubscriptionDoc[]).map(toSubscriptionDoc);
        return filterBroadcastByPreference(all, category);
    }

    return [];
}

export class WebPushProvider implements DeliveryProvider {
    readonly channel = "push" as const;

    async send(target: NotificationTarget, payload: NotificationPayload): Promise<DeliveryResult> {
        const subs = await resolveTargetSubscriptions(target, payload.category);
        const wpPayload = toWebPushPayload(payload);
        console.log("WEB PUSH PAYLOAD");
        console.log(JSON.stringify(wpPayload,null,2));

        let sent = 0, failed = 0, deactivated = 0;

        await Promise.all(
            subs.map(async (sub) => {
                const result = await sendToSubscription(sub, wpPayload);

                if (result === "sent") {
                    sent++;
                    await PushSubscription.updateOne(
                        { _id: sub._id },
                        { $set: { failCount: 0, isActive: true } }
                    );
                    return;
                }

                failed++;

                if (result === "expired") {
                    await PushSubscription.updateOne(
                        { _id: sub._id },
                        { $set: { isActive: false }, $inc: { failCount: 1 } }
                    );
                    deactivated++;
                    return;
                }

                await PushSubscription.updateOne({ _id: sub._id }, { $inc: { failCount: 1 } });
            })
        );

        return { channel: "push", sent, failed, deactivated };
    }
}

export const webPushProvider = new WebPushProvider();