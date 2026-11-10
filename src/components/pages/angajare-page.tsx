import { errorText, translate, type Locale } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Briefcase, FileText } from "lucide-react";
import { Shell } from "@/components/shell";
import { Filters, type JobFilters } from "@/components/filters";
import { JobCard } from "@/components/job-card";
import { EmptyState } from "@/components/confirm-dialog";
import { WorkKindTabs } from "@/components/work-kind-tabs";
import { useSavedIds } from "@/components/favorite-button";
import { listJobs, type Job } from "@/lib/jobs";
import { seoHead } from "@/lib/seo";
import { useT } from "@/lib/locale";
import { logSearch, track } from "@/lib/analytics";


export function angajareHead(locale: Locale) {
  return seoHead(translate(locale, "seo.angTitle"), translate(locale, "seo.angDesc"), {
    path: locale === "ru" ? "/ru/angajare" : "/angajare",
    twin: "/angajare",
  });
}

export async function loadAngajare() {
  try {
    return { jobs: await listJobs({ data: { kind: "oficial" } }), error: null as string | null };
  } catch (err) {
    return {
      jobs: [] as Job[],
      // Translated when rendered (the loader has no language context).
      error: err instanceof Error && err.message ? err.message : "error.loadListings",
    };
  }
}

type AngajareData = Awaited<ReturnType<typeof loadAngajare>>;

const EMPTY: JobFilters = { q: "", raion: "", locality: "", category: "", when: "" };

export function AngajarePage({ loaded }: { loaded: AngajareData }) {
  const { t } = useT();
  const [filters, setFilters] = useState<JobFilters>(EMPTY);
  const [jobs, setJobs] = useState<Job[] | null>(loaded.jobs);
  const [error, setError] = useState<string | null>(loaded.error);
  const errorMessage = error ? errorText(new Error(error), t, t("error.loadListings")) : null;
  const { ids: savedIds, setSaved } = useSavedIds();

  const query = useMemo(() => {
    const next: { q?: string; raion?: string; locality?: string; category?: string; kind: "oficial" } = {
      kind: "oficial",
    };
    if (filters.q) next.q = filters.q;
    if (filters.raion) next.raion = filters.raion;
    if (filters.locality) next.locality = filters.locality;
    if (filters.category) next.category = filters.category;
    return next;
  }, [filters]);

  const hasFilters = Boolean(filters.q || filters.raion || filters.locality || filters.category);

  useEffect(() => {
    if (!hasFilters) {
      setJobs(loaded.jobs);
      setError(loaded.error);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      listJobs({ data: query })
        .then((rows) => {
          if (!cancelled) {
            setJobs(rows);
            setError(null);
            if (query.q) {
              track("job_search", { q: query.q });
              logSearch(query.q, "oficial", rows.length);
            }
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(errorText(err, t, t("home.loadError")));
            setJobs([]);
          }
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, t, hasFilters, loaded.jobs, loaded.error]);

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <WorkKindTabs active="oficial" />
        <p className="mt-8 text-sm font-semibold tracking-[0.18em] text-orange-deep uppercase">{t("kind.oficial")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy sm:text-5xl">{t("angajare.title")}</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{t("angajare.lead")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/post"
            search={{ kind: "oficial" }}
            className="sheen inline-flex h-12 items-center rounded-full px-5 text-sm font-semibold glass-navy"
          >
            {t("angajare.post")}
          </Link>
          <Link
            to="/cv"
            data-testid="angajare-cv"
            className="sheen inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold glass-orange"
          >
            <FileText className="size-4" />
            {t("angajare.myCv")}
          </Link>
        </div>

        <section className="mt-10" data-testid="oficial-list">
          <Filters value={filters} onChange={setFilters} variant="oficial" />
          <h2 className="mt-4 text-sm font-normal text-muted">
            {error
              ? t("home.loadError")
              : jobs === null
                ? t("home.loading")
                : hasFilters && jobs
                  ? t("home.filteredCount", { n: jobs.length, total: loaded.jobs.length })
                  : t("home.activeCount", { n: loaded.jobs.length })}
          </h2>
          <div className="mt-4">
            {error ? (
              <div className="rounded-[24px] p-6 text-sm text-danger glass">{errorMessage}</div>
            ) : jobs === null ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-36 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              filters.raion ? (
                <EmptyState title={t("home.emptyRaion")} body={t("home.emptyRaionHint")}>
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY)}
                    className="inline-flex h-12 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white"
                  >
                    {t("home.seeAllMoldova")}
                  </button>
                </EmptyState>
              ) : (
                <EmptyState title={t("angajare.empty")} body={t("angajare.emptyHint")}>
                  <Link
                    to="/post"
                    search={{ kind: "oficial" }}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white"
                  >
                    <Briefcase className="size-4" />
                    {t("angajare.post")}
                  </Link>
                </EmptyState>
              )
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
        </section>
      </main>
    </Shell>
  );
}
