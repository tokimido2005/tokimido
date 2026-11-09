import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { PhoneVerifyPanel } from "@/components/phone-verify";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { formatPhoneDisplay } from "@/lib/phone";
import { startTelegramVerify, telegramAvailable, telegramVerifyStatus, acceptTelegramPhone } from "@/lib/telegram";
import { cn } from "@/lib/utils";

let availableCache: boolean | null = null;

/**
 * Phone verification with a choice: Telegram (free, recommended) or SMS.
 * Falls back to the plain SMS panel when the bot isn't configured.
 */
export function PhoneVerifyChoice({
  phone,
  purpose = "verify",
  onVerified,
  autoSendSms = true,
}: {
  phone: string;
  purpose?: "verify" | "change";
  onVerified: () => void;
  autoSendSms?: boolean;
}) {
  const { t } = useT();
  const [available, setAvailable] = useState<boolean | null>(availableCache);
  const [method, setMethod] = useState<"telegram" | "sms" | null>(null);

  useEffect(() => {
    if (availableCache !== null) return;
    telegramAvailable()
      .then((v) => {
        availableCache = v;
        setAvailable(v);
      })
      .catch(() => setAvailable(false));
  }, []);

  if (available === null) {
    return <div className="h-40 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />;
  }
  if (!available) {
    return <PhoneVerifyPanel phone={phone} purpose={purpose} onVerified={onVerified} autoSend={autoSendSms} />;
  }

  return (
    <div className="space-y-3" data-testid="verify-choice">
      <div className="grid gap-2">
        <MethodButton
          active={method === "telegram"}
          onClick={() => setMethod("telegram")}
          icon={<Send className="size-5" />}
          title={t("tg.option")}
          sub={t("tg.optionSub")}
          badge={t("tg.recommended")}
          testId="choose-telegram"
        />
        <MethodButton
          active={method === "sms"}
          onClick={() => setMethod("sms")}
          icon={<MessageSquare className="size-5" />}
          title={t("sms.option")}
          sub={t("sms.optionSub")}
          testId="choose-sms"
        />
      </div>
      {method === "telegram" ? (
        <TelegramPanel phone={phone} purpose={purpose} onVerified={onVerified} onUseSms={() => setMethod("sms")} />
      ) : null}
      {method === "sms" ? (
        <PhoneVerifyPanel phone={phone} purpose={purpose} onVerified={onVerified} autoSend={autoSendSms} />
      ) : null}
    </div>
  );
}

