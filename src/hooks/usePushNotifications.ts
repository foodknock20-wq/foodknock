"use client";

// src/hooks/usePushNotifications.ts
// Fixed: added `mounted` guard to prevent SSR/client hydration mismatch
// which caused React Suspense boundary crash → infinite page load.

import { useState, useEffect, useCallback } from "react";

export type PushState =
    | "unsupported"
    | "loading"
    | "default"
    | "granted"
    | "denied"
    | "prompt";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const output  = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
    return output.buffer;
}

export function usePushNotifications() {
    // FIX: Start as "loading" on BOTH server and client so first render matches.
    // Without this, server renders null but client immediately shows the prompt
    // → React hydration mismatch → Suspense boundary crash → infinite load.
    const [mounted,      setMounted]      = useState(false);
    const [state,        setState]        = useState<PushState>("loading");
    const [subscribing,  setSubscribing]  = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    // Mark as mounted after first client render
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        // Only run on client after mount
        if (!mounted) return;

        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            setState("unsupported");
            return;
        }

        const checkState = async () => {
            try {
                const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
                setRegistration(reg);
                await navigator.serviceWorker.ready;

                const permission = Notification.permission;
                if (permission === "denied") { setState("denied"); return; }

                const sub = await reg.pushManager.getSubscription();
                setState(sub && permission === "granted" ? "granted" : "prompt");
            } catch (err) {
                console.error("[Push] SW registration failed:", err);
                setState("unsupported");
            }
        };

        checkState();
    }, [mounted]);

    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!registration) return false;

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) { console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set"); return false; }

        setSubscribing(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                setState(permission === "denied" ? "denied" : "prompt");
                return false;
            }

            const existing = await registration.pushManager.getSubscription();
            const sub = existing ?? (await registration.pushManager.subscribe({
                userVisibleOnly:      true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            }));

            const res = await fetch("/api/push/subscribe", {
                method:      "POST",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body: JSON.stringify({
                    endpoint:  sub.endpoint,
                    keys:      sub.toJSON().keys,
                    userAgent: navigator.userAgent,
                }),
            });

            if (!res.ok) throw new Error("Backend save failed");
            setState("granted");
            return true;
        } catch (err) {
            console.error("[Push] Subscribe failed:", err);
            return false;
        } finally {
            setSubscribing(false);
        }
    }, [registration]);

    const unsubscribe = useCallback(async (): Promise<boolean> => {
        if (!registration) return false;
        try {
            const sub = await registration.pushManager.getSubscription();
            if (sub) {
                await fetch("/api/push/unsubscribe", {
                    method:      "POST",
                    credentials: "include",
                    headers:     { "Content-Type": "application/json" },
                    body:        JSON.stringify({ endpoint: sub.endpoint }),
                });
                await sub.unsubscribe();
            }
            setState("prompt");
            return true;
        } catch (err) {
            console.error("[Push] Unsubscribe failed:", err);
            return false;
        }
    }, [registration]);

    // Return loading state until mounted — prevents hydration mismatch
    if (!mounted) return { state: "loading" as PushState, subscribing: false, subscribe, unsubscribe };

    return { state, subscribing, subscribe, unsubscribe };
}