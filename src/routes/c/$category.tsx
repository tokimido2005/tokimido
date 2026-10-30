import { createFileRoute } from "@tanstack/react-router";
import { SeoListing } from "@/components/seo-listing";
import { isCategoryId } from "@/lib/categories";
import { listJobs, type Job } from "@/lib/jobs";
import { seoHead } from "@/lib/seo";
import { translate } from "@/lib/i18n";
import { useT } from "@/lib/locale";

export const Route = createFileRoute("/c/$category")({
  loader: async ({ params }) => {
    const id = params.category;
    if (!isCategoryId(id)) return { jobs: [] as Job[], category: id };
    try {
      return { jobs: await listJobs({ data: { category: id } }), category: id };
    } catch {
      return { jobs: [] as Job[], category: id };
    }
  },
  head: ({ params }) => {
    const id = params.category;
    const name = isCategoryId(id) ? translate("ro", `cat.${id}`) : id;
    return seoHead(translate("ro", "seo.catTitle", { c: name }), translate("ro", "seo.catDesc", { c: name }));
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { t } = useT();
  const { jobs, category } = Route.useLoaderData();
  const name = isCategoryId(category) ? t(`cat.${category}`) : category;
  return <SeoListing title={t("seo.catTitle", { c: name })} lead={t("seo.catDesc", { c: name })} jobs={jobs} />;
}
