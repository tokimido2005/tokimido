import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Shell } from "@/components/shell";
import { getJob } from "@/lib/jobs";
import { seoHead } from "@/lib/seo";
import { useT } from "@/lib/locale";

export const Route = createFileRoute("/jobs/$id/aplicat")({
  head: () => seoHead("Aplicație trimisă", "Confirmarea aplicației tale pe Rabotaem.md."),
  loader: async ({ params }) => {
    const n = Number(params.id);
    if (!Number.isFinite(n)) return { job: null };
    try {
      return { job: await getJob({ data: n }) };
    } catch {
      return { job: null };
    }
  },
  component: Applied,
});

function Applied() {
  const { job } = Route.useLoaderData();
  const { t } = useT();

  return (
    <Shell>
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
        <div className="rounded-[36px] px-6 py-12 text-center glass-strong sm:px-10">
          <span className="pulse-glow mx-auto grid size-14 place-items-center rounded-full bg-orange text-white shadow-[var(--shadow-orange)]">
            <Check className="size-7" strokeWidth={2.5} />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            {t("apply.successTitle")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted" data-testid="apply-success">
            {t("apply.successBody")}
          </p>
          {job ? (
            <p className="mt-4 text-sm font-medium text-navy">
              {job.title} · {job.locality}
            </p>
          ) : null}
          {job?.has_geo ? (
            <p className="mt-4 text-sm leading-relaxed text-muted" data-testid="map-privacy-msg">
              {t("map.privacy")}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/"
              hash="joburi"
              className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-white"
            >
              {t("job.back")}
            </Link>
            <Link
              to="/aplicatii"
              search={{ tab: "trimise" }}
              className="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold text-navy"
            >
              {t("account.apps")}
            </Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}
