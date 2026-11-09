import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Check, CheckCircle2, Download, FileText, Mail, Phone, Save, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CvSummary } from "@/components/cv-document";
import { RateForm } from "@/components/rate-form";
import { RatingBadge } from "@/components/stars";
import { inviteToInterview, markApplicationViewed, saveEmployerNote } from "@/lib/cv";
import { downloadCvFile } from "@/lib/cv-client";
import { normalizeCv } from "@/lib/cv-shared";
import { errorText } from "@/lib/i18n";
import type { Application, InboxJob } from "@/lib/jobs";
import { remainingSlots } from "@/lib/job-status";
import { useT } from "@/lib/locale";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn, combineDateTime, formatJobDate, formatJobTime, tomorrowDateInput } from "@/lib/utils";

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

/** Employer's view of one candidate for an "angajare" job. */
export function CandidateSheet({
  job,
  app,
  busy,
  ratable,
  alreadyRated,
  onStatus,
  onChanged,
  onClose,
}: {
  job: InboxJob;
  app: Application;
  busy: boolean;
  ratable: boolean;
  alreadyRated: boolean;
  onStatus: (s: "selected" | "declined" | "pending") => Promise<void>;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const name = appName(app);
  const cv = app.cv_snapshot ? normalizeCv(app.cv_snapshot) : null;
  const [confirm, setConfirm] = useState<"decline" | "hire" | null>(null);
  const [inviting, setInviting] = useState(false);
  const [date, setDate] = useState(tomorrowDateInput);
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState(() => t("cand.inviteNoteDefault", { address: job.details?.address || job.locality }));
  const [sending, setSending] = useState(false);
  const [memo, setMemo] = useState(app.employer_note ?? "");
  const [savingMemo, setSavingMemo] = useState(false);
  const full = remainingSlots(job) === 0;
  const closed = app.status === "withdrawn" || job.status === "cancelled";
  const canRate = ratable && app.status === "selected" && !alreadyRated;

  useEffect(() => {
    if (!app.viewed_at) void markApplicationViewed({ data: { applicationId: app.id } }).then(onChanged).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirm) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, confirm]);

  async function sendInvite() {
    setSending(true);
    try {
      await inviteToInterview({ data: { applicationId: app.id, at: combineDateTime(date, time), note: note.trim() } });
      toast.success(t("cand.invitedToast"));
      setInviting(false);
      onChanged();
    } catch (err) {
      toast.error(errorText(err, t, t("error.update")));
    } finally {
      setSending(false);
    }
  }

  async function saveMemo() {
    setSavingMemo(true);
    try {
      await saveEmployerNote({ data: { applicationId: app.id, note: memo } });
      toast.success(t("cand.noteSaved"));
      onChanged();
    } catch (err) {
      toast.error(errorText(err, t, t("error.update")));
    } finally {
      setSavingMemo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0 bg-navy-deep/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        data-testid="candidate-sheet"
        className="relative max-h-[94dvh] w-full overflow-y-auto rounded-t-[30px] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] glass-strong sm:max-w-lg sm:rounded-[30px]"
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

        <div className="flex items-center gap-4 pr-10">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-navy/8 text-xl font-bold text-navy">{initials(name)}</span>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-navy">{name}</h2>
            {(app.applicant_rating_count ?? 0) > 0 ? (
              <RatingBadge compact average={app.applicant_rating_avg ?? 0} count={app.applicant_rating_count ?? 0} />
            ) : (
              <span className="text-sm text-muted">{t("inb.noReviews")}</span>
            )}
            <p className="text-xs text-muted">
              {t("cand.applied", { d: formatJobDate(app.created_at) })}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white/70 p-4 ring-1 ring-navy/8 dark:bg-white/8">
          {cv ? (
            <CvSummary cv={cv} />
          ) : app.cv_kind === "file" ? (
            <p className="flex items-center gap-2 text-base text-navy">
              <FileText className="size-5 text-muted" />
              {t("cand.fileCv")}
            </p>
          ) : (
            <p className="text-base text-muted">{t("cv.noCvSent")}</p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {app.cv_kind ? (
            <Link
              to="/cv/a/$id"
              params={{ id: String(app.id) }}
              data-testid="cand-view-cv"
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-brand text-base font-bold text-white"
            >
              <FileText className="size-5" />
              {t("cand.viewCv")}
            </Link>
          ) : (
            <Link
              to="/u/$userId"
              params={{ userId: app.user_id }}
              className="flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold text-navy ring-2 ring-navy/20"
            >
              <UserRound className="size-5" />
              {t("inb.profile")}
            </Link>
          )}
          {app.contact_phone && !closed ? (
            <a
              href={`tel:${app.contact_phone}`}
              data-testid="cand-call"
              className="flex h-14 flex-col items-center justify-center rounded-full bg-[#1d6fd8] text-white"
            >
              <span className="flex items-center gap-1.5 text-base font-bold">
                <Phone className="size-5" />
                {t("inb.call")}
              </span>
              <span className="text-xs text-white/85 tabular-nums">{formatPhoneDisplay(app.contact_phone)}</span>
            </a>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {app.cv_kind === "file" && app.cv_file_id ? (
            <button
              type="button"
              onClick={() => void downloadCvFile(app.cv_file_id!).catch(() => toast.error(t("cv.errNotFound")))}
              className="inline-flex h-10 items-center gap-1.5 text-sm font-semibold text-[#1d6fd8]"
            >
              <Download className="size-4" />
              {t("cv.download")}
            </button>
          ) : null}
          {app.email ? (
            <a href={`mailto:${app.email}`} className="inline-flex h-10 items-center gap-1.5 text-sm font-semibold text-[#1d6fd8]">
              <Mail className="size-4" />
              {app.email}
            </a>
          ) : null}
          {app.cv_kind ? (
            <Link to="/u/$userId" params={{ userId: app.user_id }} className="inline-flex h-10 items-center gap-1.5 text-sm font-semibold text-[#1d6fd8]">
              <UserRound className="size-4" />
              {t("inb.profile")}
            </Link>
          ) : null}
        </div>

        {app.message ? (
          <div className="mt-3 rounded-2xl bg-navy/5 p-4 dark:bg-white/8">
            <p className="text-xs font-semibold text-muted">{t("cv.coverLetter")}</p>
            <p className="mt-1 whitespace-pre-wrap text-base leading-relaxed text-navy">{app.message}</p>
          </div>
        ) : null}

        {app.status === "interview" && app.interview_at ? (
          <div className="mt-4 rounded-2xl bg-[#1d6fd8]/10 p-4" data-testid="cand-interview">
            <p className="flex items-center gap-2 text-base font-bold text-navy">
              <CalendarClock className="size-5" />
              {t("cand.interviewOn", { d: formatJobDate(app.interview_at), h: formatJobTime(app.interview_at) })}
            </p>
            {app.interview_note ? <p className="mt-1 text-sm text-navy">{app.interview_note}</p> : null}
          </div>
        ) : app.status === "selected" ? (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600/12 p-3 text-base font-semibold text-emerald-800 dark:text-emerald-200" data-testid="cand-hired">
            <CheckCircle2 className="size-5" />
            {t("cand.isHired")}
          </p>
        ) : app.status === "declined" ? (
          <p className="mt-4 rounded-2xl bg-navy/6 p-3 text-center text-base font-medium text-muted">{t("inb.isDeclined")}</p>
        ) : app.status === "withdrawn" ? (
          <p className="mt-4 rounded-2xl bg-navy/6 p-3 text-center text-base font-medium text-muted">{t("inb.isWithdrawn")}</p>
        ) : null}

        {canRate ? (
          <div className="mt-4">
            <RateForm jobId={app.job_id} toUserId={app.user_id} otherName={name} otherRole="worker" onDone={onChanged} />
          </div>
        ) : null}

        {!closed && inviting ? (
          <div className="mt-4 space-y-3 rounded-2xl p-4 ring-2 ring-emerald-600/40" data-testid="cand-invite-form">
            <p className="text-base font-semibold text-navy">{t("cand.inviteTitle")}</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="field text-base tabular-nums" value={date} onChange={(e) => setDate(e.target.value)} />
              <input type="time" className="field text-base tabular-nums" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <textarea className="field min-h-24 py-3 text-base" maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setInviting(false)} className="h-12 rounded-full text-base font-medium text-navy ring-1 ring-navy/20">
                {t("inb.declineNo")}
              </button>
              <button
                type="button"
                disabled={sending || !date || !time}
                onClick={() => void sendInvite()}
                data-testid="cand-invite-send"
                className="h-12 rounded-full bg-emerald-600 text-base font-bold text-white disabled:opacity-60"
              >
                {sending ? t("apply.sending") : t("cand.inviteSend")}
              </button>
            </div>
          </div>
        ) : null}

        {!closed && !inviting ? (
          <div className="mt-5 space-y-3">
            {app.status !== "selected" && app.status !== "declined" ? (
              <button
                type="button"
                onClick={() => setInviting(true)}
                data-testid="cand-invite"
                className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 text-lg font-bold text-white shadow-md hover:bg-emerald-700"
              >
                <CalendarClock className="size-5" />
                {app.status === "interview" ? t("cand.reschedule") : t("cand.invite")}
              </button>
            ) : null}
            <div className={cn("grid gap-3", app.status !== "selected" && app.status !== "declined" && "grid-cols-2")}>
              {app.status !== "selected" ? (
                full ? (
                  <p className="rounded-2xl bg-navy/6 p-3 text-center text-sm text-muted">{t("inb.full")}</p>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm("hire")}
                    data-testid="cand-hire"
                    className="flex h-14 items-center justify-center gap-2 rounded-full text-base font-bold text-emerald-700 ring-2 ring-emerald-600/70 hover:bg-emerald-600/8 dark:text-emerald-300"
                  >
                    <Check className="size-5" />
                    {t("cand.hire")}
                  </button>
                )
              ) : null}
              {app.status !== "declined" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirm("decline")}
                  data-testid="cand-decline"
                  className={cn(
                    "flex h-14 items-center justify-center gap-2 rounded-full text-base font-bold text-[#c62828] ring-2 ring-[#c62828]/70 hover:bg-[#c62828]/8 dark:text-red-300",
                    app.status === "selected" && "mx-auto w-full max-w-xs",
                  )}
                >
                  <X className="size-5" />
                  {t("inb.decline")}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-5 border-t border-navy/10 pt-4">
          <label className="block">
            <span className="text-sm font-semibold text-navy">{t("cand.notes")}</span>
            <span className="block text-xs text-muted">{t("cand.notesHint")}</span>
            <textarea
              className="field mt-2 min-h-20 py-3 text-base"
              maxLength={2000}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              data-testid="cand-notes"
            />
          </label>
          {memo !== (app.employer_note ?? "") ? (
            <button
              type="button"
              disabled={savingMemo}
              onClick={() => void saveMemo()}
              className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save className="size-4" />
              {t("cand.saveNote")}
            </button>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "hire" ? t("cand.hireTitle", { name }) : t("inb.declineTitle", { name })}
        body={confirm === "hire" ? t("cand.hireBody") : t("cand.declineBody")}
        confirmLabel={confirm === "hire" ? t("cand.hireYes") : t("inb.declineYes")}
        cancelLabel={t("inb.declineNo")}
        danger={confirm === "decline"}
        busy={busy}
        onConfirm={() => {
          const action = confirm;
          void onStatus(action === "hire" ? "selected" : "declined").then(() => setConfirm(null));
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
