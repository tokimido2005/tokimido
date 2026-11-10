import { Link } from "@tanstack/react-router";
import { JobCard } from "@/components/job-card";
import { EmptyState } from "@/components/confirm-dialog";
import { useSavedIds } from "@/components/favorite-button";
import { Shell } from "@/components/shell";
import { WorkKindTabs } from "@/components/work-kind-tabs";
import type { Job } from "@/lib/jobs";
import { useT } from "@/lib/locale";
import { jsonLdHtml } from "@/lib/seo";

export function SeoListing({
  title,
  lead,
  jobs,
  paragraphs = [],
  emptyRaion = false,
}: {
  title: string;
  lead: string;
  jobs: Job[];
  /** Extra intro text shown under the job list (keyword landing pages). */
  paragraphs?: string[];
  emptyRaion?: boolean;
}) {
  const { t } = useT();
  const { ids: savedIds, setSaved } = useSavedIds();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description: lead,
    numberOfItems: jobs.length,
    itemListElement: jobs.slice(0, 20).map((job, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: job.title,
      url: `https://rabotaem.md/jobs/${job.id}`,
    })),
  };
  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
        <WorkKindTabs active="rapid" />
        <p className="mt-8 text-sm font-semibold tracking-[0.16em] text-orange-deep uppercase">{t("home.kindKicker")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{lead}</p>
        <h2 className="mt-4 text-sm font-normal text-muted">{t("home.activeCount", { n: jobs.length })}</h2>
        <div className="mt-6">
          {jobs.length === 0 ? (
            <EmptyState
              title={emptyRaion ? t("home.emptyRaion") : t("home.empty")}
              body={emptyRaion ? t("home.emptyRaionHint") : t("home.emptyHint")}
            >
              <Link
                to="/"
                hash="joburi"
                className="inline-flex h-12 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white"
              >
                {emptyRaion ? t("home.seeAllMoldova") : t("nav.jobs")}
              </Link>
              <Link
                to="/post"
                className="inline-flex h-12 items-center rounded-full bg-white/55 px-5 text-sm font-semibold text-navy ring-1 ring-navy/10 dark:bg-white/10"
              >
                {t("home.ctaPost")}
              </Link>
            </EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job, i) => (
                <JobCard
                  key={job.id}
                  job={job}
                  index={i}
                  saved={savedIds.has(job.id)}
                  onSavedChange={setSaved}
                />
              ))}
            </div>
          )}
        </div>
        {paragraphs.length > 0 ? (
          <section className="mt-10 max-w-3xl space-y-3 rounded-[24px] p-6 text-sm leading-relaxed text-muted glass sm:text-base">
            {paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ) : null}
      </main>
    </Shell>
  );
}