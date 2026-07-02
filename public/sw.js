const CACHE_NAME = "foodknock-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png"]);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (
        event.request.method !== "GET" ||
        !event.request.url.startsWith(self.location.origin)
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() =>
            caches.match(event.request).then((r) => r || caches.match(OFFLINE_URL))
        )
    );
});

/**
 * Extracts the actual FoodKnock NotificationPayload from whatever the
 * browser's Push API event.data.json() parsed to. Two genuinely different
 * wire shapes reach this function depending on delivery transport:
 *
 * 1. FCM — { data: { payload: "<json-string>" }, fcmMessageId, priority, ... }
 * 2. Raw Web Push — the payload object sent directly, no wrapper.
 */
function extractNotificationPayload(rawParsed) {
    if (!rawParsed || typeof rawParsed !== "object") return null;

    if (rawParsed.data && typeof rawParsed.data.payload === "string") {
        try {
            return JSON.parse(rawParsed.data.payload);
        } catch {
            return null;
        }
    }

    if (typeof rawParsed.payload === "string") {
        try {
            return JSON.parse(rawParsed.payload);
        } catch {
            return null;
        }
    }

    if (typeof rawParsed.title === "string" || typeof rawParsed.body === "string") {
        return rawParsed;
    }

    return null;
}

// ── Click-destination allowlist ────────────────────────────────────────
// Only these base routes are ever navigated to. Any other route in a
// payload — malformed, unexpected, or from a future template someone
// forgot to whitelist — falls back to "/" rather than producing an
// unpredictable navigation. Dynamic sub-paths under an allowed base
// (e.g. "/my-orders/FK-1234", "/track-order/FK-1234") are permitted via
// prefix match, since order/track notifications legitimately need a
// specific order id in the path.
const ALLOWED_ROUTE_BASES = [
    "/",
    "/menu",
    "/my-orders",
    "/track-order",
    "/reviews",
    "/cart",
    "/loyalty",
];

/**
 * Validates and normalizes a notification's target URL against
 * ALLOWED_ROUTE_BASES. Returns a same-origin, allowlisted pathname —
 * always "/" for anything that doesn't match.
 */
function resolveSafeUrl(rawUrl) {
    let pathname;
    try {
        pathname = new URL(rawUrl || "/", self.location.origin).pathname;
    } catch {
        return "/";
    }

    if (pathname === "/") return "/";

    const isAllowed = ALLOWED_ROUTE_BASES.some((base) => {
        if (base === "/") return false;
        return pathname === base || pathname.startsWith(base + "/");
    });

    return isAllowed ? pathname : "/";
}

self.addEventListener("push", (event) => {
    let data = {
        title: "🍔 FoodKnock",
        body: "Something delicious is waiting for you!",
        url: "/menu",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
    };

    try {
        if (event.data) {
            const parsed = event.data.json();
            const unwrapped = extractNotificationPayload(parsed);
            if (unwrapped) {
                data = { ...data, ...unwrapped };
            }
        }
    } catch { }

    // Validate the URL at RECEIVE time — event.notification.data.url is
    // always already safe by the time notificationclick reads it.
    const safeUrl = resolveSafeUrl(data.url);

    const defaultActions = [
        { action: "order", title: "Order Now 🍔" },
        { action: "dismiss", title: "Later" },
    ];

    // Unique-per-notification fallback tag so sequential notifications
    // (order placed → preparing → out for delivery → delivered) each get
    // their own tray entry instead of overwriting each other. A payload
    // that DELIBERATELY sets its own tag (e.g. for intentional marketing
    // dedup) is still fully respected.
    const fallbackTag = "foodknock-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        data: { url: safeUrl },
        vibrate: [150, 50, 150],
        requireInteraction: false,
        tag: data.tag || fallbackTag,
        renotify: true,
        actions: Array.isArray(data.actions) && data.actions.length > 0
            ? data.actions
            : defaultActions,
        ...(data.image ? { image: data.image } : {}),
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Production-grade click handler ─────────────────────────────────────
// Every click ends in navigation — never a silent close, never a
// duplicate tab, never a race condition.
//
// Sequence:
//   1. Resolve the safe target URL (already validated at push-time;
//      re-validated here as defense in depth).
//   2. List every window client this SW controls, INCLUDING uncontrolled
//      ones (a tab opened before this SW activated, or a TWA WebView
//      that registers slightly differently) — required to reliably find
//      an open FoodKnock window across Chrome Android / PWA / TWA.
//   3. Prefer a client ALREADY AT the target URL — if one exists, just
//      focus it (no re-navigation needed, avoids a pointless reload).
//   4. Otherwise, prefer any same-origin client — focus it, then
//      navigate it. If navigate() isn't supported or throws, fall
//      through to openWindow() so navigation ALWAYS happens.
//   5. If no matching window exists at all (app fully closed / cold
//      start from notification), openWindow() directly to the target.
// Exactly ONE of focus+navigate OR openWindow ever runs per click — this
// is what eliminates both "double tabs" and "silent close with no nav".
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    if (event.action === "dismiss") return;

    const safeUrl = resolveSafeUrl(event.notification.data?.url);
    const fullUrl = new URL(safeUrl, self.location.origin).href;

    event.waitUntil(
        (async () => {
            const windowClients = await clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });

            const sameOriginClients = windowClients.filter((client) =>
                client.url.startsWith(self.location.origin)
            );

            if (sameOriginClients.length === 0) {
                // App fully closed, or first-ever launch from a
                // notification — open exactly one new window.
                if (clients.openWindow) {
                    await clients.openWindow(fullUrl);
                }
                return;
            }

            // Prefer a client already sitting on the exact target URL —
            // just focus it, skip a redundant navigate() call entirely.
            const exactMatch = sameOriginClients.find((client) => {
                try {
                    return new URL(client.url).pathname === safeUrl;
                } catch {
                    return false;
                }
            });

            const target = exactMatch || sameOriginClients[0];

            try {
                await target.focus();
            } catch {
                // focus() can reject in some embedded/TWA WebView contexts
                // — non-fatal, navigation attempt still proceeds below.
            }

            if (exactMatch) {
                // Already on the right page — done, no further action.
                return;
            }

            if ("navigate" in target) {
                try {
                    await target.navigate(fullUrl);
                    return; // success — no fallback needed
                } catch {
                    // navigate() threw (rare cross-origin edge case, or the
                    // client closed between matchAll() and here) — fall
                    // through to openWindow() rather than leaving the
                    // click unresolved.
                }
            }

            // navigate() unsupported or failed — still guarantee
            // navigation via exactly one new window.
            if (clients.openWindow) {
                await clients.openWindow(fullUrl);
            }
        })()
    );
});