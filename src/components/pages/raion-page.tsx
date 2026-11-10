import { SeoListing } from "@/components/seo-listing";
import { listJobs, type Job } from "@/lib/jobs";
import { RAION_NAMES } from "@/lib/moldova";
import { seoHead } from "@/lib/seo";
import { translate, type Locale } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { raionLabel } from "@/lib/lang-paths";


export async function loadRaion(param: string) {
  const raion = decodeURIComponent(param);
  if (!RAION_NAMES.includes(raion)) return { jobs: [] as Job[], raion };
  try {
    return { jobs: await listJobs({ data: { raion } }), raion };
  } catch {
    return { jobs: [] as Job[], raion };
  }
}

export function raionHead(param: string, locale: Locale) {
  const raion = decodeURIComponent(param);
  const r = raionLabel(raion, locale);
  const path = `/r/${encodeURIComponent(raion)}`;
  return seoHead(
    translate(locale, "seo.raionTitle", { r }),
    translate(locale, "seo.raionDesc", { r }),
    RAION_NAMES.includes(raion) ? { path: locale === "ru" ? `/ru${path}` : path, twin: path } : { noindex: true },
  );
}

export function RaionPage({ data }: { data: Awaited<ReturnType<typeof loadRaion>> }) {
  const { t, locale } = useT();
  const r = raionLabel(data.raion, locale);
  return <SeoListing title={t("seo.raionTitle", { r })} lead={t("seo.raionDesc", { r })} jobs={data.jobs} emptyRaion />;
}
