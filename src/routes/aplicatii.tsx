import { errorText } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import {
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Phone,
  RefreshCw,
  Settings2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { StatusBadge } from "@/components/status-badge";
import { JobWhen } from "@/components/job-when";
import { RateForm } from "@/components/rate-form";
import { RatingBadge } from "@/components/stars";
import { MyApplications } from "@/components/my-applications";
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
import { canComplete, canReactivate, remainingSlots } from "@/lib/job-status";
import { cn, combineDateTime, formatMdl, toDateInputValue, toTimeInputValue, tomorrowDateInput } from "@/lib/utils";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyRatingsGiven, listPendingRatings } from "@/lib/ratings";
import { ConfirmDialog, EmptyState } from "@/components/confirm-dialog";
import { useT } from "@/lib/locale";
import { seoHead } from "@/lib/seo";
import { formatPhoneDisplay } from "@/lib/phone";
import { refreshAppsSummary, useAppsSummary } from "@/lib/apps-summary";

type View = "primite" | "trimise";

export const Route = createFileRoute("/aplicatii")({
  head: () => seoHead("Aplicații", "Aplicațiile primite la anunțurile tale și cele la care ai aplicat, pe Rabotaem.md."),
  validateSearch: (s: Record<string, unknown>): { tab?: View } => ({
    tab: s.tab === "primite" || s.tab === "trimise" ? s.tab : undefined,
  }),
  component: AppsPage,
});

function AppsPage() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { newApplicants, unseen } = useAppsSummary();
  const [jobs, setJobs] = useState<InboxJob[] | null>(null);
  const [auto, setAuto] = useState<View | null>(null);

  // Pick the side with news when no tab was asked for.
  useEffect(() => {
    if (search.tab || auto || jobs === null) return;
    if (unseen.length > 0) setAuto("trimise");
    else if (jobs.length === 0) setAuto("trimise");
    else setAuto("primite");
  }, [search.tab, auto, jobs, unseen.length]);

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

  const view: View = search.tab ?? auto ?? "primite";
  const setView = (v: View) => void navigate({ to: "/aplicatii", search: { tab: v }, replace: true });

  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-navy">{t("nav.apps")}</h1>
        <div
          role="tablist"
          aria-label={t("nav.apps")}
          className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-navy/6 p-1.5 dark:bg-white/8"
        >
          <ViewTab active={view === "primite"} onClick={() => setView("primite")} badge={newApplicants} testId="view-primite">
            {t("inb.tabReceived")}
          </ViewTab>
          <ViewTab active={view === "trimise"} onClick={() => setView("trimise")} badge={unseen.length} testId="view-trimise">
            {t("inb.tabSent")}
          </ViewTab>
        </div>
        <p className="mt-3 text-sm text-muted">{t(view === "primite" ? "inb.leadReceived" : "inb.leadSent")}</p>
        <div className="mt-5">
          {view === "primite" ? <ReceivedView onJobs={setJobs} /> : <MyApplications />}
          {view === "trimise" && jobs === null ? <ReceivedLoader onJobs={setJobs} /> : null}
        </div>
      </main>
    </Shell>
  );
}

/** Loads the poster inbox only to decide which tab to open first. */
function ReceivedLoader({ onJobs }: { onJobs: (j: InboxJob[]) => void }) {
  useEffect(() => {
    listPosterInbox()
      .then(onJobs)
      .catch(() => onJobs([]));
  }, [onJobs]);
  return null;
}

