import { createFileRoute } from "@tanstack/react-router";
import { SeoListing } from "@/components/seo-listing";
import { listJobs, type Job } from "@/lib/jobs";
import { RAION_NAMES } from "@/lib/moldova";
import { seoHead } from "@/lib/seo";
import { translate } from "@/lib/i18n";
import { useT } from "@/lib/locale";

export const Route = createFileRoute("/r/$raion")({
  loader: async ({ params }) => {
    const raion = decodeURIComponent(params.raion);
    const known = RAION_NAMES.includes(raion);
    if (!known) return { jobs: [] as Job[], raion };
    try {
      return { jobs: await listJobs({ data: { raion } }), raion };
    } catch {
      return { jobs: [] as Job[], raion };
    }
  },
  head: ({ params }) => {
    const raion = decodeURIComponent(params.raion);
    return seoHead(translate("ro", "seo.raionTitle", { r: raion }), translate("ro", "seo.raionDesc", { r: raion }));
  },
  component: RaionPage,
});

function RaionPage() {
  const { t } = useT();
  const { jobs, raion } = Route.useLoaderData();
  return <SeoListing title={t("seo.raionTitle", { r: raion })} lead={t("seo.raionDesc", { r: raion })} jobs={jobs} emptyRaion />;
}
