import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { BellRing, Check, Send, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/lib/locale";
import { errorText } from "@/lib/i18n";
import { getNotifyStatus, type NotifyStatus } from "@/lib/notify";
import { startTelegramNotify, telegramVerifyStatus } from "@/lib/telegram";
import { saveMyAlerts } from "@/lib/alerts";
import { CATEGORIES } from "@/lib/categories";
import { RAION_NAMES } from "@/lib/moldova";
import { Combobox } from "@/components/combobox";
import { isIos, isStandalone, pushSupported, subscribePush } from "@/components/push-prompt";
import { cn } from "@/lib/utils";

/**
 * "Vrei să afli primul?" — one place that asks people to turn on
 * notifications (Telegram or this phone), at the moments that matter:
 * right after sign-up, after applying, after posting, after an empty search,
 * and once a while after login. Never shown to someone who already has a
 * channel on. "Later" snoozes 3 days; after 3 refusals only the important
 * moments (sign-up, apply, post) and the account button still ask.
 */
export type NotifyReason = "signup" | "auto" | "apply" | "post" | "search" | "manual" | "telegram";

const EVENT = "rbt-notify-ask";
const PENDING_KEY = "rbt-notify-pending";
const RULES_KEY = "rabotaem-notify-v2";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_REFUSALS = 3;

/** Ask (if appropriate) to turn on notifications. Safe to call anywhere. */
export function askNotifications(reason: NotifyReason) {
  if (typeof window === "undefined") return;
  if (reason === "signup") {
    // Sign-up ends with a redirect: keep the request across the navigation.
    try {
      sessionStorage.setItem(PENDING_KEY, "signup");
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: reason }));
}

type Rules = { snoozeUntil: number; refusals: number };

function readRules(): Rules {
  try {
    const raw = JSON.parse(localStorage.getItem(RULES_KEY) ?? "{}") as Partial<Rules>;
    return { snoozeUntil: Number(raw.snoozeUntil) || 0, refusals: Number(raw.refusals) || 0 };
  } catch {
    return { snoozeUntil: 0, refusals: 0 };
  }
}

