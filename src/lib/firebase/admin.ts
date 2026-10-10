// src/lib/firebase/admin.ts
//
// FoodKnock — Firebase Admin SDK (server-only).
//
// Pure transport, mirroring the exact role src/lib/notifications/whatsapp/client.ts
// plays for WhatsApp: no business logic, no template content, no knowledge
// of which event triggered a send. This is what webPushProvider.ts calls
// for any subscription that has an fcmToken — the existing `web-push`
// (VAPID) path is completely untouched and still used for every
// subscription that doesn't have one.
//
// NEVER imported by client code — pulls in firebase-admin's Node-only
// dependencies. If this ever appears in a "use client" import chain, that
// is a bug the same class as importing preferences.ts client-side.

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

let cachedApp: App | null = null;

function getFirebaseAdminApp(): App {
    if (cachedApp) return cachedApp;

    const existing = getApps();
    if (existing.length > 0) {
        cachedApp = existing[0];
        return cachedApp;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Private keys stored in env vars commonly have their newlines escaped
    // as literal "\n" — must be un-escaped before use, or the PEM parser
    // rejects the key. Same pattern every FCM/Admin SDK guide documents.
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKeyRaw) {
        throw new Error(
            "FIREBASE_ADMIN_CONFIG_ERROR: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must all be set."
        );
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    cachedApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
    });

    return cachedApp;
}

let cachedMessaging: Messaging | null = null;

function getMessagingInstance(): Messaging {
    if (cachedMessaging) return cachedMessaging;
    cachedMessaging = getMessaging(getFirebaseAdminApp());
    return cachedMessaging;
}

export type FcmSendInput = {
    token: string;
    /**
     * The FULL existing web-push-shaped payload (same shape webPushProvider.ts
     * already builds for raw Web Push) — sent as a single stringified data
     * field so it triggers the browser's standard Push API `push` event and
     * flows through the EXISTING public/sw.js handler completely unchanged.
     * This is deliberate: FCM's "notification" payload type would bypass
     * sw.js's custom actions/image/click logic and let the browser render a
     * default notification shape instead — a data-only message keeps FCM
     * and raw Web Push producing byte-identical results on the client.
     *
     * IMPORTANT (confirmed via debug capture): FCM does NOT deliver this
     * `data` object flat to the browser's Push API. The actual wire
     * envelope the service worker's `push` event receives is
     * { data: { payload: "<json-string>" }, fcmMessageId, priority, ... } —
     * see public/sw.js's extractNotificationPayload() for the corresponding
     * unwrap logic. This file's job is only to build the correct SEND
     * request; sw.js is the one place that must know how to unwrap it.
     */
    payload: Record<string, unknown>;
    /** Used only for FCM's own click-through metadata (fcmOptions.link) — sw.js's own notificationclick handler is still what actually navigates. */
    url?: string;
};

export type FcmSendResult =
    | { ok: true; messageId: string }
    | { ok: false; error: string; code?: string };

/**
 * Sends one data-only FCM webpush message. Never throws — every failure
 * (missing config, invalid/unregistered token, network error) resolves to
 * `{ ok: false, error, code }` so webPushProvider.ts's caller can decide
 * fail/expire handling without its own try/catch guessing at shapes.
 */
export async function sendFcmMessage(input: FcmSendInput): Promise<FcmSendResult> {
    try {
        const messaging = getMessagingInstance();

        const messageId = await messaging.send({
            token: input.token,
            data: {
                payload: JSON.stringify(input.payload),
            },
            webpush: {
                headers: {
                    Urgency: "high",
                },
                ...(input.url ? { fcmOptions: { link: input.url } } : {}),
            },
        });

        return { ok: true, messageId };
    } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message, code };
    }
}

/** Whether the dead-token codes FCM returns mean "never usable again — deactivate". Mirrors webPushProvider.ts's 404/410 = expired treatment. */
export function isFcmTokenDead(code: string | undefined): boolean {
    return (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/invalid-argument"
    );
}

// VERCEL HOBBY SUSTAINABILITY AUDIT — this is a DIFFERENT failure class
// from isFcmTokenDead() above, and the two must never be conflated.
// isFcmTokenDead() codes mean "this one token is permanently invalid" —
// correctly handled already by deactivating just that subscription.
// These codes instead mean the SERVER's own credentials/permissions are
// rejected by Firebase — a project/service-account/IAM problem, not a
// per-token one. A send failing with one of these will fail IDENTICALLY
// for every other fcmToken subscriber in the same broadcast (same
// credentials, same call), so "permission-denied"-class errors seen
// repeatedly in production logs are evidence of a configuration issue to
// verify in the Firebase/GCP console (Cloud Messaging API enabled; the
// service account has the "Firebase Cloud Messaging API Admin" role) —
// NOT evidence that subscriber tokens are going bad, and NOT something a
// code change here can actually repair. Exported so webPushProvider.ts
// can tell the two apart and log ONE clear, aggregated warning per
// invocation instead of repeating the same per-token "FCM send error" N
// times across a broadcast — real wasted log volume/CPU on an error this
// function already knows, after the first occurrence, cannot be anything
// but systemic for the rest of that same invocation.
export function isFcmAuthError(code: string | undefined, message: string | undefined): boolean {
    if (
        code === "messaging/authentication-error" ||
        code === "messaging/invalid-credential" ||
        code === "messaging/third-party-auth-error" ||
        code === "messaging/insufficient-device-storage"
    ) {
        return true;
    }
    // The Admin SDK doesn't always normalize a rejected-credential/IAM
    // response into one of the `messaging/*` codes above — it can also
    // surface the underlying googleapis/gRPC error as a bare
    // "PERMISSION_DENIED" code or message, which is what this codebase's
    // own production logs were observed to contain (the exact phrase this
    // audit was asked to investigate, not assumed).
    const text = `${code ?? ""} ${message ?? ""}`.toLowerCase();
    return text.includes("permission_denied") || text.includes("permission denied");
}