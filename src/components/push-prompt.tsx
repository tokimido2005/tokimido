import { useEffect } from "react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getFcmRegistrationToken, listenForegroundMessages, registerFcmServiceWorker } from "@/lib/firebase";
import { getPushPublicKey, savePushDevice } from "@/lib/push";
import { useT } from "@/lib/locale";


function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as { standalone?: boolean }).standalone)
  );
}

export async function subscribePush(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") return false;

  await registerFcmServiceWorker();
  const keys = await getPushPublicKey();
  const nativeKey = keys.webPushPublicKey;
  const reg = await navigator.serviceWorker.ready;

  let sub: PushSubscription | null = null;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub && nativeKey) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(nativeKey),
      });
    }
  } catch (err) {
    console.warn("[push] web-push subscribe", err);
    try {
      sub = await reg.pushManager.getSubscription();
    } catch {
      sub = null;
    }
  }

  const fcmToken = await getFcmRegistrationToken();
  const json = sub?.toJSON() ?? {};
  const token = fcmToken || sub?.endpoint;
  if (!token) return false;

  await savePushDevice({
    data: {
      token,
      endpoint: sub?.endpoint ?? "",
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  });
  return true;
}

/** Can this browser get web push right now (iPhone only from the home-screen app)? */
export function pushSupported() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (isIos() && !isStandalone()) return false;
  return Notification.permission !== "denied";
}

/**
 * Background part of browser notifications: shows pushes that arrive while
 * the site is open and keeps an already-allowed device registered. Asking
 * for permission lives in <NotifyPrompt>.
 */
export function PushForeground() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    // Loading the Firebase SDK (~50 KB) only makes sense once the visitor has
    // allowed notifications; everyone else skips it.
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    listenForegroundMessages((payload) => {
      toast(payload.title, {
        description: payload.body,
        action: {
          label: t("push.open"),
          onClick: () => {
            if (payload.url) window.location.href = payload.url;
          },
        },
      });
    });
  }, [t]);

  useEffect(() => {
    if (isPending || !user) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    void registerFcmServiceWorker();
    void subscribePush().catch(() => {});
  }, [user, isPending]);

  return null;
}
