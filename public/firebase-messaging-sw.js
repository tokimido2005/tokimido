/* FCM background worker — scope /firebase-cloud-messaging-push-scope (not /sw.js).
   Keep this config in sync with src/lib/firebase-config.ts */
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBL5adQ7l19NL-p9sBuIIPflf0xwQOT0jM",
  authDomain: "rabotaem-79c83.firebaseapp.com",
  projectId: "rabotaem-79c83",
  storageBucket: "rabotaem-79c83.firebasestorage.app",
  messagingSenderId: "763180806225",
  appId: "1:763180806225:web:ece668a30b8727f0c78870",
  measurementId: "G-0901ZGPNE9",
});

const messaging = firebase.messaging();
const FCM_VAPID_KEY =
  "BPyUgJBqEXs8yeBzlWbtE960jO3b8uxDVYBF1IwtANd5H_5RMBUhlA1U2XW4wQPX9P4_nEdDmJWmC4_M50yxByM";
if (typeof messaging.usePublicVapidKey === "function") {
  try {
    messaging.usePublicVapidKey(FCM_VAPID_KEY);
  } catch {
    /* vapid is also passed from the page via getToken */
  }
}

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

function payloadParts(payload) {
  const title = payload?.notification?.title || payload?.data?.title || "Rabotaem.md";
  const body = payload?.notification?.body || payload?.data?.body || "Ai o actualizare nouă.";
  const url = absUrl(payload?.fcmOptions?.link || payload?.data?.url || "/");
  return { title, body, url };
}

messaging.onBackgroundMessage((payload) => {
  const { title, body, url } = payloadParts(payload);
  return self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = absUrl(event.notification.data?.url);
  event.waitUntil(openPushTarget(target));
});
