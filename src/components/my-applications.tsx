import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronDown, ChevronRight, Clock3, MapPin, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cancelApplication, listMyApplications, type MyApplication } from "@/lib/jobs";
import { listPendingRatings, type PendingRating } from "@/lib/ratings";
import { RateForm } from "@/components/rate-form";
import { JobWhen } from "@/components/job-when";
import { ConfirmDialog, EmptyState } from "@/components/confirm-dialog";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { formatMdl } from "@/lib/utils";
import { markSelectedSeen, refreshAppsSummary } from "@/lib/apps-summary";
import { cn } from "@/lib/utils";

const ACTIVE = new Set(["pending", "contacted", "selected"]);

/** "Where I applied": the worker side of the Applications page. */
export function MyApplications({ onCount }: { onCount?: (n: number) => void }) {
  const { t } = useT();
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [pending, setPending] = useState<PendingRating[]>([]);
  const [confirm, setConfirm] = useState<MyApplication | null>(null);
  const [busy, setBusy] = useState(false);
  const [showOld, setShowOld] = useState(false);

  const reload = useCallback(() => {
    return Promise.all([listMyApplications(), listPendingRatings().catch(() => [])])
      .then(([list, p]) => {
        setApps(list);
        setPending(p);
        onCount?.(list.length);
      })
      .catch((err: unknown) => {
        toast.error(errorText(err, t, t("error.loadApps")));
        setApps([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Seeing the list counts as having seen the "selected" news.
  useEffect(() => {
    if (!apps) return;
    markSelectedSeen(apps.filter((a) => a.status === "selected").map((a) => a.id));
  }, [apps]);

  async function runCancel() {
    if (!confirm) return;
    setBusy(true);
    try {
      await cancelApplication({ data: confirm.id });
      toast.success(t(confirm.status === "selected" ? "my.cantComeDone" : "my.cancelDone"));
      setConfirm(null);
      await reload();
      void refreshAppsSummary(true);
    } catch (err) {
      toast.error(errorText(err, t, t("error.update")));
    } finally {
      setBusy(false);
    }
  }

  if (apps === null) {
    return <div className="h-40 animate-pulse rounded-[28px] bg-white/40 dark:bg-white/8" />;
  }
  if (apps.length === 0) {
    return (
      <EmptyState title={t("profile.noneApplied")} body={t("account.emptyAppliedBody")}>
        <Link to="/" className="inline-flex h-12 items-center rounded-full bg-brand px-5 text-base font-semibold text-white">
          {t("account.seeJobs")}
        </Link>
      </EmptyState>
    );
  }

  const order = (a: MyApplication) => (a.status === "selected" ? 0 : ACTIVE.has(a.status) ? 1 : 2);
  const sorted = [...apps].sort((a, b) => order(a) - order(b));
  const current = sorted.filter((a) => ACTIVE.has(a.status) && !["cancelled", "completed"].includes(a.job_status));
  const old = sorted.filter((a) => !current.includes(a));

  const card = (a: MyApplication) => (
    <MyAppCard
      key={a.id}
      app={a}
      rating={pending.find((p) => p.jobId === a.job_id && p.otherRole === "poster")}
      onRated={() => void reload()}
      onCancel={() => setConfirm(a)}
    />
  );

  return (
    <div className="space-y-4" data-testid="my-apps">
      {current.length === 0 ? (
        <p className="rounded-[24px] p-5 text-base text-muted glass">{t("my.noneActive")}</p>
      ) : (
        current.map(card)
      )}
      {old.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowOld((v) => !v)}
            aria-expanded={showOld}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-medium text-navy ring-1 ring-navy/15 hover:bg-navy/5"
          >
            {t("my.old", { n: old.length })}
            <ChevronDown className={cn("size-5 transition-transform", showOld && "rotate-180")} />
          </button>
          {showOld ? <div className="mt-4 space-y-4">{old.map(card)}</div> : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={t(confirm?.status === "selected" ? "my.cantComeTitle" : "my.cancelTitle")}
        body={t(confirm?.status === "selected" ? "my.cantComeBody" : "my.cancelBody", { job: confirm?.job_title ?? "" })}
        confirmLabel={t(confirm?.status === "selected" ? "my.cantComeYes" : "my.cancelYes")}
        cancelLabel={t("confirm.no")}
        danger
        busy={busy}
        onConfirm={() => void runCancel()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function MyAppCard({
  app: a,
  rating,
  onRated,
  onCancel,
}: {
  app: MyApplication;
  rating?: PendingRating;
  onRated: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const jobGone = a.job_status === "cancelled";
  const status =
    a.status === "selected"
      ? { cls: "bg-emerald-600 text-white", icon: CheckCircle2, text: t("my.stSelected") }
      : a.status === "declined"
        ? { cls: "bg-navy/8 text-navy", icon: XCircle, text: t("my.stDeclined") }
        : a.status === "withdrawn"
          ? { cls: "bg-navy/8 text-navy", icon: XCircle, text: t("my.stWithdrawn") }
          : jobGone
            ? { cls: "bg-navy/8 text-navy", icon: XCircle, text: t("my.stJobCancelled") }
            : { cls: "bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100", icon: Clock3, text: t("my.stWaiting") };
  const canCancel = (a.status === "pending" || a.status === "contacted" || a.status === "selected") && !jobGone && a.job_status !== "completed";

  return (
    <article className="overflow-hidden rounded-[26px] glass" data-testid="my-app" data-status={a.status}>
      <div className={cn("flex items-center gap-2 px-5 py-3 text-base font-semibold", status.cls)}>
        <status.icon className="size-5 shrink-0" />
        {status.text}
      </div>
      <div className="p-5">
        <Link
          to="/jobs/$id"
          params={{ id: String(a.job_id) }}
          className="text-lg font-semibold text-navy hover:text-orange"
        >
          {a.job_title}
        </Link>
        <div className="mt-2 space-y-1.5 text-base text-navy">
          {a.job_starts_at ? (
            <p className="font-medium">
              <JobWhen startsAt={a.job_starts_at} variant="inline" />
            </p>
          ) : null}
          <p className="flex items-center gap-2 text-muted">
            <MapPin className="size-4 shrink-0" />
            {a.job_locality}, {a.job_raion}
          </p>
          <p className="flex items-center gap-2 text-muted">
            <Wallet className="size-4 shrink-0" />
            {formatMdl(a.job_payment_mdl)}
          </p>
        </div>

        {a.status === "selected" && !jobGone ? (
          <Link
            to="/jobs/$id"
            params={{ id: String(a.job_id) }}
            data-testid="my-app-details"
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700"
          >
            {t(a.job_has_geo ? "my.seeDetailsMap" : "my.seeDetails")}
            <ChevronRight className="size-5" />
          </Link>
        ) : a.status === "pending" || a.status === "contacted" ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">{t("my.waitingHint")}</p>
        ) : null}

        {rating ? (
          <div className="mt-4">
            <RateForm
              jobId={rating.jobId}
              toUserId={rating.otherUserId}
              otherName={rating.otherName}
              otherRole="poster"
              onDone={onRated}
            />
          </div>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            data-testid="my-app-cancel"
            className="mt-3 flex h-11 w-full items-center justify-center rounded-full text-base font-medium text-danger hover:bg-danger/8"
          >
            {t(a.status === "selected" ? "my.cantCome" : "my.cancel")}
          </button>
        ) : null}
      </div>
    </article>
  );
}
