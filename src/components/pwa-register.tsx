import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Download, Share, X } from "lucide-react";
import { useT } from "@/lib/locale";
import { FCM_SW_PATH, FCM_SW_SCOPE } from "@/lib/firebase-config";

const DISMISS_KEY = "rabotaem-pwa-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as { standalone?: boolean }).standalone))
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PushNavigateListener() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    function go(raw: string) {
      try {
        const next = new URL(raw, window.location.origin);
        if (next.origin !== window.location.origin) return;
        const dest = `${next.pathname}${next.search}${next.hash}`;
        const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (dest !== here) router.history.push(dest);
      } catch {
        /* ignore */
      }
    }

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; url?: string } | null;
      if (!data || data.type !== "rabotaem-navigate" || typeof data.url !== "string") return;
      go(data.url);
    }

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    void navigator.serviceWorker
      .register(FCM_SW_PATH, { scope: FCM_SW_SCOPE, updateViaCache: "none" })
      .catch(() => {});
  }, []);

  return <PwaInstallHint />;
}

function PwaInstallHint() {
  const { t } = useT();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosTip, setIosTip] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    if (isStandalone()) return;
    if (window.parent !== window) return;

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (isIos()) {
      setIosTip(true);
      setHidden(false);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    dismiss();
  }

  if (hidden) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[44] flex justify-start p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
      <div className="pointer-events-auto flex max-w-[min(20rem,calc(100vw-5.5rem))] items-center gap-2 rounded-[22px] px-3 py-2 glass-strong">
        <span className="grid size-9 shrink-0 place-items-center rounded-full glass-orange">
          {iosTip ? <Share className="size-4 text-white" /> : <Download className="size-4 text-white" />}
        </span>
        <div className="min-w-0 flex-1">
          {iosTip ? (
            <p className="text-xs leading-snug font-medium text-navy">{t("pwa.ios")}</p>
          ) : (
            <button type="button" className="text-left text-sm font-semibold text-navy" onClick={() => void install()}>
              {t("pwa.install")}
            </button>
          )}
        </div>
        <button
          type="button"
          className="grid size-9 shrink-0 place-items-center rounded-full text-navy hover:bg-navy/8"
          aria-label={t("pwa.dismiss")}
          onClick={dismiss}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