function MethodButton({
  active,
  onClick,
  icon,
  title,
  sub,
  badge,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
  badge?: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        "flex w-full items-center gap-3 rounded-[20px] p-4 text-left ring-1 transition-colors",
        active ? "bg-orange/10 ring-2 ring-orange/60" : "bg-white/45 ring-navy/10 hover:bg-white/70 dark:bg-white/8",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-navy/6 text-navy">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-navy">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

type Status = "idle" | "pending" | "done" | "mismatch" | "foreign" | "taken" | "expired" | "missing";

function isDesktop() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(pointer: coarse)").matches && window.innerWidth >= 768;
}

function TelegramPanel({
  phone,
  purpose,
  onVerified,
  onUseSms,
}: {
  phone: string;
  purpose: "verify" | "change";
  onVerified: () => void;
  onUseSms: () => void;
}) {
  const { t } = useT();
  const [link, setLink] = useState<{ token: string; url: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [tgPhone, setTgPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  const storageKey = `rabotaem-tg-verify:${purpose}:${phone}`;

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await startTelegramVerify({ data: { purpose, phone } });
      setLink({ token: res.token, url: res.url });
      setStatus("pending");
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ token: res.token, url: res.url, at: Date.now() }));
      } catch {
        /* storage unavailable: polling still works on this page */
      }
    } catch (err) {
      setError(errorText(err, t, t("tg.startFail")));
      setStatus("idle");
    } finally {
      setBusy(false);
    }
  }, [phone, purpose, t, storageKey]);

  // Prepare the link as soon as Telegram is chosen (resume one from this tab if
  // it is still fresh), so "Open Telegram" is a real link: no pop-up blocking
  // and this page keeps waiting while the user is in the app.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as
        | { token: string; url: string; at: number }
        | null;
      if (saved && Date.now() - saved.at < 9 * 60 * 1000) {
        setLink({ token: saved.token, url: saved.url });
        setStatus("pending");
        return;
      }
    } catch {
      /* ignore */
    }
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!link || !isDesktop()) {
      setQr(null);
      return;
    }
    let cancelled = false;
    void import("qrcode")
      .then((QR) => QR.toDataURL(link.url, { margin: 1, width: 220 }))
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [link]);

  // Poll until the bot reports back; check again right away when the user
  // comes back from the Telegram app (background tabs throttle timers).
  useEffect(() => {
    if (!link || status !== "pending") return;
    const check = () => {
      telegramVerifyStatus({ data: { token: link.token } })
        .then((s) => {
          if (s.status === "pending") return;
          setStatus(s.status);
          setTgPhone(s.tgPhone);
          try {
            sessionStorage.removeItem(storageKey);
          } catch {
            /* ignore */
          }
          if (s.status === "done" && !done.current) {
            done.current = true;
            onVerifiedRef.current();
          }
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    const timer = window.setInterval(check, 2500);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [link, status, storageKey]);

  async function onUseTgNumber() {
    if (!link) return;
    setBusy(true);
    setError(null);
    try {
      await acceptTelegramPhone({ data: { token: link.token } });
      setStatus("done");
      if (!done.current) {
        done.current = true;
        onVerified();
      }
    } catch (err) {
      setError(errorText(err, t, t("tg.startFail")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[24px] bg-white/45 p-4 ring-1 ring-navy/8 dark:bg-white/8" data-testid="tg-panel">
      {status === "idle" && busy ? <div className="h-24 animate-pulse rounded-2xl bg-navy/5" /> : null}

      {status === "expired" || status === "missing" || (status === "idle" && !busy) ? (
        <>
          {status !== "idle" ? <p className="text-sm text-danger">{t("tg.expired")}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void start()}
            data-testid="tg-retry"
            className="mt-2 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-navy ring-1 ring-navy/20 hover:bg-navy/5 disabled:opacity-50"
          >
            {t("tg.newLink")}
          </button>
        </>
      ) : null}

      {status === "pending" && link ? (
        <div data-testid="tg-pending">
          <p className="text-sm text-navy">{qr ? t("tg.scan") : t("tg.howTo")}</p>
          {qr ? <img src={qr} alt="" width={220} height={220} className="mx-auto mt-3 rounded-xl bg-white p-2" /> : null}
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            data-testid="tg-open"
            className="sheen mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#229ED9] text-sm font-semibold text-white"
          >
            <Send className="size-4" />
            {qr ? t("tg.openHere") : t("tg.open")}
          </a>
          <p className="mt-3 text-center text-xs text-muted">{t("tg.waiting")}</p>
        </div>
      ) : null}

      {status === "done" ? <p className="text-sm font-semibold text-navy">{t("tg.done")}</p> : null}

      {status === "mismatch" ? (
        <div data-testid="tg-mismatch">
          <p className="text-sm text-navy">
            {t("tg.mismatch", { t: formatPhoneDisplay(tgPhone), s: formatPhoneDisplay(phone) })}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onUseTgNumber()}
            data-testid="tg-use-number"
            className="sheen mt-3 flex h-11 w-full items-center justify-center rounded-full glass-orange text-sm font-semibold disabled:opacity-50"
          >
            {t("tg.useNumber", { t: formatPhoneDisplay(tgPhone) })}
          </button>
        </div>
      ) : null}

      {status === "foreign" ? <p className="text-sm text-navy">{t("tg.foreign")}</p> : null}
      {status === "taken" ? <p className="text-sm text-navy">{t("tg.taken")}</p> : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      {status !== "done" ? (
        <button
          type="button"
          onClick={onUseSms}
          data-testid="tg-use-sms"
          className="mt-3 w-full text-center text-sm font-medium text-muted hover:text-navy"
        >
          {t("tg.useSms")}
        </button>
      ) : null}
    </div>
  );
}
