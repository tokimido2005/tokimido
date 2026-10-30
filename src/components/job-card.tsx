import { Link } from "@tanstack/react-router";
import { MapPin, ShieldCheck, Star } from "lucide-react";
import type { Job } from "@/lib/jobs";
import { isUrgent } from "@/lib/job-status";
import { isOficial } from "@/lib/job-kinds";
import { formatDuration, formatMdl } from "@/lib/utils";
import { FavoriteButton } from "@/components/favorite-button";
import { formatAverage } from "@/components/stars";
import { useT } from "@/lib/locale";

export function JobCard({
  job,
  index = 0,
  saved,
  onSavedChange,
}: {
  job: Job;
  index?: number;
  saved?: boolean;
  onSavedChange?: (jobId: number, saved: boolean) => void;
}) {
  const { t } = useT();
  const official = isOficial(job);
  const salary =
    job.payment_mdl > 0
      ? official
        ? t("kind.salaryMonth", { n: formatMdl(job.payment_mdl).replace(" MDL", "") })
        : formatMdl(job.payment_mdl)
      : t("kind.salaryNegotiable");
  const duration = official
    ? job.schedule
      ? t(`schedule.${job.schedule}`)
      : "—"
    : formatDuration(job.duration_minutes);
  const verified = Boolean(job.poster_phone_verified);
  const showUrgent = !official && isUrgent(job.starts_at);

  return (
    <div className="relative h-full">
      <Link
        to="/jobs/$id"
        params={{ id: String(job.id) }}
        className="sheen group job-card flex h-full flex-col rounded-[24px] p-4 pr-12 glass transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-glass-hover)] rise-in"
        style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      >
        {official || showUrgent ? (
          <span className="mb-2 flex flex-wrap gap-1.5">
            {official ? (
              <span className="w-fit rounded-full bg-navy px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white dark:bg-white/16 dark:text-navy">
                {t("kind.badgeOficial")}
              </span>
            ) : null}
            {showUrgent ? (
              <span className="badge-urgent w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide">
                {t("search.urgent")}
              </span>
            ) : null}
          </span>
        ) : null}
        <h3 className="text-base font-semibold leading-snug tracking-tight text-navy group-hover:text-navy-soft sm:text-[1.05rem]">
          {job.title}
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <MapPin className="size-3.5 shrink-0" />
          {job.locality}, {job.raion}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold tabular-nums text-orange-deep">{salary}</span>
          <span className="text-navy/25" aria-hidden="true">
            ·
          </span>
          <span className="font-medium text-navy">{duration}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="font-medium text-navy">{job.poster_name || "—"}</span>
          {job.poster_rating_count > 0 ? (
            <span className="inline-flex items-center gap-0.5 font-semibold text-navy">
              <Star className="size-3 fill-orange text-orange" />
              <span className="tabular-nums">{formatAverage(job.poster_rating_avg)}</span>
            </span>
          ) : null}
          {verified ? (
            <span className="inline-flex items-center gap-0.5 font-semibold text-navy">
              <ShieldCheck className="size-3 text-brand" />
              {t("trust.phone")}
            </span>
          ) : null}
        </div>
      </Link>
      <div className="absolute top-3 right-3 z-10">
        <FavoriteButton
          jobId={job.id}
          saved={saved}
          onChange={(next) => onSavedChange?.(job.id, next)}
        />
      </div>
    </div>
  );
}
