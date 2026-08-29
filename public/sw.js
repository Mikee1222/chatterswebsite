/* Gunzo Partner – Service Worker: push, notificationclick, optional cache */

const CACHE_NAME = "chatter-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const title = payload.title || "Chatter";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192-v2.png",
    badge: "/icon-192-v2.png",
    tag: payload.tag || "chatter-notification",
    renotify: true,
    requireInteraction: false,
    data: {
      url: payload.url || "/",
      tag: payload.tag,
      notification_id: payload.notification_id,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  const notificationId = event.notification.data?.notification_id;
  event.waitUntil(
    Promise.resolve().then(async () => {
      if (notificationId) {
        try {
          await fetch("/api/notifications/mark-read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ notification_id: notificationId }),
          });
        } catch {
          /* non-blocking */
        }
      }
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

/**
 * Navigation and API responses must never be served from cache — stale HTML/RSC payloads
 * cause blank or wrong UI. Only static assets below use cache-first.
 */
function isNetworkOnlyPath(pathname) {
  if (pathname === "/model" || pathname.startsWith("/model/")) return true;
  if (pathname === "/api" || pathname.startsWith("/api/")) return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  return false;
}

/* Optional: cache static assets for offline shell only */
self.addEventListener("fetch", (event) => {
  const u = new URL(event.request.url);
  if (u.origin !== self.location.origin) return;

  if (isNetworkOnlyPath(u.pathname)) {
    // Never let the HTTP cache satisfy auth/API GETs via the SW (mobile Safari/PWA).
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (
    u.pathname.startsWith("/_next/static/") ||
    u.pathname.startsWith("/icons/") ||
    u.pathname.startsWith("/apple-touch-icon") ||
    /^\/icon-\d/.test(u.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
  }
});