function ViewTab({
  active,
  onClick,
  badge,
  testId,
  children,
}: {
  active: boolean;
  onClick: () => void;
  badge: number;
  testId: string;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex min-h-12 items-center justify-center gap-2 rounded-full px-3 text-center text-base leading-tight font-semibold transition-colors",
        active ? "bg-white text-navy shadow-sm dark:bg-white/20" : "text-muted hover:text-navy",
      )}
    >
      {children}
      {badge > 0 ? (
        <span className="grid min-w-6 place-items-center rounded-full bg-orange px-1.5 text-xs leading-6 font-bold text-white tabular-nums">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}

function ReceivedView({ onJobs }: { onJobs: (j: InboxJob[]) => void }) {
  const { t } = useT();
  const [jobs, setJobs] = useState<InboxJob[]>([]);
  const [given, setGiven] = useState<Array<{ job_id: number; to_user_id: string }>>([]);
  const [ratable, setRatable] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ type: "delete" | "cancel"; jobId: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openApp, setOpenApp] = useState<{ appId: number; jobId: number } | null>(null);

  const reload = useCallback(() => {
    return Promise.all([listPosterInbox(), listMyRatingsGiven(), listPendingRatings()])
      .then(([inbox, ratings, pending]) => {
        setJobs(inbox);
        onJobs(inbox);
        setGiven(ratings);
        setRatable(new Set(pending.map((p) => `${p.jobId}:${p.otherUserId}`)));
        setLoaded(true);
      })
      .catch((err: unknown) => {
        toast.error(errorText(err, t, t("error.loadApps")));
        setJobs([]);
        onJobs([]);
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function setStatus(applicationId: number, status: "contacted" | "selected" | "declined" | "pending") {
    if (status !== "contacted") setBusyId(applicationId);
    try {
      await updateApplicationStatus({ data: { applicationId, status } });
      if (status === "selected") toast.success(t("inb.selectedToast"));
      if (status === "declined") toast.success(t("inb.declinedToast"));
      await reload();
      void refreshAppsSummary(true);
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

  async function runConfirm() {
    if (!confirm) return;
    const { jobId, type } = confirm;
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
      void refreshAppsSummary(true);
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusyId(null);
    }
  }

  async function onReactivate(jobId: number, date: string, time: string) {
    setBusyId(jobId);
    try {
      await reactivateJob({ data: { jobId, starts_at: combineDateTime(date, time) } });
      toast.success(t("apps.reactivatedToast"));
      await reload();
    } catch (err) {
      toast.error(errorText(err, t, t("error.reactivate")));
    } finally {
      setBusyId(null);
    }
  }

  if (!loaded) return <div className="h-40 animate-pulse rounded-[28px] bg-white/40 dark:bg-white/8" />;
  if (jobs.length === 0) {
    return (
      <EmptyState title={t("profile.nonePosted")} body={t("account.emptyPostedBody")}>
        <Link to="/post" className="inline-flex h-12 items-center rounded-full bg-brand px-5 text-base font-semibold text-white">
          {t("home.ctaPost")}
        </Link>
      </EmptyState>
    );
  }

  const sheetJob = openApp ? jobs.find((j) => j.id === openApp.jobId) : undefined;
  const sheetApp = sheetJob?.applicants.find((a) => a.id === openApp?.appId);

  return (
    <div className="space-y-5">
      {jobs.map((job) => (
        <JobInboxCard
          key={job.id}
          job={job}
          busy={busyId === job.id}
          onOpen={(appId) => setOpenApp({ appId, jobId: job.id })}
          onComplete={() => void onComplete(job.id)}
          onCancel={() => setConfirm({ type: "cancel", jobId: job.id })}
          onDelete={() => setConfirm({ type: "delete", jobId: job.id })}
          onReactivate={(d, tm) => void onReactivate(job.id, d, tm)}
        />
      ))}
      {sheetJob && sheetApp ? (
        <ApplicantSheet
          job={sheetJob}
          app={sheetApp}
          busy={busyId === sheetApp.id}
          ratable={ratable.has(`${sheetJob.id}:${sheetApp.user_id}`)}
          alreadyRated={given.some((g) => g.job_id === sheetJob.id && g.to_user_id === sheetApp.user_id)}
          onStatus={(st) => setStatus(sheetApp.id, st)}
          onRated={() => void reload()}
          onClose={() => setOpenApp(null)}
        />
      ) : null}
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
    </div>
  );
}

const ORDER: Record<string, number> = { pending: 0, contacted: 0, selected: 1, declined: 2, withdrawn: 2 };

function JobInboxCard({
  job,
  busy,
  onOpen,
  onComplete,
  onCancel,
  onDelete,
  onReactivate,
}: {
  job: InboxJob;
  busy: boolean;
  onOpen: (appId: number) => void;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onReactivate: (date: string, time: string) => void;
}) {
  const { t } = useT();
  const [manage, setManage] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const sorted = [...job.applicants].sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3));
  const active = sorted.filter((a) => (ORDER[a.status] ?? 3) < 2);
  const old = sorted.filter((a) => (ORDER[a.status] ?? 3) >= 2);
  const full = remainingSlots(job) === 0;
  const people = Math.max(1, job.people_needed);

  return (
    <section className="rounded-[28px] p-5 glass sm:p-6" data-testid="inbox-job">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/jobs/$id" params={{ id: String(job.id) }} className="text-xl font-semibold text-navy hover:text-orange">
          {job.title}
        </Link>
        <StatusBadge job={job} />
      </div>
      <p className="mt-1.5 text-base text-muted">
        {job.locality} · {formatMdl(job.payment_mdl)}
      </p>
      {job.starts_at ? (
        <p className="mt-1 text-base font-medium text-navy">
          <JobWhen startsAt={job.starts_at} variant="inline" />
        </p>
      ) : null}
      <p
        className={cn(
          "mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
          full ? "bg-emerald-600/12 text-emerald-800 dark:text-emerald-200" : "bg-navy/6 text-navy",
        )}
        data-testid="inbox-slots"
      >
        {full ? <CheckCircle2 className="size-4" /> : null}
        {full ? t("inb.full") : t("inb.slots", { sel: job.selected_count, n: people })}
      </p>

      {canReactivate(job) ? (
        <ReactivatePanel job={job} busy={busy} onSubmit={onReactivate} />
      ) : null}

      {job.applicants.length === 0 ? (
        <p className="mt-4 text-base text-muted">{t("apps.none")}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {active.map((a) => (
            <ApplicantRow key={a.id} app={a} onOpen={() => onOpen(a.id)} />
          ))}
          {old.length > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setShowOld((v) => !v)}
                aria-expanded={showOld}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-sm font-medium text-muted hover:bg-navy/5"
              >
                {t("inb.oldOnes", { n: old.length })}
                <ChevronDown className={cn("size-4 transition-transform", showOld && "rotate-180")} />
              </button>
            </li>
          ) : null}
          {showOld ? old.map((a) => <ApplicantRow key={a.id} app={a} onOpen={() => onOpen(a.id)} />) : null}
        </ul>
      )}

      <div className="mt-4 border-t border-navy/10 pt-3">
        <button
          type="button"
          onClick={() => setManage((v) => !v)}
          aria-expanded={manage}
          data-testid="manage-job"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-navy hover:bg-navy/5"
        >
          <Settings2 className="size-4" />
          {t("inb.manage")}
          <ChevronDown className={cn("size-4 transition-transform", manage && "rotate-180")} />
        </button>
        {manage ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {canComplete(job) ? (
              <button
                type="button"
                disabled={busy}
                onClick={onComplete}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-4 text-base font-semibold text-white disabled:opacity-60"
              >
                <CheckCircle2 className="size-4" />
                {t("inb.markDone")}
              </button>
            ) : null}
            {job.status !== "cancelled" && job.status !== "completed" ? (
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/70 px-4 text-base font-medium text-navy ring-1 ring-navy/15 disabled:opacity-60 dark:bg-white/10"
              >
                <Ban className="size-4" />
                {t("confirm.cancelJob")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-4 text-base font-medium text-danger ring-1 ring-danger/30 hover:bg-danger/8 disabled:opacity-60"
            >
              <Trash2 className="size-4" />
              {t("inb.deleteJob")}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function appName(app: Application) {
  return [app.first_name, app.last_name].filter(Boolean).join(" ") || app.applicant_name;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function StatusPill({ status }: { status: string }) {
  const { t } = useT();
  const map: Record<string, { cls: string; key: string }> = {
    pending: { cls: "bg-orange text-white", key: "inb.stNew" },
    contacted: { cls: "bg-orange/15 text-orange-deep", key: "inb.stCalled" },
    selected: { cls: "bg-emerald-600 text-white", key: "inb.stSelected" },
    declined: { cls: "bg-navy/8 text-muted", key: "inb.stDeclined" },
    withdrawn: { cls: "bg-navy/8 text-muted", key: "inb.stWithdrawn" },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", m.cls)} data-testid="applicant-status">
      {t(m.key)}
    </span>
  );
}

function ApplicantRow({ app, onOpen }: { app: Application; onOpen: () => void }) {
  const { t } = useT();
  const name = appName(app);
  const dim = app.status === "declined" || app.status === "withdrawn";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        data-testid="applicant-row"
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl bg-white/60 p-3 text-left ring-1 ring-navy/8 transition-colors hover:bg-white/90 dark:bg-white/8 dark:hover:bg-white/12",
          dim && "opacity-70",
        )}
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy/8 text-base font-bold text-navy">
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-navy">{name}</span>
          {(app.applicant_rating_count ?? 0) > 0 ? (
            <RatingBadge compact average={app.applicant_rating_avg ?? 0} count={app.applicant_rating_count ?? 0} />
          ) : (
            <span className="text-sm text-muted">{t("inb.noReviews")}</span>
          )}
        </span>
        <StatusPill status={app.status} />
        <ChevronRight className="size-5 shrink-0 text-muted" />
      </button>
    </li>
  );
}

function ApplicantSheet({
  job,
  app,
  busy,
  ratable,
  alreadyRated,
  onStatus,
  onRated,
  onClose,
}: {
  job: InboxJob;
  app: Application;
  busy: boolean;
  ratable: boolean;
  alreadyRated: boolean;
  onStatus: (s: "contacted" | "selected" | "declined" | "pending") => Promise<void>;
  onRated: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [confirmDecline, setConfirmDecline] = useState(false);
  const name = appName(app);
  const full = remainingSlots(job) === 0;
  const decided = app.status === "selected";
  const canDecide = app.status !== "withdrawn" && job.status !== "cancelled";
  const canRate = ratable && app.status === "selected" && !alreadyRated;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirmDecline) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, confirmDecline]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0 bg-navy-deep/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        data-testid="applicant-sheet"
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] glass-strong sm:max-w-md sm:rounded-[30px]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("inb.close")}
          className="absolute top-4 right-4 grid size-11 place-items-center rounded-full text-muted hover:bg-navy/8"
        >
          <X className="size-6" />
        </button>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-navy/15 sm:hidden" aria-hidden="true" />

        <div className="flex flex-col items-center text-center">
          <span className="grid size-20 place-items-center rounded-full bg-navy/8 text-2xl font-bold text-navy">
            {initials(name)}
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-navy">{name}</h2>
          <div className="mt-1.5">
            {(app.applicant_rating_count ?? 0) > 0 ? (
              <RatingBadge average={app.applicant_rating_avg ?? 0} count={app.applicant_rating_count ?? 0} className="text-base" />
            ) : (
              <span className="text-base text-muted">{t("inb.noReviews")}</span>
            )}
          </div>
          <Link
            to="/u/$userId"
            params={{ userId: app.user_id }}
            data-testid="applicant-profile"
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-full px-4 text-base font-medium text-navy ring-1 ring-navy/20 hover:bg-navy/5"
          >
            <UserRound className="size-4" />
            {t("inb.profile")}
          </Link>
          <p className="mt-3 text-sm text-muted">
            {t("inb.forJob")} <span className="font-medium text-navy">{job.title}</span>
          </p>
        </div>

        {app.contact_phone && app.status !== "withdrawn" ? (
          <a
            href={`tel:${app.contact_phone}`}
            data-testid="applicant-call"
            onClick={() => {
              if (app.status === "pending") void onStatus("contacted");
            }}
            className="mt-5 flex h-16 w-full flex-col items-center justify-center rounded-full bg-[#1d6fd8] text-white shadow-lg hover:bg-[#185fb8]"
          >
            <span className="flex items-center gap-2 text-lg font-bold">
              <Phone className="size-5" />
              {t("inb.call")}
            </span>
            <span className="text-sm text-white/85 tabular-nums">{formatPhoneDisplay(app.contact_phone)}</span>
          </a>
        ) : null}

        {app.message ? (
          <div className="mt-4 rounded-2xl bg-navy/5 p-4 dark:bg-white/8">
            <p className="text-xs font-semibold text-muted">{t("inb.message")}</p>
            <p className="mt-1 text-base leading-relaxed text-navy">{app.message}</p>
          </div>
        ) : null}

        {app.status === "selected" ? (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600/12 p-3 text-base font-semibold text-emerald-800 dark:text-emerald-200" data-testid="sheet-selected">
            <CheckCircle2 className="size-5" />
            {t("inb.isSelected")}
          </p>
        ) : app.status === "declined" ? (
          <p className="mt-4 rounded-2xl bg-navy/6 p-3 text-center text-base font-medium text-muted">{t("inb.isDeclined")}</p>
        ) : app.status === "withdrawn" ? (
          <p className="mt-4 rounded-2xl bg-navy/6 p-3 text-center text-base font-medium text-muted">{t("inb.isWithdrawn")}</p>
        ) : null}

        {canRate ? (
          <div className="mt-4">
            <RateForm jobId={app.job_id} toUserId={app.user_id} otherName={name} otherRole="worker" onDone={onRated} />
          </div>
        ) : alreadyRated && app.status === "selected" ? (
          <p className="mt-3 text-center text-sm font-medium text-navy">{t("apps.alreadyRated")}</p>
        ) : null}

        {canDecide ? (
          <div className={cn("mt-5 grid gap-3", !decided && app.status !== "declined" && "sm:grid-cols-2")}>
            {!decided ? (
              full ? (
                <p className="rounded-2xl bg-navy/6 p-3 text-center text-sm text-muted sm:col-span-2">{t("inb.fullNoSelect")}</p>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onStatus("selected")}
                  data-testid="applicant-select"
                  className="flex h-14 items-center justify-center gap-2 rounded-full bg-emerald-600 text-lg font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Check className="size-5" />
                  {t("inb.select")}
                </button>
              )
            ) : null}
            {app.status !== "declined" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDecline(true)}
                data-testid="applicant-decline"
                className={cn(
                  "flex h-14 items-center justify-center gap-2 rounded-full text-lg font-bold text-[#c62828] ring-2 ring-[#c62828]/70 hover:bg-[#c62828]/8 disabled:opacity-60 dark:text-red-300 dark:ring-red-300/70",
                  decided && "mx-auto w-full max-w-xs",
                )}
              >
                <X className="size-5" />
                {t("inb.decline")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmDecline}
        title={t("inb.declineTitle", { name })}
        body={t(decided ? "inb.declineBodySelected" : "inb.declineBody")}
        confirmLabel={t("inb.declineYes")}
        cancelLabel={t("inb.declineNo")}
        danger
        busy={busy}
        onConfirm={() => {
          void onStatus("declined").then(() => setConfirmDecline(false));
        }}
        onClose={() => setConfirmDecline(false)}
      />
    </div>
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

