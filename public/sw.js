/* Rabotaem.md service worker — cache, offline, FCM / Web Push. */
const CACHE = "rabotaem-static-v8";
const PRECACHE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/favicon.ico",
  "/favicon-32.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192-maskable.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
  "/logo.png",
  "/logo-dark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function bypass(url) {
  if (url.origin !== self.location.origin) return true;
  const path = url.pathname;
  return (
    path.startsWith("/api/") ||
    path.startsWith("/_serverFn") ||
    path.startsWith("/auth/") ||
    path.startsWith("/__grok/") ||
    path === "/firebase-messaging-sw.js" ||
    path.startsWith("/firebase-cloud-messaging-push-scope") ||
    path.startsWith("/@") ||
    path.startsWith("/src/") ||
    path.startsWith("/node_modules") ||
    path.includes("vite") ||
    /\.(tsx?|jsx?|mjs)$/i.test(path)
  );
}

function isStatic(request, url) {
  const dest = request.destination;
  if (dest === "image" || dest === "font" || dest === "style") return true;
  return /\.(png|jpe?g|gif|svg|webp|ico|woff2?|css|webmanifest)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (bypass(url)) return;

  if (request.mode === "navigate") return;

  if (!isStatic(request, url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  let title = "Rabotaem.md";
  let body = "Ai o actualizare nouă.";
  let url = "/";
  try {
    const data = event.data ? event.data.json() : {};
    title = data.notification?.title || data.title || title;
    body = data.notification?.body || data.body || body;
    url = data.data?.url || data.url || url;
  } catch {
    try {
      const text = event.data ? event.data.text() : "";
      if (text) body = text;
    } catch {
      /* ignore */
    }
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
    }),
  );
});

function absUrl(url) {
  try {
    return new URL(url || "/", self.location.origin).href;
  } catch {
    return self.location.origin + "/";
  }
}

function openPushTarget(target) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      const sameOrigin = typeof client.url === "string" && client.url.startsWith(self.location.origin);
      if (!sameOrigin) continue;
      if (typeof client.postMessage === "function") {
        client.postMessage({ type: "rabotaem-navigate", url: target });
      }
      if (typeof client.focus === "function") {
        const focused = client.focus();
        if (typeof client.navigate === "function") {
          return Promise.resolve(focused)
            .then(() => client.navigate(target))
            .catch(() => focused);
        }
        return focused;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = absUrl(event.notification.data?.url);
  event.waitUntil(openPushTarget(target));
});
