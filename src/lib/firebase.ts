import {
  FIREBASE_CONFIG,
  FIREBASE_VAPID_KEY,
  FCM_SW_PATH,
  FCM_SW_SCOPE,
} from "@/lib/firebase-config";

type ForegroundHandler = (payload: { title: string; body: string; url: string }) => void;

let foregroundBound = false;
let fcmSwPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!fcmSwPromise) {
    fcmSwPromise = navigator.serviceWorker
      .register(FCM_SW_PATH, { scope: FCM_SW_SCOPE, updateViaCache: "none" })
      .then(async (reg) => {
        await reg.update().catch(() => {});
        return reg;
      })
      .catch((err) => {
        console.warn("[push] fcm sw", err);
        fcmSwPromise = null;
        return null;
      });
  }
  return fcmSwPromise;
}

async function messagingSdk() {
  if (typeof window === "undefined") return null;
  const { isSupported, getMessaging, getToken, onMessage } = await import("firebase/messaging");
  if (!(await isSupported())) return null;
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  const sw = await registerFcmServiceWorker();
  return { messaging: getMessaging(app), getToken, onMessage, sw };
}

export async function getFcmRegistrationToken(): Promise<string | null> {
  try {
    const sdk = await messagingSdk();
    if (!sdk) return null;
    const token = await sdk.getToken(sdk.messaging, {
      vapidKey: FIREBASE_VAPID_KEY,
      ...(sdk.sw ? { serviceWorkerRegistration: sdk.sw } : {}),
    });
    return token || null;
  } catch (err) {
    console.warn("[push] fcm token", err);
    return null;
  }
}

export function listenForegroundMessages(handler: ForegroundHandler) {
  if (typeof window === "undefined" || foregroundBound) return;
  foregroundBound = true;
  void (async () => {
    try {
      const sdk = await messagingSdk();
      if (!sdk) return;
      sdk.onMessage(sdk.messaging, (payload) => {
        handler({
          title: payload.notification?.title || payload.data?.title || "Rabotaem.md",
          body: payload.notification?.body || payload.data?.body || "",
          url: payload.fcmOptions?.link || payload.data?.url || "/",
        });
      });
    } catch (err) {
      console.warn("[push] fcm foreground", err);
    }
  })();
}
