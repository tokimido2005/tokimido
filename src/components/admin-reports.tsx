import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Send } from "lucide-react";
import {
  adminResolveTarget,
  adminTelegramAlertLink,
  adminTelegramAlerts,
  adminTelegramAlertsOff,
  listAdminReportGroups,
  type ReportGroup,
} from "@/lib/admin";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { cn, formatJobDate, formatJobTime } from "@/lib/utils";

type Action = "ok" | "hide" | "delete" | "warn" | "ban";
const NEEDS_REASON: Action[] = ["delete", "warn", "ban"];
const REASON_CHIPS = ["admin.reasonFalse", "admin.reasonScam", "admin.reasonAbuse", "admin.reasonSpam", "admin.reasonRules"] as const;

/** Pending reports grouped per job/user, one decision for all of them. */
export function AdminReportGroups({ history }: { history: ReactNode }) {
  const { t } = useT();
  const [groups, setGroups] = useState<ReportGroup[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ group: ReportGroup; action: Action } | null>(null);
  const [reason, setReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const reload = useCallback(() => {
    return listAdminReportGroups()
      .then(setGroups)
      .catch((err: unknown) => {
        toast.error(errorText(err, t, t("home.loadError")));
        setGroups([]);
      });
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(group: ReportGroup, action: Action, why = "") {
    const key = `${group.target_type}:${group.target_id}`;
    setBusy(key);
    try {
      const res = await adminResolveTarget({
        data: { targetType: group.target_type, targetId: group.target_id, action, reason: why },
      });
      toast.success(t("admin.repDone", { n: res.reporters }));
      setPending(null);
      setReason("");
      await reload();
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusy(null);
    }
  }

  function choose(group: ReportGroup, action: Action) {
    if (NEEDS_REASON.includes(action)) {
      setPending({ group, action });
      setReason(t(`report.${group.items[0]?.reason ?? "other"}`));
      return;
    }
    void run(group, action);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-navy">{t("admin.reports")}</h1>
      <TelegramAlertsCard />
      <div className="mt-4 space-y-3">
        {groups === null ? (
          <div className="h-40 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
        ) : groups.length === 0 ? (
          <p className="rounded-[22px] p-5 text-sm text-muted glass">{t("admin.repNone")}</p>
        ) : (
          groups.map((g) => {
            const key = `${g.target_type}:${g.target_id}`;
            const isJob = g.target_type === "job";
            const gone = isJob && !g.job_title;
            const reasons = [...new Set(g.items.map((i) => i.reason))];
            return (
              <article key={key} className="rounded-[22px] p-5 glass" data-testid="report-group">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                      {isJob ? t("admin.job") : t("admin.user")}
                    </p>
                    {isJob && !gone ? (
                      <Link
                        to="/jobs/$id"
                        params={{ id: g.target_id }}
                        className="mt-0.5 block text-base font-semibold text-navy hover:text-orange"
                      >
                        {g.job_title}
                      </Link>
                    ) : isJob ? (
                      <p className="mt-0.5 text-base font-semibold text-muted">{t("admin.repJobGone")}</p>
                    ) : (
                      <Link
                        to="/u/$userId"
                        params={{ userId: g.target_id }}
                        className="mt-0.5 block text-base font-semibold text-navy hover:text-orange"
                      >
                        {g.owner_name || g.target_id}
                      </Link>
                    )}
                    {isJob && g.owner_name ? <p className="text-xs text-muted">{g.owner_name}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {g.job_hidden ? (
                      <span className="rounded-full bg-navy/8 px-2.5 py-1 text-xs font-semibold text-navy">
                        {t("admin.repHidden")}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
                      {t("admin.repCount", { n: g.n, p: g.reporters })}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {reasons.map((r) => (
                    <span key={r} className="rounded-full bg-orange/12 px-2.5 py-1 text-xs font-semibold text-orange">
                      {t(`report.${r}`)}
                    </span>
                  ))}
                </div>
                <ul className="mt-3 space-y-2">
                  {g.items.slice(0, 5).map((item, i) => (
                    <li key={i} className="rounded-2xl bg-navy/5 px-3 py-2 text-sm dark:bg-white/5">
                      <p className="text-xs text-muted">
                        {item.reporter} · {t(`report.${item.reason}`)} · {formatJobDate(item.at)} {formatJobTime(item.at)}
                      </p>
                      {item.details ? <p className="mt-1 text-navy/85">{item.details}</p> : null}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton tone="ok" disabled={busy === key} onClick={() => choose(g, "ok")}>
                    {t("admin.repOk")}
                  </ActionButton>
                  {isJob && !gone && !g.job_hidden ? (
                    <ActionButton tone="plain" disabled={busy === key} onClick={() => choose(g, "hide")}>
                      {t("admin.repHide")}
                    </ActionButton>
                  ) : null}
                  {isJob && !gone ? (
                    <ActionButton tone="danger" disabled={busy === key} onClick={() => choose(g, "delete")}>
                      {t("admin.repDelete")}
                    </ActionButton>
                  ) : null}
                  {!isJob ? (
                    <ActionButton tone="danger" disabled={busy === key} onClick={() => choose(g, "warn")}>
                      {t("admin.repWarn")}
                    </ActionButton>
                  ) : null}
                  {g.owner_id ? (
                    <ActionButton tone="danger" disabled={busy === key} onClick={() => choose(g, "ban")}>
                      {t("admin.repBan")}
                    </ActionButton>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        className="mt-6 h-11 rounded-full px-4 text-sm font-semibold text-navy ring-1 ring-navy/10 hover:bg-navy/6"
      >
        {t("admin.repHistory")}
      </button>
      {showHistory ? <div className="mt-4">{history}</div> : null}

      {pending ? (
        <div className="fixed inset-0 z-50 grid place-items-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-navy-deep/45 backdrop-blur-sm"
            aria-label={t("confirm.keep")}
            onClick={() => (busy ? undefined : setPending(null))}
          />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-[28px] p-6 glass-strong">
            <h2 className="text-lg font-semibold tracking-tight text-navy">
              {pending.action === "delete"
                ? t("admin.repDelete")
                : pending.action === "warn"
                  ? t("admin.repWarn")
                  : t("admin.repBan")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t("admin.repReasonHint")}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {REASON_CHIPS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setReason(t(k))}
                  className={cn(
                    "h-10 rounded-full px-3 text-sm font-medium",
                    reason === t(k) ? "bg-brand text-white" : "bg-white/45 text-navy ring-1 ring-navy/8 dark:bg-white/8",
                  )}
                >
                  {t(k)}
                </button>
              ))}
            </div>
            <input
              className="field mt-3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("admin.reason")}
              data-testid="report-group-reason"
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="h-11 rounded-full px-4 text-sm font-medium text-muted hover:bg-navy/6"
              >
                {t("confirm.keep")}
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || reason.trim().length < 8}
                onClick={() => void run(pending.group, pending.action, reason.trim())}
                className="h-11 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("admin.repConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  tone,
  disabled,
  onClick,
  children,
}: {
  tone: "ok" | "plain" | "danger";
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50",
        tone === "ok" && "bg-emerald-600 text-white hover:bg-emerald-700",
        tone === "plain" && "bg-white/55 text-navy ring-1 ring-navy/10 dark:bg-white/10",
        tone === "danger" && "text-danger ring-1 ring-danger/30 hover:bg-danger/8",
      )}
    >
      {children}
    </button>
  );
}

function TelegramAlertsCard() {
  const { t } = useT();
  const [state, setState] = useState<{ enabled: boolean; chats: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    adminTelegramAlerts()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  useEffect(() => {
    reload();
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  if (!state) return null;

  async function connect() {
    setBusy(true);
    try {
      const { url } = await adminTelegramAlertLink();
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await adminTelegramAlertsOff();
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] p-4 glass" data-testid="tg-alerts">
      <div className="flex items-start gap-3">
        <Send className="mt-0.5 size-5 text-brand" />
        <div>
          <p className="text-sm font-semibold text-navy">
            {t("admin.tgAlertsT")} ·{" "}
            <span className={state.chats > 0 ? "text-emerald-600" : "text-muted"}>
              {state.chats > 0 ? t("admin.tgAlertsOn") : t("admin.tgAlertsOff")}
            </span>
          </p>
          <p className="text-xs text-muted">{state.enabled ? t("admin.tgAlertsHint") : t("admin.tgNotConfigured")}</p>
        </div>
      </div>
      {state.enabled ? (
        state.chats > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void stop()}
            className="h-10 rounded-full px-4 text-sm font-medium text-muted ring-1 ring-navy/10 hover:bg-navy/6 disabled:opacity-50"
          >
            {t("admin.tgAlertsStop")}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void connect()}
            className="h-10 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("admin.tgAlertsConnect")}
          </button>
        )
      ) : null}
    </div>
  );
}
