import { SeoListing } from "@/components/seo-listing";
import { isCategoryId } from "@/lib/categories";
import { listJobs, type Job } from "@/lib/jobs";
import { seoHead } from "@/lib/seo";
import { translate, type Locale } from "@/lib/i18n";
import { useT } from "@/lib/locale";


export async function loadCategory(id: string) {
  if (!isCategoryId(id)) return { jobs: [] as Job[], category: id };
  try {
    return { jobs: await listJobs({ data: { category: id } }), category: id };
  } catch {
    return { jobs: [] as Job[], category: id };
  }
}

export function categoryHead(id: string, locale: Locale) {
  const known = isCategoryId(id);
  const name = known ? translate(locale, `cat.${id}`) : id;
  const path = `/c/${encodeURIComponent(id)}`;
  return seoHead(
    translate(locale, "seo.catTitle", { c: name }),
    translate(locale, "seo.catDesc", { c: name }),
    known ? { path: locale === "ru" ? `/ru${path}` : path, twin: path } : { noindex: true },
  );
}

export function CategoryPage({ data }: { data: Awaited<ReturnType<typeof loadCategory>> }) {
  const { t } = useT();
  const { jobs, category } = data;
  const name = isCategoryId(category) ? t(`cat.${category}`) : category;
  return <SeoListing title={t("seo.catTitle", { c: name })} lead={t("seo.catDesc", { c: name })} jobs={jobs} />;
}
