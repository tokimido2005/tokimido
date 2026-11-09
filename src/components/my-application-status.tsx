import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Check, CheckCircle2, Clock3, FileText, MapPin, Navigation, Phone, Wallet } from "lucide-react";
import { isOficial } from "@/lib/job-kinds";
import { formatJobDate, formatJobTime } from "@/lib/utils";
import { toast } from "sonner";
import { cancelApplication, getJobExactLocation, type AppStatus, type Job } from "@/lib/jobs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { JobWhen } from "@/components/job-when";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { formatMdl } from "@/lib/utils";
import { formatPhoneDisplay } from "@/lib/phone";
import { refreshAppsSummary } from "@/lib/apps-summary";

export type MyAppInfo = {
  id: number;
  status: AppStatus;
  posterPhone: string | null;
  viewedAt?: string | null;
  interviewAt?: string | null;
  interviewNote?: string;
  cvKind?: string;
};

function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Big green box at the top of the job page once the worker was selected. */
export function SelectedPanel({ job, app, onChanged }: { job: Job; app: MyAppInfo; onChanged: () => void }) {
  const { t } = useT();
  const [dest, setDest] = useState<{ lat: number; lng: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job.has_geo) return;
    let cancelled = false;
    getJobExactLocation({ data: { jobId: job.id } })
      .then((r) => {
        if (!cancelled && r.visible) setDest({ lat: r.lat, lng: r.lng });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [job.id, job.has_geo]);

  async function cantCome() {
    setBusy(true);
    try {
      await cancelApplication({ data: app.id });
      toast.success(t("my.cantComeDone"));
      setConfirm(false);
      void refreshAppsSummary(true);
      onChanged();
    } catch (err) {
      toast.error(errorText(err, t, t("error.update")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 overflow-hidden rounded-[30px] ring-2 ring-emerald-600/60 glass" data-testid="selected-panel">
      <div className="flex items-center gap-3 bg-emerald-600 px-5 py-4 text-white">
        <CheckCircle2 className="size-8 shrink-0" />
        <div>
          <h2 className="text-xl font-bold">{t(isOficial(job) ? "sel.hiredTitle" : "sel.title")}</h2>
          <p className="text-sm text-white/90">{t(isOficial(job) ? "sel.hiredLead" : "sel.lead")}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <ul className="space-y-3 text-base text-navy">
          {job.starts_at ? (
            <li className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              <span className="font-semibold">
                <JobWhen startsAt={job.starts_at} variant="inline" />
              </span>
            </li>
          ) : null}
          <li className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <span>
              {job.locality}, {job.raion}
              {job.has_geo ? <span className="block text-sm text-muted">{t("sel.mapBelow")}</span> : null}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Wallet className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <span className="font-semibold">{formatMdl(job.payment_mdl)}</span>
          </li>
        </ul>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {dest ? (
            <a
              href={directionsUrl(dest.lat, dest.lng)}
              target="_blank"
              rel="noreferrer"
              data-testid="sel-directions"
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#1d6fd8] text-lg font-bold text-white shadow-md hover:bg-[#185fb8]"
            >
              <Navigation className="size-5" />
              {t("sel.directions")}
            </a>
          ) : null}
          {app.posterPhone ? (
            <a
              href={`tel:${app.posterPhone}`}
              data-testid="sel-call"
              className="flex h-14 flex-col items-center justify-center rounded-full bg-white text-navy ring-2 ring-navy/20 hover:bg-navy/5 dark:bg-white/10"
            >
              <span className="flex items-center gap-2 text-lg font-bold">
                <Phone className="size-5" />
                {t("sel.callPoster")}
              </span>
              <span className="text-xs text-muted tabular-nums">{formatPhoneDisplay(app.posterPhone)}</span>
            </a>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          data-testid="sel-cant-come"
          className="mt-4 flex h-11 w-full items-center justify-center rounded-full text-base font-medium text-danger hover:bg-danger/8"
        >
          {t("my.cantCome")}
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        title={t("my.cantComeTitle")}
        body={t("my.cantComeBody", { job: job.title })}
        confirmLabel={t("my.cantComeYes")}
        cancelLabel={t("confirm.no")}
        danger
        busy={busy}
        onConfirm={() => void cantCome()}
        onClose={() => setConfirm(false)}
      />
    </section>
  );
}

/** Replaces the apply form once the user applied and is waiting, or was not chosen. */
export function AppliedStatus({ job, app, onChanged }: { job: Job; app: MyAppInfo; onChanged: () => void }) {
  const { t } = useT();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      await cancelApplication({ data: app.id });
      toast.success(t("my.cancelDone"));
      setConfirm(false);
      onChanged();
    } catch (err) {
      toast.error(errorText(err, t, t("error.update")));
    } finally {
      setBusy(false);
    }
  }

  if (app.status === "interview") {
    return (
      <section className="mt-5 overflow-hidden rounded-[28px] ring-2 ring-[#1d6fd8]/50 glass" data-testid="apply-interview">
        <div className="flex items-center gap-3 bg-[#1d6fd8] px-5 py-4 text-white">
          <CalendarClock className="size-8 shrink-0" />
          <div>
            <h2 className="text-xl font-bold">{t("my.stInterview")}</h2>
            <p className="text-sm text-white/90">{t("my.interviewLead")}</p>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          {app.interviewAt ? (
            <p className="text-lg font-bold text-navy" data-testid="interview-when">
              {formatJobDate(app.interviewAt)} · {formatJobTime(app.interviewAt)}
            </p>
          ) : null}
          {app.interviewNote ? <p className="mt-2 whitespace-pre-wrap text-base text-navy">{app.interviewNote}</p> : null}
          {app.posterPhone ? (
            <a
              href={`tel:${app.posterPhone}`}
              className="mt-4 flex h-14 items-center justify-center gap-2 rounded-full bg-[#1d6fd8] text-lg font-bold text-white"
            >
              <Phone className="size-5" />
              {t("sel.callPoster")}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="mx-auto mt-3 flex h-11 items-center justify-center rounded-full px-4 text-base font-medium text-danger hover:bg-danger/8"
          >
            {t("my.cantCome")}
          </button>
        </div>
        <ConfirmDialog
          open={confirm}
          title={t("my.cantComeTitle")}
          body={t("my.cantComeBody", { job: job.title })}
          confirmLabel={t("my.cantComeYes")}
          cancelLabel={t("confirm.no")}
          danger
          busy={busy}
          onConfirm={() => void cancel()}
          onClose={() => setConfirm(false)}
        />
      </section>
    );
  }

  if (app.status === "declined") {
    return (
      <section className="mt-5 rounded-[28px] p-6 text-center glass" data-testid="apply-declined">
        <p className="text-lg font-semibold text-navy">{t("my.stDeclined")}</p>
        <p className="mt-2 text-base leading-relaxed text-muted">{t("my.declinedHint")}</p>
        <Link to="/" hash="joburi" className="mt-4 inline-flex h-12 items-center rounded-full bg-brand px-5 text-base font-semibold text-white">
          {t("account.seeJobs")}
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-5 overflow-hidden rounded-[28px] glass" data-testid="apply-done">
      <div className="flex items-center justify-center gap-2 bg-amber-100 px-5 py-3 text-base font-semibold text-amber-900 dark:bg-amber-400/20 dark:text-amber-100">
        <Clock3 className="size-5" />
        {t("my.stWaiting")}
      </div>
      <div className="p-6 text-center">
        {isOficial(job) ? <OfficialProgress app={app} /> : null}
        <p className="text-base leading-relaxed text-muted">{t(isOficial(job) ? "my.waitingHintOficial" : "my.waitingHint")}</p>
        {isOficial(job) ? (
          <Link
            to="/cv/a/$id"
            params={{ id: String(app.id) }}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-full px-4 text-base font-medium text-[#1d6fd8] hover:bg-[#1d6fd8]/8"
          >
            <FileText className="size-4" />
            {t("my.seeSentCv")}
          </Link>
        ) : null}
        <Link
          to="/aplicatii"
          search={{ tab: "trimise" }}
          className="mt-4 inline-flex h-12 items-center rounded-full px-5 text-base font-semibold text-navy ring-1 ring-navy/20 hover:bg-navy/5"
        >
          {t("my.allMine")}
        </Link>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          data-testid="apply-cancel"
          className="mx-auto mt-2 flex h-11 items-center justify-center rounded-full px-4 text-base font-medium text-danger hover:bg-danger/8"
        >
          {t("my.cancel")}
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        title={t("my.cancelTitle")}
        body={t("my.cancelBody", { job: job.title })}
        confirmLabel={t("my.cancelYes")}
        cancelLabel={t("confirm.no")}
        danger
        busy={busy}
        onConfirm={() => void cancel()}
        onClose={() => setConfirm(false)}
      />
    </section>
  );
}

/** Sent → Seen → Interview → Answer, for "angajare" applications. */
export function OfficialProgress({ app }: { app: Pick<MyAppInfo, "status" | "viewedAt"> }) {
  const { t } = useT();
  const steps = [
    { key: "sent", done: true },
    { key: "seen", done: Boolean(app.viewedAt) || app.status !== "pending" },
    { key: "interview", done: app.status === "interview" || app.status === "selected" },
    { key: "answer", done: app.status === "selected" || app.status === "declined" },
  ];
  return (
    <ol className="mb-4 grid grid-cols-4 gap-1 text-left" data-testid="official-progress">
      {steps.map((s, i) => (
        <li key={s.key} className="flex flex-col items-center gap-1.5 text-center">
          <span
            className={
              s.done
                ? "grid size-9 place-items-center rounded-full bg-emerald-600 text-white"
                : "grid size-9 place-items-center rounded-full bg-navy/8 text-sm font-bold text-muted"
            }
          >
            {s.done ? <Check className="size-5" /> : i + 1}
          </span>
          <span className={s.done ? "text-xs font-semibold text-navy" : "text-xs text-muted"}>{t(`my.prog.${s.key}`)}</span>
        </li>
      ))}
    </ol>
  );
}