function writeRules(r: Rules) {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

function allowed(reason: NotifyReason) {
  if (reason === "manual" || reason === "signup" || reason === "telegram") return true;
  const r = readRules();
  if (Date.now() < r.snoozeUntil) return false;
  if ((reason === "auto" || reason === "search") && r.refusals >= MAX_REFUSALS) return false;
  if (reason === "search") {
    try {
      if (sessionStorage.getItem("rbt-notify-search") === "1") return false;
      sessionStorage.setItem("rbt-notify-search", "1");
    } catch {
      /* ignore */
    }
  }
  return true;
}

type Step = "choose" | "telegram" | "ios" | "alerts";

export function NotifyPrompt() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [reason, setReason] = useState<NotifyReason | null>(null);
  const [status, setStatus] = useState<NotifyStatus | null>(null);
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);
  const [tgUrl, setTgUrl] = useState("");
  const [raion, setRaion] = useState("Chișinău");
  const [cats, setCats] = useState<string[]>([]);
  const tgToken = useRef("");
  const showing = useRef(false);

  const open = useCallback(
    async (why: NotifyReason) => {
      if (!user || showing.current) return;
      if (/^\/(admin|login|complete|verify|reset)/.test(window.location.pathname)) return;
      if (!allowed(why)) return;
      showing.current = true;
      try {
        const st = await getNotifyStatus();
        if (why === "telegram") {
          // From "Alertele mele": link Telegram even if browser push is already on.
          showing.current = st.telegramAvailable && !st.telegram;
          if (!showing.current) {
            if (st.telegram) toast.success(t("nt.alreadyOn"));
            return;
          }
          setStatus({ ...st, hasAlert: true });
          setStep("choose");
          setReason(why);
          return;
        }
        const hasChannel = st.telegram || st.push > 0;
        const canSomething = st.telegramAvailable || pushSupported() || isIos();
        if (!canSomething || (hasChannel && !(why === "manual" && !st.hasAlert))) {
          showing.current = false;
          if (why === "manual" && hasChannel) toast.success(t("nt.alreadyOn"));
          return;
        }
        setStatus(st);
        setStep(hasChannel ? "alerts" : "choose");
        setReason(why);
      } catch {
        showing.current = false;
      }
    },
    [user, t],
  );

  // Requests from anywhere on the site.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const why = (e as CustomEvent<NotifyReason>).detail;
      if (why === "signup") return; // handled by the pending flag below, after the redirect
      void open(why);
    };
    window.addEventListener(EVENT, onAsk);
    return () => window.removeEventListener(EVENT, onAsk);
  }, [open]);

  // Sign-up: shown on the first page after the redirect.
  useEffect(() => {
    if (isPending || !user) return;
    let pending = "";
    try {
      pending = sessionStorage.getItem(PENDING_KEY) ?? "";
    } catch {
      /* ignore */
    }
    if (pending !== "signup" || /^\/(complete|verify|login)/.test(pathname)) return;
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    const timer = window.setTimeout(() => void open("signup"), 700);
    return () => window.clearTimeout(timer);
  }, [user, isPending, pathname, open]);

  // A gentle reminder a few seconds after login (respects snooze/refusals).
  useEffect(() => {
    if (isPending || !user) return;
    const timer = window.setTimeout(() => void open("auto"), 8000);
    return () => window.clearTimeout(timer);
  }, [user, isPending, open]);

  // Telegram: wait for "Start" in the bot.
  useEffect(() => {
    if (step !== "telegram" || !tgToken.current) return;
    let stop = false;
    const check = async () => {
      try {
        const st = await telegramVerifyStatus({ data: { token: tgToken.current } });
        if (stop) return;
        if (st.status === "done") {
          toast.success(t("nt.tgDone"));
          afterEnabled();
        }
      } catch {
        /* keep waiting */
      }
    };
    const timer = window.setInterval(() => void check(), 2500);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stop = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function close() {
    window.dispatchEvent(new Event("rbt-notify-changed"));
    showing.current = false;
    setReason(null);
    setStep("choose");
    tgToken.current = "";
  }

  function later() {
    const r = readRules();
    writeRules({ snoozeUntil: Date.now() + SNOOZE_MS, refusals: r.refusals + 1 });
    close();
  }

  function afterEnabled() {
    writeRules({ snoozeUntil: 0, refusals: 0 });
    window.dispatchEvent(new Event("rbt-notify-changed"));
    if (status && !status.hasAlert) setStep("alerts");
    else close();
  }

  async function chooseTelegram() {
    setBusy(true);
    try {
      const res = await startTelegramNotify();
      tgToken.current = res.token;
      setTgUrl(res.url);
      window.open(res.url, "_blank", "noopener");
      setStep("telegram");
    } catch (err) {
      toast.error(errorText(err, t, t("nt.tgFail")));
    } finally {
      setBusy(false);
    }
  }

  async function choosePush() {
    setBusy(true);
    try {
      const ok = await subscribePush();
      if (!ok) {
        toast.error(t("push.denied"));
        return;
      }
      toast.success(t("push.enabled"));
      afterEnabled();
    } catch (err) {
      toast.error(errorText(err, t, t("push.denied")));
    } finally {
      setBusy(false);
    }
  }

  async function saveAlerts() {
    setBusy(true);
    try {
      await saveMyAlerts({
        data: {
          raions: raion ? [raion] : [],
          categories: cats,
          kinds: ["rapid", "oficial"],
          via_push: true,
          via_telegram: true,
          paused: false,
        },
      });
      toast.success(t("nt.alertsSaved"));
      close();
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusy(false);
    }
  }

  if (!reason || !status) return null;
  const why = reason === "manual" || reason === "telegram" ? "auto" : reason;
  const iosBrowser = typeof window !== "undefined" && isIos() && !isStandalone();
  const canPush = pushSupported();

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" data-testid="notify-prompt" data-reason={reason}>
      <button type="button" aria-label={t("inb.close")} className="absolute inset-0 bg-navy-deep/45 backdrop-blur-[2px]" onClick={later} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative m-3 w-full max-w-md rounded-[28px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] glass-strong sm:p-6"
      >
        <button
          type="button"
          onClick={later}
          aria-label={t("inb.close")}
          className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-muted hover:bg-navy/6"
        >
          <X className="size-5" />
        </button>

        {step === "choose" ? (
          <>
            <span className="grid size-12 place-items-center rounded-full glass-orange">
              <BellRing className="size-6" />
            </span>
            <h2 className="mt-3 pr-10 text-xl font-semibold tracking-tight text-navy">{t(`nt.${why}.t`)}</h2>
            <p className="mt-1.5 text-base leading-relaxed text-muted">{t(`nt.${why}.b`)}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-navy">
              {(["nt.benefit1", "nt.benefit2", "nt.benefit3"] as const).map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  {t(k)}
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-2.5">
              {status.telegramAvailable ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void chooseTelegram()}
                  data-testid="nt-telegram"
                  className="flex min-h-14 items-center gap-3 rounded-2xl bg-[#229ed9] px-4 py-2 text-left text-white disabled:opacity-60"
                >
                  <Send className="size-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">
                      Telegram <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-xs">{t("nt.recommended")}</span>
                    </span>
                    <span className="block text-xs opacity-90">{t("nt.tgSub")}</span>
                  </span>
                </button>
              ) : null}
              {reason === "telegram" ? null : canPush ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void choosePush()}
                  data-testid="nt-push"
                  className="flex min-h-14 items-center gap-3 rounded-2xl bg-brand px-4 py-2 text-left text-white disabled:opacity-60"
                >
                  <Smartphone className="size-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">{t("nt.push")}</span>
                    <span className="block text-xs opacity-90">{t("nt.pushSub")}</span>
                  </span>
                </button>
              ) : iosBrowser ? (
                <button
                  type="button"
                  onClick={() => setStep("ios")}
                  data-testid="nt-ios"
                  className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/70 px-4 py-2 text-left text-navy ring-1 ring-navy/10 dark:bg-white/10"
                >
                  <Smartphone className="size-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">{t("nt.ios")}</span>
                    <span className="block text-xs text-muted">{t("nt.iosSub")}</span>
                  </span>
                </button>
              ) : null}
              <button type="button" onClick={later} className="h-12 rounded-full text-base font-medium text-muted hover:bg-navy/6">
                {t("nt.later")}
              </button>
            </div>
          </>
        ) : step === "telegram" ? (
          <>
            <span className="grid size-12 place-items-center rounded-full bg-[#229ed9] text-white">
              <Send className="size-6" />
            </span>
            <h2 className="mt-3 pr-10 text-xl font-semibold tracking-tight text-navy">{t("nt.tgWaitT")}</h2>
            <p className="mt-1.5 text-base leading-relaxed text-muted">{t("nt.tgWaitB")}</p>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
              <span className="size-2.5 animate-pulse rounded-full bg-[#229ed9]" />
              {t("nt.tgWaiting")}
            </p>
            <div className="mt-5 grid gap-2.5">
              <a
                href={tgUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center justify-center rounded-full bg-[#229ed9] text-base font-semibold text-white"
              >
                {t("nt.tgOpenAgain")}
              </a>
              <button type="button" onClick={() => setStep("choose")} className="h-12 rounded-full text-base font-medium text-muted hover:bg-navy/6">
                {t("nt.back")}
              </button>
            </div>
          </>
        ) : step === "ios" ? (
          <>
            <h2 className="pr-10 text-xl font-semibold tracking-tight text-navy">{t("nt.iosT")}</h2>
            <ol className="mt-3 space-y-3 text-base text-navy">
              {(["nt.ios1", "nt.ios2", "nt.ios3"] as const).map((k, i) => (
                <li key={k} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                  <span className="pt-1">{t(k)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-2xl bg-navy/6 px-4 py-3 text-sm text-navy">{t("nt.iosTgHint")}</p>
            <div className="mt-5 grid gap-2.5">
              {status.telegramAvailable ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void chooseTelegram()}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#229ed9] text-base font-semibold text-white"
                >
                  <Send className="size-5" />
                  {t("nt.useTelegram")}
                </button>
              ) : null}
              <button type="button" onClick={() => setStep("choose")} className="h-12 rounded-full text-base font-medium text-muted hover:bg-navy/6">
                {t("nt.back")}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-full bg-emerald-600 text-white">
              <Check className="size-6" />
            </span>
            <h2 className="mt-3 pr-10 text-xl font-semibold tracking-tight text-navy">{t("nt.alertsT")}</h2>
            <p className="mt-1.5 text-base leading-relaxed text-muted">{t("nt.alertsB")}</p>
            <p className="mt-4 mb-1.5 text-sm font-semibold text-navy">{t("post.raion")}</p>
            <Combobox value={raion} onChange={setRaion} options={RAION_NAMES} placeholder={t("search.pickRaion")} />
            <p className="mt-4 mb-1.5 text-sm font-semibold text-navy">{t("nt.whatWork")}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCats((v) => (v.includes(c.id) ? v.filter((x) => x !== c.id) : [...v, c.id]))}
                  className={cn(
                    "h-11 rounded-full px-3.5 text-sm font-medium",
                    cats.includes(c.id) ? "bg-brand text-white" : "bg-white/60 text-navy ring-1 ring-navy/10 dark:bg-white/10",
                  )}
                >
                  {t(`cat.${c.id}`)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{t("nt.allIfNone")}</p>
            <div className="mt-5 grid gap-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveAlerts()}
                data-testid="nt-save-alerts"
                className="h-12 rounded-full bg-emerald-600 text-base font-semibold text-white disabled:opacity-60"
              >
                {t("nt.saveAlerts")}
              </button>
              <button type="button" onClick={close} className="h-12 rounded-full text-base font-medium text-muted hover:bg-navy/6">
                {t("nt.skip")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Account card: are notifications on? One tap to turn them on. */
export function NotifyCard() {
  const { t } = useT();
  const [st, setSt] = useState<NotifyStatus | null>(null);
  const reload = useCallback(() => {
    getNotifyStatus()
      .then(setSt)
      .catch(() => setSt(null));
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener("focus", reload);
    window.addEventListener("rbt-notify-changed", reload);
    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener("rbt-notify-changed", reload);
    };
  }, [reload]);
  if (!st) return null;
  const on = st.telegram || st.push > 0;
  const via = [st.telegram ? "Telegram" : "", st.push > 0 ? t("nt.browser") : ""].filter(Boolean).join(" + ");
  return (
    <div
      className={cn("mt-4 flex flex-wrap items-center gap-4 rounded-[28px] p-5 sm:p-6", on ? "glass" : "bg-orange/12 ring-2 ring-orange/40")}
      data-testid="notify-card"
      data-on={on ? "1" : "0"}
    >
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", on ? "bg-emerald-600 text-white" : "glass-orange")}>
        <BellRing className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-navy">{on ? t("nt.cardOn") : t("nt.cardOff")}</span>
        <span className="block text-sm text-muted">{on ? via : t("nt.cardOffHint")}</span>
      </span>
      {!on ? (
        <button
          type="button"
          onClick={() => askNotifications("manual")}
          className="h-12 rounded-full px-5 text-base font-semibold glass-orange"
          data-testid="notify-card-on"
        >
          {t("nt.turnOn")}
        </button>
      ) : null}
    </div>
  );
}
