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
      data = { ...data, ...parsed };
    }
  } catch {}

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: { url: data.url },
    vibrate: [150, 50, 150],
    requireInteraction: false,
    tag: "foodknock-promo",
    renotify: true,
    actions: [
      { action: "order", title: "Order Now 🍔" },
      { action: "dismiss", title: "Later" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url ?? "/menu";
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(fullUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});
