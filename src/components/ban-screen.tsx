import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Ban, Clock3, ShieldOff } from "lucide-react";
import { getMyBanStatus, type BanStatus } from "@/lib/admin";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LangSwitcher, useT } from "@/lib/locale";
import { Logo } from "@/components/logo";
import { formatJobDate, formatJobTime, pad2 } from "@/lib/utils";

const BAN_SESSION_KEY = "rabotaem-ban-v1";

function remainingParts(until: string) {
  const ms = Math.max(0, new Date(until).getTime() - Date.now());
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return { days, hours, minutes, done: ms <= 0 };
}

function readCachedBan(): BanStatus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BAN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BanStatus;
    return parsed?.banned ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedBan(row: BanStatus | null) {
  if (typeof window === "undefined") return;
  try {
    if (row?.banned) sessionStorage.setItem(BAN_SESSION_KEY, JSON.stringify(row));
    else sessionStorage.removeItem(BAN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

type BanState = BanStatus | "clear" | "unknown";

export function BanGate({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const skip = pathname.startsWith("/admin");
  const userId = user?.id;
  const [ban, setBan] = useState<BanState>("unknown");

  useEffect(() => {
    if (skip) {
      setBan("clear");
      return;
    }
    const cached = readCachedBan();
    if (cached?.banned) {
      setBan((prev) => (prev !== "clear" && prev !== "unknown" && prev.banned ? prev : cached));
    }
    if (isPending) return;
    if (!userId) {
      writeCachedBan(null);
      setBan("clear");
      return;
    }
    let cancelled = false;
    const load = () => {
      getMyBanStatus()
        .then((row) => {
          if (cancelled) return;
          if (row.banned) {
            writeCachedBan(row);
            setBan(row);
          } else {
            writeCachedBan(null);
            setBan("clear");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setBan((prev) => (prev === "unknown" ? "clear" : prev));
          }
        });
    };
    load();
    const id = window.setInterval(load, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [userId, isPending, skip]);

  if (skip) return <>{children}</>;
  if (ban !== "clear" && ban !== "unknown" && ban.banned) {
    return (
      <BanScreen
        ban={ban}
        onExpired={() => {
          writeCachedBan(null);
          setBan("clear");
        }}
      />
    );
  }
  // While the ban check is in flight the page stays visible: hiding it caused a
  // solid-colour flash on every load for signed-in users. Known bans are shown
  // instantly from the local cache, and the server rejects banned users' actions.
  return <>{children}</>;
}

function BanScreen({ ban, onExpired }: { ban: BanStatus; onExpired: () => void }) {
  const { t } = useT();
  const [tick, setTick] = useState(() => (ban.banned_until ? remainingParts(ban.banned_until) : null));
  const expiredRef = useRef(onExpired);
  expiredRef.current = onExpired;

  useEffect(() => {
    if (ban.permanent || !ban.banned_until) return;
    const id = window.setInterval(() => {
      const next = remainingParts(ban.banned_until as string);
      setTick(next);
      if (next.done) {
        window.clearInterval(id);
        void getMyBanStatus()
          .then((row) => {
            if (!row.banned) expiredRef.current();
          })
          .catch(() => expiredRef.current());
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [ban.permanent, ban.banned_until]);

  const permanent = ban.permanent;
  const reason = ban.reason.trim();

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10" data-testid="ban-screen">
      <div className="pointer-events-none absolute inset-0 bg-canvas" />
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: permanent
            ? "radial-gradient(60% 50% at 50% 20%, color-mix(in srgb, var(--color-danger) 42%, transparent), transparent 70%)"
            : "radial-gradient(60% 50% at 50% 20%, color-mix(in srgb, var(--color-orange) 22%, transparent), transparent 70%)",
        }}
      />
      <div
        className={
          permanent
            ? "relative w-full max-w-lg rounded-[32px] p-6 glass-strong ban-card-perm sm:p-8"
            : "relative w-full max-w-lg rounded-[32px] p-6 glass-strong sm:p-8"
        }
        data-testid={permanent ? "ban-permanent" : "ban-temporary"}
      >
        <div className="flex items-center justify-between gap-3">
          <Logo size="md" />
          <LangSwitcher compact />
        </div>
        <span
          className={
            permanent
              ? "mt-6 grid size-14 place-items-center rounded-full bg-danger text-white"
              : "mt-6 grid size-14 place-items-center rounded-full bg-orange/15 text-orange-deep"
          }
        >
          {permanent ? <ShieldOff className="size-7" /> : <Ban className="size-7" />}
        </span>
        <h1
          className={
            permanent
              ? "mt-4 text-3xl font-semibold tracking-tight text-danger"
              : "mt-4 text-3xl font-semibold tracking-tight text-navy"
          }
        >
          {permanent ? t("ban.permanent") : t("ban.temporary")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {permanent ? t("ban.permanentLead") : t("ban.temporaryLead")}
        </p>

        {permanent ? (
          <p className="mt-4 text-sm text-muted">
            {t("ban.since")}{" "}
            <span className="font-semibold text-navy">
              {ban.banned_at ? `${formatJobDate(ban.banned_at)} ${formatJobTime(ban.banned_at)}` : "—"}
            </span>
          </p>
        ) : (
          <>
            {tick ? (
              <div className="mt-6 flex items-end justify-center gap-1.5 sm:gap-2" aria-live="polite">
                <Digit value={tick.days} label={t("ban.days")} />
                <span className="ban-colon">:</span>
                <Digit value={tick.hours} label={t("ban.hours")} />
                <span className="ban-colon">:</span>
                <Digit value={tick.minutes} label={t("ban.minutes")} />
              </div>
            ) : null}
            {ban.banned_until ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <Clock3 className="size-4 shrink-0" />
                {t("ban.until")}{" "}
                <span className="font-semibold text-navy">
                  {formatJobDate(ban.banned_until)} {formatJobTime(ban.banned_until)}
                </span>
              </p>
            ) : null}
          </>
        )}

        {permanent || reason ? (
          <div
            className={
              permanent
                ? "mt-5 rounded-[20px] bg-danger/10 p-4 ring-1 ring-danger/25"
                : "mt-5 rounded-[20px] bg-navy/6 p-4 dark:bg-white/8"
            }
          >
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">{t("ban.reason")}</p>
            <p className={permanent ? "mt-1.5 text-sm leading-relaxed font-medium text-danger" : "mt-1.5 text-sm leading-relaxed text-navy"} data-testid="ban-reason">
              {reason || t("ban.noReason")}
            </p>
          </div>
        ) : null}

        <p className="mt-5 text-xs leading-relaxed text-subtle">{t("ban.locked")}</p>
        <button
          type="button"
          onClick={() => {
            writeCachedBan(null);
            void signOut("/");
          }}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-white"
        >
          {t("auth.signOut")}
        </button>
      </div>
    </div>
  );
}

function Digit({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[4.5rem] flex-1 rounded-[18px] bg-navy/8 px-2 py-3 text-center dark:bg-white/10">
      <p className="text-3xl font-semibold tabular-nums tracking-tight text-navy">{pad2(value)}</p>
      <p className="mt-1 text-[11px] font-medium tracking-wide text-subtle uppercase">{label}</p>
    </div>
  );
}
