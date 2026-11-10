import { SeoListing } from "@/components/seo-listing";
import { findLanding } from "@/lib/landings";
import { listJobs, type Job } from "@/lib/jobs";
import { seoHead } from "@/lib/seo";
import { translate, type Locale } from "@/lib/i18n";
import { useT } from "@/lib/locale";


export async function loadLanding(tema: string) {
  const landing = findLanding(tema);
  if (!landing) return { jobs: [] as Job[], slug: null as string | null };
  try {
    const jobs = await listJobs({ data: { kind: "rapid", ...(landing.when ? { when: landing.when } : {}) } });
    return { jobs, slug: landing.slug };
  } catch {
    return { jobs: [] as Job[], slug: landing.slug };
  }
}

export function landingHead(tema: string, locale: Locale) {
  const landing = findLanding(tema);
  if (!landing) return seoHead(translate(locale, "land.notFound"), "", { noindex: true });
  const k = `land.${landing.slug}`;
  const path = `/lucru/${landing.slug}`;
  return seoHead(translate(locale, `${k}.title`), translate(locale, `${k}.desc`), {
    path: locale === "ru" ? `/ru${path}` : path,
    twin: path,
  });
}

export function LandingPage({ data }: { data: Awaited<ReturnType<typeof loadLanding>> }) {
  const { t } = useT();
  const { jobs, slug } = data;
  if (!slug) return <SeoListing title={t("land.notFound")} lead="" jobs={[]} />;
  const k = `land.${slug}`;
  return (
    <SeoListing
      title={t(`${k}.title`)}
      lead={t(`${k}.desc`)}
      paragraphs={[t(`${k}.p1`), t(`${k}.p2`)]}
      jobs={jobs}
    />
  );
}
