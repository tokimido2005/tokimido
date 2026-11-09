import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Briefcase, Building2, ExternalLink, Globe, MapPin, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { RatingBadge } from "@/components/stars";
import { adminSetCompanyVerified, getCompanyPage, type CompanyPage } from "@/lib/companies";
import { getAdminSession } from "@/lib/admin";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { jsonLdHtml } from "@/lib/seo";
import { formatMdl } from "@/lib/utils";

const SITE_URL = "https://rabotaem.md";

export const Route = createFileRoute("/firma/$slug")({
  loader: async ({ params }) => {
    try {
      return { page: await getCompanyPage({ data: { slug: params.slug } }) };
    } catch {
      return { page: null as CompanyPage | null };
    }
  },
  head: ({ loaderData, params }) => {
    const page = loaderData?.page;
    const url = `${SITE_URL}/firma/${encodeURIComponent(params.slug)}`;
    if (!page) return { meta: [{ title: "Firmă negăsită · Rabotaem.md" }, { name: "robots", content: "noindex" }] };
    const c = page.company;
    const title = `${c.name}${c.city ? ` — ${c.city}` : ""}: locuri de muncă · Rabotaem.md`;
    const description = (c.description || `${c.name} angajează pe Rabotaem.md.`).replace(/\s+/g, " ").slice(0, 155);
    const org = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: c.name,
      url,
      ...(c.website ? { sameAs: [c.website] } : {}),
      ...(c.city ? { address: { "@type": "PostalAddress", addressLocality: c.city, addressCountry: "MD" } } : {}),
      ...(c.description ? { description: c.description.slice(0, 500) } : {}),
    };
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: jsonLdHtml(org) }],
    };
  },
  component: CompanyPublicPage,
});

function CompanyPublicPage() {
  const { t } = useT();
  const { page: initial } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const { user } = useCurrentUserState();
  const [page, setPage] = useState(initial);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => setPage(initial), [initial]);
  useEffect(() => {
    if (!user) return;
    getAdminSession()
      .then((s) => setIsAdmin(s.admin))
      .catch(() => {});
  }, [user]);

  if (!page) {
    return (
      <Shell>
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold text-navy">{t("company.notFound")}</h1>
          <Link to="/angajare" className="mt-4 inline-flex h-12 items-center rounded-full bg-brand px-5 text-base font-semibold text-white">
            {t("company.seeJobs")}
          </Link>
        </main>
      </Shell>
    );
  }
  const c = page.company;
  const isOwner = user?.id === c.owner_id;

  async function toggleVerified() {
    try {
      await adminSetCompanyVerified({ data: { slug, verified: !c.verified } });
      const fresh = await getCompanyPage({ data: { slug } });
      setPage(fresh);
      toast.success(t(c.verified ? "company.unverified" : "company.verifiedToast"));
    } catch (err) {
      toast.error(errorText(err, t, t("error.update")));
    }
  }

  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="rounded-[32px] p-6 glass sm:p-8" data-testid="company-page">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
            {c.logo ? (
              <img src={c.logo} alt={c.name} className="size-24 shrink-0 rounded-3xl bg-white object-contain p-2 ring-1 ring-navy/10" />
            ) : (
              <span className="grid size-24 shrink-0 place-items-center rounded-3xl bg-navy/8 text-navy">
                <Building2 className="size-10" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-navy">{c.name}</h1>
              {c.verified ? (
                <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-600/12 px-3 py-1 text-sm font-semibold text-emerald-800 dark:text-emerald-200" data-testid="company-verified">
                  <BadgeCheck className="size-4" />
                  {t("company.verified")}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-base text-muted sm:justify-start">
                {c.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" />
                    {c.city}
                  </span>
                ) : null}
                {c.size ? (
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-4" />
                    {t("company.employees", { n: c.size })}
                  </span>
                ) : null}
                {c.website ? (
                  <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-semibold text-[#1d6fd8]">
                    <Globe className="size-4" />
                    {c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </div>
              {page.rating.count > 0 ? (
                <div className="mt-2">
                  <RatingBadge average={page.rating.avg} count={page.rating.count} />
                </div>
              ) : null}
            </div>
          </div>
          {c.description ? <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-navy/85">{c.description}</p> : null}
          {isOwner || isAdmin ? (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-navy/10 pt-4">
              {isOwner ? (
                <Link to="/firma" className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white">
                  <Pencil className="size-4" />
                  {t("company.edit")}
                </Link>
              ) : null}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => void toggleVerified()}
                  data-testid="company-admin-verify"
                  className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-emerald-700 ring-2 ring-emerald-600/60"
                >
                  <BadgeCheck className="size-4" />
                  {t(c.verified ? "company.adminUnverify" : "company.adminVerify")}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-navy">
            <Briefcase className="size-5 text-orange" />
            {t("company.openJobs", { n: page.jobs.length })}
          </h2>
          {page.jobs.length === 0 ? (
            <p className="mt-3 rounded-[24px] p-5 text-base text-muted glass">{t("company.noJobs")}</p>
          ) : (
            <ul className="mt-3 space-y-2" data-testid="company-jobs">
              {page.jobs.map((j) => (
                <li key={j.id}>
                  <Link to="/jobs/$id" params={{ id: String(j.id) }} className="block rounded-2xl bg-white/60 p-4 ring-1 ring-navy/8 hover:bg-white/90 dark:bg-white/8">
                    <span className="block text-base font-semibold text-navy">{j.title}</span>
                    <span className="text-sm text-muted">
                      {[
                        j.locality || j.raion,
                        j.payment_mdl
                          ? j.kind === "oficial"
                            ? t("kind.salaryMonth", {
                                n: formatMdl(j.payment_mdl).replace(" MDL", "") + (j.salary_max > j.payment_mdl ? ` – ${formatMdl(j.salary_max).replace(" MDL", "")}` : ""),
                              })
                            : formatMdl(j.payment_mdl)
                          : "",
                        t(j.kind === "oficial" ? "kind.oficial" : "kind.rapid"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </Shell>
  );
}
