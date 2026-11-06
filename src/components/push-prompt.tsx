import { errorText } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getFcmRegistrationToken, listenForegroundMessages, registerFcmServiceWorker } from "@/lib/firebase";
import { getPushPublicKey, savePushDevice, updatePushPrefs } from "@/lib/push";
import { Combobox } from "@/components/combobox";
import { RAION_NAMES } from "@/lib/moldova";
import { useT } from "@/lib/locale";

const DISMISS_KEY = "rabotaem-push-dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
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

export function PushPrompt() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ask" | "raion">("ask");
  const [raion, setRaion] = useState("Chișinău");
  const [busy, setBusy] = useState(false);

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
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("PushManager" in window)) return;
    if (isIos() && !isStandalone()) return;
    void registerFcmServiceWorker();

    if (Notification.permission === "granted") {
      void subscribePush().catch(() => {});
      return;
    }
    if (Notification.permission !== "default") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), 8000);
    return () => window.clearTimeout(timer);
  }, [user, isPending]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function enable() {
    setBusy(true);
    try {
      const ok = await subscribePush();
      if (!ok) {
        toast.error(t("push.denied"));
        dismiss();
        return;
      }
      toast.success(t("push.enabled"));
      setStep("raion");
    } catch (err) {
      toast.error(errorText(err, t, t("push.denied")));
      dismiss();
    } finally {
      setBusy(false);
    }
  }

  async function saveRaion() {
    setBusy(true);
    try {
      await updatePushPrefs({ data: { notify_raion: raion, notify_push: true } });
      dismiss();
    } catch {
      dismiss();
    } finally {
      setBusy(false);
    }
  }

  if (!open || !user) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[43] flex justify-center px-3 pb-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))] sm:pb-24">
      <div className="pointer-events-auto w-full max-w-sm rounded-[24px] p-4 glass-strong" data-testid="push-prompt">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full glass-orange">
            <Bell className="size-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            {step === "ask" ? (
              <>
                <p className="text-sm font-semibold text-navy">{t("push.title")}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t("push.body")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void enable()}
                    className="h-10 rounded-full px-4 text-sm font-semibold glass-orange"
                  >
                    {t("push.enable")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={dismiss}
                    className="h-10 rounded-full px-3 text-sm font-medium text-muted"
                  >
                    {t("push.later")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-navy">{t("push.raionLabel")}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t("push.raionHint")}</p>
                <div className="mt-3">
                  <Combobox value={raion} onChange={setRaion} options={RAION_NAMES} placeholder={t("search.pickRaion")} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveRaion()}
                    className="h-10 rounded-full px-4 text-sm font-semibold glass-navy"
                  >
                    {t("push.saveRaion")}
                  </button>
                  <button type="button" onClick={dismiss} className="h-10 rounded-full px-3 text-sm font-medium text-muted">
                    {t("push.later")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
