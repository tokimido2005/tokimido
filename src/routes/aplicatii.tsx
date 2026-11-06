import { errorText } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Ban, Bell, CheckCircle2, Phone, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { StatusBadge } from "@/components/status-badge";
import { JobWhen } from "@/components/job-when";
import { RateForm } from "@/components/rate-form";
import {
  cancelJob,
  completeJob,
  deleteJob,
  listPosterInbox,
  reactivateJob,
  updateApplicationStatus,
  type Application,
  type InboxJob,
} from "@/lib/jobs";
import { canComplete, canReactivate, formatSlots, remainingSlots } from "@/lib/job-status";
import { combineDateTime, formatMdl, toDateInputValue, toTimeInputValue, tomorrowDateInput } from "@/lib/utils";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyRatingsGiven } from "@/lib/ratings";
import { ConfirmDialog, EmptyState } from "@/components/confirm-dialog";
import { useT } from "@/lib/locale";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/aplicatii")({
  head: () => seoHead("Aplicații", "Gestionează anunțurile și aplicațiile primite pe Rabotaem.md."),
  component: Inbox,
});

function Inbox() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const [jobs, setJobs] = useState<InboxJob[]>([]);
  const [given, setGiven] = useState<Array<{ job_id: number; to_user_id: string }>>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ type: "delete" | "cancel"; jobId: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    return Promise.all([listPosterInbox(), listMyRatingsGiven()])
      .then(([inbox, ratings]) => {
        setJobs(inbox);
        setGiven(ratings);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        toast.error(errorText(err, t, t("error.loadApps")));
        setJobs([]);
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    void reload();
  }, [user, reload]);

  if (isPending) {
    return (
      <Shell>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <div className="h-64 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }
  if (!user) return <Navigate to="/login" search={{ next: "/aplicatii" }} />;

  const pendingCount =
    jobs.reduce((n, j) => n + j.applicants.filter((a) => a.status === "pending").length, 0);

  async function setStatus(applicationId: number, status: "contacted" | "selected" | "declined" | "withdrawn") {
    setBusyId(applicationId);
    try {
      await updateApplicationStatus({ data: { applicationId, status } });
      if (status === "selected") {
        const job = jobs.find((j) => j.applicants.some((a) => a.id === applicationId));
        if (job?.has_geo) toast.success(t("map.selectedHint"));
      }
      await reload();
    } catch (err) {
      toast.error(errorText(err, t, t("error.update")));
    } finally {
      setBusyId(null);
    }
  }

  async function onComplete(jobId: number) {
    setBusyId(jobId);
    try {
      await completeJob({ data: jobId });
      toast.success(t("apps.doneToast"));
      await reload();
    } catch (err) {
      toast.error(errorText(err, t, t("error.update")));
    } finally {
      setBusyId(null);
    }
  }

  async function onCancel(jobId: number) {
    setConfirm({ type: "cancel", jobId });
  }

  async function onDelete(jobId: number) {
    setConfirm({ type: "delete", jobId });
  }

  async function runConfirm() {
    if (!confirm) return;
    const jobId = confirm.jobId;
    const type = confirm.type;
    setBusyId(jobId);
    try {
      if (type === "cancel") {
        await cancelJob({ data: jobId });
        toast.success(t("toast.cancelled"));
      } else {
        await deleteJob({ data: jobId });
        toast.success(t("toast.deleted"));
      }
      setConfirm(null);
      await reload();
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusyId(null);
    }
  }

  async function onReactivate(jobId: number, date: string, time: string) {
    setBusyId(jobId);
    try {
      await reactivateJob({
        data: {
          jobId,
          starts_at: combineDateTime(date, time),
        },
      });
      toast.success(t("apps.reactivatedToast"));
      await reload();
    } catch (err) {
      toast.error(errorText(err, t, t("error.reactivate")));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-navy">{t("apps.title")}</h1>
            <p className="mt-2 text-sm text-muted">{t("apps.lead")}</p>
          </div>
          {pendingCount > 0 ? (
            <span className="inline-flex h-10 items-center gap-2 rounded-full bg-orange px-3 text-sm font-semibold text-white">
              <Bell className="size-4" />
              {pendingCount} {pendingCount === 1 ? t("apps.newOne") : t("apps.newMany")}
            </span>
          ) : null}
        </div>

        {!loaded ? (
          <div className="mt-6 h-40 animate-pulse rounded-[28px] bg-white/40 dark:bg-white/8" />
        ) : jobs.length === 0 ? (
          <div className="mt-6">
            <EmptyState title={t("profile.nonePosted")} body={t("account.emptyPostedBody")}>
              <Link
                to="/post"
                className="inline-flex h-12 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white"
              >
                {t("home.ctaPost")}
              </Link>
            </EmptyState>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {jobs.map((job) => (
              <section key={job.id} className="rounded-[28px] p-5 glass sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/jobs/$id"
                        params={{ id: String(job.id) }}
                        className="text-lg font-semibold text-navy hover:text-orange"
                      >
                        {job.title}
                      </Link>
                      <StatusBadge job={job} />
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {job.locality}, {job.raion} · {formatMdl(job.payment_mdl)} · {formatSlots(job)} locuri
                    </p>
                    {job.has_geo ? (
                      <p className="mt-1 text-xs text-muted">{t("map.inboxHint")}</p>
                    ) : null}
                    <p className="mt-1 text-sm font-medium text-navy">
                      <JobWhen startsAt={job.starts_at} variant="inline" />
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canComplete(job) ? (
                      <button
                        type="button"
                        disabled={busyId === job.id}
                        onClick={() => void onComplete(job.id)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-3.5 text-sm font-semibold text-white"
                      >
                        <CheckCircle2 className="size-3.5" />
                        {t("apps.completed")}
                      </button>
                    ) : null}
                    {job.status !== "cancelled" ? (
                      <button
                        type="button"
                        disabled={busyId === job.id}
                        onClick={() => void onCancel(job.id)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/70 dark:bg-white/10 px-3.5 text-sm font-medium text-navy ring-1 ring-navy/10"
                      >
                        <Ban className="size-3.5" />
                        {t("apps.cancel")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyId === job.id}
                      onClick={() => void onDelete(job.id)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                      {t("apps.delete")}
                    </button>
                  </div>
                </div>

                {canReactivate(job) ? (
                  <ReactivatePanel
                    job={job}
                    busy={busyId === job.id}
                    onSubmit={(date, time) => void onReactivate(job.id, date, time)}
                  />
                ) : null}

                {job.applicants.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">{t("apps.none")}</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {job.applicants.map((a) => (
                      <ApplicantRow
                        key={a.id}
                        app={a}
                        jobCompleted={job.status === "completed"}
                        alreadyRated={given.some((g) => g.job_id === job.id && g.to_user_id === a.user_id)}
                        busy={busyId === a.id}
                        onStatus={(s) => void setStatus(a.id, s)}
                        onRated={() => void reload()}
                      />
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === "delete" ? t("confirm.deleteTitle") : t("confirm.cancelTitle")}
        body={confirm?.type === "delete" ? t("confirm.deleteBody") : t("confirm.cancelBody")}
        confirmLabel={confirm?.type === "delete" ? t("confirm.delete") : t("confirm.cancelJob")}
        cancelLabel={t("confirm.keep")}
        danger={confirm?.type === "delete"}
        busy={busyId === confirm?.jobId}
        onConfirm={() => void runConfirm()}
        onClose={() => setConfirm(null)}
      />
    </Shell>
  );
}

function ReactivatePanel({
  job,
  busy,
  onSubmit,
}: {
  job: InboxJob;
  busy: boolean;
  onSubmit: (date: string, time: string) => void;
}) {
  const { t } = useT();
  const expired = job.status === "expired";
  const past = job.starts_at ? new Date(job.starts_at).getTime() <= Date.now() : false;
  const [date, setDate] = useState(() =>
    past ? tomorrowDateInput() : toDateInputValue(job.starts_at ?? undefined),
  );
  const [time, setTime] = useState(() =>
    past ? "09:00" : toTimeInputValue(job.starts_at ?? undefined),
  );
  const left = remainingSlots(job);

  return (
    <div className="mt-4 rounded-2xl bg-orange/12 p-4">
      <p className="text-sm font-semibold text-navy">
        {expired
          ? t("apps.expiredReactivate")
          : left === 1
            ? t("apps.oneFreed")
            : t("apps.slotsLeft", { n: left })}
      </p>
      <p className="mt-1 text-xs text-muted">
        {t("apps.reactivateHint")}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className="field tabular-nums"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          className="field tabular-nums"
          type="time"
          required
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !date || !time}
          onClick={() => onSubmit(date, time)}
          className="sheen inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold glass-orange disabled:opacity-60"
        >
          <RefreshCw className="size-3.5" />
          {t("apps.reactivateBtn")}
        </button>
      </div>
    </div>
  );
}

function ApplicantRow({
  app,
  busy,
  jobCompleted,
  alreadyRated,
  onStatus,
  onRated,
}: {
  app: Application;
  busy: boolean;
  jobCompleted: boolean;
  alreadyRated: boolean;
  onStatus: (status: "contacted" | "selected" | "declined" | "withdrawn") => void;
  onRated: () => void;
}) {
  const { t } = useT();
  const name = [app.first_name, app.last_name].filter(Boolean).join(" ") || app.applicant_name;
  const label =
    app.status === "selected"
      ? "Selectat"
      : app.status === "contacted"
        ? "Contactat"
        : app.status === "declined"
          ? "Refuzat"
          : app.status === "withdrawn"
            ? "A anulat"
            : "Nou";
  const canRate = jobCompleted && app.status === "selected" && !alreadyRated;

  return (
    <li className="rounded-2xl bg-white/55 dark:bg-white/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            to="/u/$userId"
            params={{ userId: app.user_id }}
            className="font-semibold text-navy hover:text-orange"
          >
            {name}
          </Link>
          {app.contact_phone ? (
            <a href={`tel:${app.contact_phone}`} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-orange">
              <Phone className="size-3.5" />
              {app.contact_phone}
            </a>
          ) : null}
        </div>
        <span className="rounded-full bg-navy/8 px-2.5 py-1 text-xs font-semibold text-navy">{label}</span>
      </div>
      {app.message ? <p className="mt-2 text-sm leading-relaxed text-muted">{app.message}</p> : null}
      {alreadyRated && jobCompleted && app.status === "selected" ? (
        <p className="mt-3 text-xs font-medium text-navy">{t("apps.alreadyRated")}</p>
      ) : null}
      {canRate ? (
        <div className="mt-3">
          <RateForm
            jobId={app.job_id}
            toUserId={app.user_id}
            otherName={name}
            otherRole="worker"
            onDone={onRated}
          />
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionBtn
          active={app.status === "contacted"}
          disabled={busy}
          onClick={() => onStatus("contacted")}
        >
          Am contactat
        </ActionBtn>
        <ActionBtn
          active={app.status === "selected"}
          disabled={busy}
          onClick={() => onStatus("selected")}
          accent
        >
          Selectat
        </ActionBtn>
        <ActionBtn
          active={app.status === "withdrawn"}
          disabled={busy}
          onClick={() => onStatus("withdrawn")}
        >
          A anulat
        </ActionBtn>
        <ActionBtn
          active={app.status === "declined"}
          disabled={busy}
          onClick={() => onStatus("declined")}
        >
          Nu mai am nevoie
        </ActionBtn>
      </div>
    </li>
  );
}

function ActionBtn({
  active,
  disabled,
  onClick,
  children,
  accent,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: string;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        active
          ? accent
            ? "h-10 rounded-full bg-orange px-3.5 text-sm font-semibold text-white"
            : "h-10 rounded-full bg-brand px-3.5 text-sm font-semibold text-white"
          : "h-10 rounded-full bg-white/70 dark:bg-white/10 px-3.5 text-sm font-medium text-navy ring-1 ring-navy/10"
      }
    >
      {children}
    </button>
  );
}
