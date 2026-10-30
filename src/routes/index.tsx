import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { Filters, type JobFilters } from "@/components/filters";
import { JobCard } from "@/components/job-card";
import { EmptyState } from "@/components/confirm-dialog";
import { useSavedIds } from "@/components/favorite-button";
import { listJobs, type Job } from "@/lib/jobs";
import { track } from "@/lib/analytics";
import { useT } from "@/lib/locale";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { seoHead } from "@/lib/seo";
import { WorkKindTabs } from "@/components/work-kind-tabs";

export const Route = createFileRoute("/")({
  head: () =>
    seoHead(
      "Lucru pe loc. Bani pe loc.",
      "Platformă gratuită pentru joburi de scurtă durată în toată Moldova. Fără comision.",
    ),
  loader: async () => {
    try {
      const jobs = await listJobs({ data: { kind: "rapid" } });
      return { jobs, error: null as string | null };
    } catch (err) {
      return {
        jobs: [] as Job[],
        error: err instanceof Error ? err.message : "Nu am putut încărca joburile",
      };
    }
  },
  component: Home,
});

const EMPTY: JobFilters = { q: "", raion: "", locality: "", category: "", when: "" };

function Home() {
  const { t } = useT();
  const loaded = Route.useLoaderData();
  const [filters, setFilters] = useState<JobFilters>(EMPTY);
  const [jobs, setJobs] = useState<Job[] | null>(loaded.jobs);
  const [error, setError] = useState<string | null>(loaded.error);
  const { ids: savedIds, setSaved } = useSavedIds();
  const { isPending } = useCurrentUserState();
  const totalActive = loaded.jobs?.length ?? 0;

  const query = useMemo(() => {
    const next: { q?: string; raion?: string; locality?: string; category?: string; when?: "today" | "urgent" | "soon3h" } = {};
    if (filters.q) next.q = filters.q;
    if (filters.raion) next.raion = filters.raion;
    if (filters.locality) next.locality = filters.locality;
    if (filters.category) next.category = filters.category;
    if (filters.when) next.when = filters.when;
    return next;
  }, [filters]);

  const hasFilters = Boolean(filters.q || filters.raion || filters.locality || filters.category || filters.when);

  useEffect(() => {
    if (isPending) return;
    if (!hasFilters) {
      setJobs(loaded.jobs);
      setError(loaded.error);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      listJobs({ data: { ...query, kind: "rapid" } })
        .then((rows) => {
          if (!cancelled) {
            setJobs(rows);
            setError(null);
            if (query.q) track("job_search", { q: query.q });
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : t("home.loadError"));
            setJobs([]);
          }
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, t, isPending, hasFilters, loaded.jobs, loaded.error]);

  const emptyRaion = Boolean(filters.raion) && (jobs?.length ?? 0) === 0 && !error;

  return (
    <Shell>
      <main>
        <section className="mx-auto max-w-6xl px-4 pt-8 pb-6 sm:px-6 sm:pt-12">
          <div className="relative overflow-hidden rounded-[32px] px-6 py-8 glass sm:px-10 sm:py-10">
            <div className="pointer-events-none absolute -right-8 -top-10 hidden size-48 rounded-full bg-orange/20 blur-3xl lg:block dark:bg-orange/16" />
            <h1 className="rise-in max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-navy sm:text-5xl sm:leading-[1.08]">
              {t("home.title")}
            </h1>
            <div className="rise-in mt-6 grid gap-3 sm:grid-cols-2" style={{ animationDelay: "80ms" }}>
              <a
                href="#joburi"
                className="sheen inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold glass-orange transition-transform duration-150 active:scale-[0.96]"
              >
                {t("home.ctaWork")}
                <ArrowRight className="size-4" />
              </a>
              <Link
                to="/post"
                className="sheen inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-semibold glass-navy transition-transform duration-150 active:scale-[0.96]"
              >
                {t("home.ctaPost")}
              </Link>
            </div>
          </div>
        </section>

        <section id="joburi" className="mx-auto max-w-6xl scroll-mt-28 px-4 pt-2 sm:px-6">
          <WorkKindTabs active="rapid" />
          <div className="mt-6 mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
                {t("home.openJobs")}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {error
                  ? t("home.loadError")
                  : jobs === null
                    ? t("home.loading")
                    : hasFilters && jobs
                      ? t("home.filteredCount", { n: jobs.length, total: totalActive })
                      : t("home.activeCount", { n: totalActive })}
              </p>
            </div>
          </div>
          <Filters value={filters} onChange={setFilters} />
          <div className="mt-6">
            {error ? (
              <div className="rounded-[24px] p-6 text-sm text-danger glass">{error}</div>
            ) : jobs === null ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-36 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              emptyRaion ? (
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
                <EmptyState title={t("home.empty")} body={t("home.emptyHint")}>
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY)}
                    className="inline-flex h-12 items-center rounded-full bg-white/55 px-5 text-sm font-semibold text-navy ring-1 ring-navy/10 dark:bg-white/10"
                  >
                    {t("search.reset")}
                  </button>
                  <Link
                    to="/post"
                    className="inline-flex h-12 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white"
                  >
                    {t("home.ctaPost")}
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

        <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <p className="rounded-[22px] px-5 py-4 text-sm leading-relaxed text-muted glass">
            {t("home.disclaimer")}
          </p>
        </section>
      </main>
    </Shell>
  );
}
