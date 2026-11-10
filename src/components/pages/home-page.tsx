import { errorText, translate, type Locale } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { Filters, type JobFilters } from "@/components/filters";
import { JobCard } from "@/components/job-card";
import { EmptyState } from "@/components/confirm-dialog";
import { useSavedIds } from "@/components/favorite-button";
import { listJobs, type Job } from "@/lib/jobs";
import { logSearch, track } from "@/lib/analytics";
import { useT } from "@/lib/locale";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { jsonLdHtml, seoHead, SITE_ORIGIN } from "@/lib/seo";
import { WorkKindTabs } from "@/components/work-kind-tabs";


export function homeHead(locale: Locale) {
  return {
    ...seoHead(translate(locale, "home.seoTitle"), translate(locale, "home.seoDesc"), {
      path: locale === "ru" ? "/ru" : "/",
      twin: "/",
    }),
    scripts: [{ type: "application/ld+json", children: jsonLdHtml(SITE_JSON_LD) }],
  };
}

export async function loadHome() {
  try {
    const jobs = await listJobs({ data: { kind: "rapid" } });
    return { jobs, error: null as string | null };
  } catch (err) {
    return {
      jobs: [] as Job[],
      // Translated when rendered (the loader has no language context).
      error: err instanceof Error && err.message ? err.message : "error.loadJobs",
    };
  }
}

type HomeData = Awaited<ReturnType<typeof loadHome>>;

/**
 * Site name + logo for Google: lets a search for "rabotaem md" show the
 * brand name and logo instead of the bare domain.
 */
const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      name: "Rabotaem.md",
      alternateName: ["Rabotaem", "Работаем", "rabotaem md"],
      url: `${SITE_ORIGIN}/`,
      inLanguage: ["ro", "ru"],
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#organization`,
      name: "Rabotaem.md",
      url: `${SITE_ORIGIN}/`,
      logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/icon-512.png`, width: 512, height: 512 },
      areaServed: { "@type": "Country", name: "Moldova" },
    },
  ],
};

const EMPTY: JobFilters = { q: "", raion: "", locality: "", category: "", when: "" };

export function HomePage({ loaded }: { loaded: HomeData }) {
  const { t } = useT();
  const [filters, setFilters] = useState<JobFilters>(EMPTY);
  const [jobs, setJobs] = useState<Job[] | null>(loaded.jobs);
  const [error, setError] = useState<string | null>(loaded.error);
  const errorMessage = error ? errorText(new Error(error), t, t("error.loadJobs")) : null;
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
            if (query.q) {
              track("job_search", { q: query.q });
              logSearch(query.q, "rapid", rows.length);
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
            <p className="rise-in mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg" style={{ animationDelay: "40ms" }}>
              {t("home.seoSub")}
            </p>
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
              <div className="rounded-[24px] p-6 text-sm text-danger glass">{errorMessage}</div>
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
          <div className="space-y-3 rounded-[24px] p-6 text-sm leading-relaxed text-muted glass sm:text-base">
            <h2 className="text-xl font-semibold tracking-tight text-navy">{t("home.seoAboutT")}</h2>
            <p>{t("home.seoAbout1")}</p>
            <p>{t("home.seoAbout2")}</p>
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
