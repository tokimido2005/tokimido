import { createFileRoute } from "@tanstack/react-router";
import { SeoListing } from "@/components/seo-listing";
import { findLanding } from "@/lib/landings";
import { listJobs, type Job } from "@/lib/jobs";
import { seoHead } from "@/lib/seo";
import { translate } from "@/lib/i18n";
import { useT } from "@/lib/locale";

export const Route = createFileRoute("/lucru/$tema")({
  loader: async ({ params }) => {
    const landing = findLanding(params.tema);
    if (!landing) return { jobs: [] as Job[], slug: null as string | null };
    try {
      const jobs = await listJobs({ data: { kind: "rapid", ...(landing.when ? { when: landing.when } : {}) } });
      return { jobs, slug: landing.slug };
    } catch {
      return { jobs: [] as Job[], slug: landing.slug };
    }
  },
  head: ({ params }) => {
    const landing = findLanding(params.tema);
    if (!landing) return seoHead(translate("ro", "land.notFound"), "", { noindex: true });
    const k = `land.${landing.slug}`;
    return seoHead(translate("ro", `${k}.title`), translate("ro", `${k}.desc`), { path: `/lucru/${landing.slug}` });
  },
  component: LandingPage,
});

function LandingPage() {
  const { t } = useT();
  const { jobs, slug } = Route.useLoaderData();
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
