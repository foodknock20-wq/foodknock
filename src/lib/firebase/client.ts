"use client";

// src/lib/firebase/client.ts
//
// FoodKnock — Firebase Web SDK (client-only).
//
// Deliberately reuses the EXISTING service worker registration
// (public/sw.js) rather than requiring a separate firebase-messaging-sw.js
// — Firebase's getToken() accepts a `serviceWorkerRegistration` option for
// exactly this purpose. This is what keeps notificationclick handling in
// ONE place (sw.js) regardless of which transport (raw Web Push or FCM)
// delivered the message.
//
// All functions here are no-ops (return null) in any environment where
// Firebase Messaging isn't supported (e.g. Safari, or missing config) —
// callers (usePushNotifications.ts) must treat a null return as "FCM
// unavailable, raw Web Push subscription is still the path", never as an
// error.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
    getMessaging,
    getToken,
    onMessage,
    isSupported,
    type Messaging,
} from "firebase/messaging";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function isFirebaseConfigured(): boolean {
    return !!(
        firebaseConfig.apiKey &&
        firebaseConfig.projectId &&
        firebaseConfig.messagingSenderId &&
        firebaseConfig.appId
    );
}

let cachedApp: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp | null {
    if (!isFirebaseConfigured()) return null;
    if (cachedApp) return cachedApp;

    const existing = getApps();
    cachedApp = existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
    return cachedApp;
}

let cachedMessaging: Messaging | null = null;
let messagingSupportChecked = false;
let messagingSupported = false;

async function getMessagingInstance(): Promise<Messaging | null> {
    if (cachedMessaging) return cachedMessaging;

    if (!messagingSupportChecked) {
        messagingSupportChecked = true;
        try {
            messagingSupported = await isSupported();
        } catch {
            messagingSupported = false;
        }
    }
    if (!messagingSupported) return null;

    const app = getFirebaseApp();
    if (!app) return null;

    cachedMessaging = getMessaging(app);
    return cachedMessaging;
}

/**
 * Obtains an FCM registration token, reusing the ALREADY-REGISTERED sw.js
 * (see usePushNotifications.ts, which registers it before calling this).
 * Returns null (never throws) when Firebase isn't configured, isn't
 * supported in this browser, or the user hasn't granted permission —
 * every one of those is a valid "no FCM, fall back to raw Web Push" state.
 */
export async function getFcmToken(
    swRegistration: ServiceWorkerRegistration
): Promise<string | null> {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) return null;

    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    try {
        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: swRegistration,
        });
        return token || null;
    } catch (err) {
        console.warn("[FCM] getToken failed — falling back to raw Web Push only:", err);
        return null;
    }
}

/**
 * Foreground message handler — fires when a data message arrives while the
 * tab/TWA is focused. Note: sw.js's own `push` event ALSO fires and still
 * shows a tray notification for background/raw Web Push cases (unchanged,
 * see sw.js) — this is purely for an OPTIONAL additional in-app toast while
 * the app is actively open. Returns a no-op unsubscribe function when
 * Firebase isn't available, so callers never need to null-check before
 * calling the returned cleanup function.
 */
export async function onForegroundFcmMessage(
    handler: (payload: { title?: string; body?: string; url?: string }) => void
): Promise<() => void> {
    const messaging = await getMessagingInstance();
    if (!messaging) return () => {};

    const unsubscribe = onMessage(messaging, (message) => {
        try {
            const raw = message.data?.payload;
            const parsed = raw ? JSON.parse(raw) : {};
            handler({ title: parsed.title, body: parsed.body, url: parsed.url });
        } catch (err) {
            console.warn("[FCM] Failed to parse foreground message payload:", err);
        }
    });

    return unsubscribe;
}
