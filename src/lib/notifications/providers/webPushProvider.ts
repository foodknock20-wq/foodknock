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
import { sendFcmMessage, isFcmTokenDead, isFcmAuthError } from "@/lib/firebase/admin";
import { isCategoryEnabledForUsers } from "../preferences";
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

// VERCEL HOBBY SUSTAINABILITY AUDIT — "authError" is a new, distinct
// outcome from "failed". isFcmTokenDead() (per-token, already handled by
// deactivating just that one subscription) and isFcmAuthError() (the
// SERVER's own credentials rejected — see that function's own header in
// src/lib/firebase/admin.ts) are different failure classes that must never
// share a code path: an auth-class failure will repeat identically for
// every remaining fcmToken subscriber in THIS SAME broadcast (same
// credentials, same call), so WebPushProvider.send() below short-circuits
// the rest once detected, instead of repeating the same guaranteed-to-fail
// network call and the same per-token console.error for every subsequent
// FCM-token subscriber in the batch — real, previously-unbounded wasted
// compute/log volume on an error class this function already knows isn't
// per-token after the very first occurrence.
type SendOutcome = "sent" | "expired" | "failed" | "authError";

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
        if (isFcmAuthError(result.code, result.error)) {
            return "authError";
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
 * category preference. PHASE 6: previously called isCategoryEnabledForUser()
 * — one User.findById() — per subscription via Promise.all, an N+1 query
 * pattern with unbounded concurrency (a 2,000-subscriber broadcast meant up
 * to 2,000 concurrent DB round trips). Now resolves every linked user's
 * preference in a single bulk query via isCategoryEnabledForUsers().
 * Anonymous subscriptions (user: null) have no preferences to check and
 * are always included — there is no user record to have disabled anything.
 */
async function filterBroadcastByPreference(
    subs: PushSubscriptionDoc[],
    category: NotificationPayload["category"]
): Promise<PushSubscriptionDoc[]> {
    if (!category) return subs;

    const userIds = subs.map((s) => s.user).filter((id): id is string => !!id);
    const prefsByUser = await isCategoryEnabledForUsers(userIds, category);

    return subs.filter((sub) => !sub.user || prefsByUser.get(sub.user) === true);
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
        // Phase 17.2 (F8): this was a genuinely unbounded find() — every
        // active subscription loaded into memory in one serverless
        // invocation before any batching happened. BROADCAST_MAX_SUBSCRIBERS
        // is a hard ceiling well above any realistic current subscriber
        // count (confirmed low-scale by prior audit), not a silent
        // behavior change for today's traffic — only a cap that stops
        // unbounded growth from ever loading an unlimited result set. A
        // full cursor-streamed rewrite would be the long-term fix if the
        // subscriber base ever approaches this cap; logged loudly so
        // that's visible rather than silently truncating.
        const docs = await PushSubscription.find({ isActive: true }).limit(BROADCAST_MAX_SUBSCRIBERS).lean();
        if (docs.length >= BROADCAST_MAX_SUBSCRIBERS) {
            console.warn("PUSH_BROADCAST_SUBSCRIBER_CAP_HIT", { cap: BROADCAST_MAX_SUBSCRIBERS });
        }
        const all = (docs as unknown as LeanSubscriptionDoc[]).map(toSubscriptionDoc);
        return filterBroadcastByPreference(all, category);
    }

    return [];
}

// PHASE 6: broadcast campaigns (src/app/api/push/send-campaign/route.ts,
// twice-daily cron) and admin broadcasts (src/app/api/admin/notifications/
// broadcast/route.ts) can target every active subscription at once. This
// used to be a single unbounded Promise.all over ALL of them — for a
// deployment with thousands of active subscribers, that means thousands of
// concurrent webpush/FCM sends (each doing network I/O plus VAPID JWT
// signing) and thousands of concurrent PushSubscription.updateOne() calls
// in one serverless invocation: real risk of memory pressure, socket
// exhaustion, and provider-side rate-limiting. Processing in bounded
// batches keeps the same total work and the same per-subscription
// send/update behavior, just with controlled concurrency instead of
// unbounded — no new dependency, no behavior change for small subscriber
// counts (a campaign with <= BATCH_SIZE subscribers behaves identically to
// before, single batch).
const PUSH_SEND_BATCH_SIZE = 25;

// Phase 17.2 (F8) — hard ceiling on one broadcast's subscriber fetch, see
// the call site in resolveTargets() for the full rationale.
const BROADCAST_MAX_SUBSCRIBERS = 20_000;

export class WebPushProvider implements DeliveryProvider {
    readonly channel = "push" as const;

    async send(target: NotificationTarget, payload: NotificationPayload): Promise<DeliveryResult> {
        const subs = await resolveTargetSubscriptions(target, payload.category);
        const wpPayload = toWebPushPayload(payload);

        let sent = 0, failed = 0, deactivated = 0;
        // VERCEL HOBBY SUSTAINABILITY AUDIT — once a systemic FCM
        // credential/permission error is seen once in THIS invocation,
        // every remaining fcmToken subscriber would fail the exact same
        // way for the exact same reason (see isFcmAuthError()'s own header)
        // — short-circuit them instead of spending a network call (and a
        // console.error) on a result already known. Scoped to this one
        // `send()` call only; the next cron tick/broadcast starts fresh and
        // will detect it again if the underlying credential problem is
        // still unresolved, so this never silently hides an ongoing outage.
        let fcmAuthErrorSeen = false;

        for (let i = 0; i < subs.length; i += PUSH_SEND_BATCH_SIZE) {
            const batch = subs.slice(i, i + PUSH_SEND_BATCH_SIZE);

            await Promise.all(
                batch.map(async (sub) => {
                    if (sub.fcmToken && FCM_CONFIGURED && fcmAuthErrorSeen) {
                        failed++;
                        return;
                    }

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

                    if (result === "authError") {
                        // Deliberately does NOT $inc failCount — this
                        // subscription did nothing wrong, the SERVER's
                        // credentials were rejected; penalizing the
                        // subscriber's failCount toward eventual
                        // deactivation for a server-side config problem
                        // would be incorrect.
                        if (!fcmAuthErrorSeen) {
                            fcmAuthErrorSeen = true;
                            console.error(
                                `FCM_AUTH_ERROR: Firebase rejected this server's credentials/permissions — ` +
                                `verify the Cloud Messaging API is enabled and the service account has the ` +
                                `required IAM role in the Firebase/GCP console. Skipping remaining FCM-token ` +
                                `subscribers for this send (subscription ${sub._id} was the first to surface it); ` +
                                `non-FCM subscribers are unaffected and still receive this notification via raw Web Push.`
                            );
                        }
                        return;
                    }

                    await PushSubscription.updateOne({ _id: sub._id }, { $inc: { failCount: 1 } });
                })
            );
        }

        return { channel: "push", sent, failed, deactivated };
    }
}

export const webPushProvider = new WebPushProvider();