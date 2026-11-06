import { errorText } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Building2, Clock, Eye, MapPin, ShieldCheck, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { JobCard } from "@/components/job-card";
import { StatusBadge } from "@/components/status-badge";
import { JobWhen } from "@/components/job-when";
import { RatingBadge } from "@/components/stars";
import { ShareJob } from "@/components/share-job";
import { ReportButton } from "@/components/report-dialog";
import { FavoriteButton, useSavedIds } from "@/components/favorite-button";
import { applyToJob, getJob, hasApplied, listJobs, recordJobView, type Job } from "@/lib/jobs";
import { getMyProfile, getProfileGate } from "@/lib/profile";
import { getMyAccess, type MonetizationAccess } from "@/lib/monetization";
import { useMoneyMode } from "@/lib/money-mode";
import { PaywallCard, UsageHint } from "@/components/paywall";
import { PhoneLocked } from "@/components/phone-verify";
import { JobReminder } from "@/components/job-reminder";
import { JobLocationBlock } from "@/components/job-map";
import { formatSlots, isExpired, isPubliclyOpen, remainingSlots } from "@/lib/job-status";
import { isOficial } from "@/lib/job-kinds";
import { formatDuration, formatMdl } from "@/lib/utils";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/lib/locale";
import { track } from "@/lib/analytics";
import { jsonLdHtml, setClientSeo } from "@/lib/seo";

const SITE_URL = "https://rabotaem.md";

// Server-rendered title/description/OG + JobPosting JSON-LD so search engines
// and link previews (Facebook, Telegram, Viber) see the real job, not the
// generic site title. The page itself still loads its data client-side.
export const Route = createFileRoute("/jobs/$id/")({
  loader: async ({ params }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return { job: null as Job | null };
    try {
      return { job: await getJob({ data: id }) };
    } catch {
      return { job: null as Job | null };
    }
  },
  head: ({ loaderData, params }) => jobHead(loaderData?.job ?? null, params.id),
  component: JobPage,
});

function jobHead(job: Job | null, id: string) {
  const url = `${SITE_URL}/jobs/${encodeURIComponent(id)}`;
  if (!job) {
    return {
      meta: [{ title: "Anunț indisponibil · Rabotaem.md" }, { name: "robots", content: "noindex" }],
    };
  }
  const place = [job.locality, job.raion].filter(Boolean).join(", ");
  const pay = job.payment_mdl ? ` · ${job.payment_mdl} MDL` : "";
  const title = `${job.title}${place ? ` — ${place}` : ""}${pay} · Rabotaem.md`;
  const description = job.description.replace(/\s+/g, " ").trim().slice(0, 155);
  const official = isOficial(job);
  const posted = new Date(job.created_at);
  const validThrough = job.starts_at
    ? new Date(job.starts_at)
    : new Date(posted.getTime() + 30 * 24 * 3600 * 1000);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: posted.toISOString(),
    validThrough: validThrough.toISOString(),
    employmentType: !official
      ? "TEMPORARY"
      : job.contract_type === "intern"
        ? "INTERN"
        : job.contract_type === "prestari"
          ? "CONTRACTOR"
          : job.schedule === "part"
            ? "PART_TIME"
            : "FULL_TIME",
    hiringOrganization: {
      "@type": official && job.company ? "Organization" : "Person",
      name: (official && job.company) || job.poster_name || "Rabotaem.md",
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.locality || job.raion,
        addressRegion: job.raion,
        addressCountry: "MD",
      },
    },
    ...(job.payment_mdl
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "MDL",
            value: {
              "@type": "QuantitativeValue",
              value: job.payment_mdl,
              ...(official && job.salary_period === "month" ? { unitText: "MONTH" } : {}),
            },
          },
        }
      : {}),
    directApply: true,
    url,
  };
  const open = job.status === "open";
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      ...(open ? [] : [{ name: "robots", content: "noindex" }]),
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: open
      ? [{ type: "application/ld+json", children: jsonLdHtml(jsonLd) }]
      : [],
  };
}

function JobPage() {
  const { t } = useT();
  const { id } = Route.useParams();
  const jobId = Number(id);
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [related, setRelated] = useState<Job[]>([]);
  const [nearby, setNearby] = useState<Job[]>([]);
  const [applied, setApplied] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<{ complete: boolean; verified: boolean } | null>(null);
  const [access, setAccess] = useState<MonetizationAccess | null>(null);
  const { ids: savedIds, setSaved } = useSavedIds();
  const { showPro, mode } = useMoneyMode();

  useEffect(() => {
    let cancelled = false;
    if (!Number.isFinite(jobId)) {
      setJob(null);
      return;
    }
    getJob({ data: jobId })
      .then((row) => {
        if (!row) {
          if (!cancelled) setJob(null);
          return;
        }
        setClientSeo(row.title, row.description.slice(0, 150));
        let views = row.views_count ?? 0;
        try {
          const key = `rbt-view-${row.id}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            void recordJobView({ data: row.id });
            track("job_view", { id: row.id });
            views += 1;
          }
        } catch {
          /* ignore */
        }
        if (!cancelled) setJob({ ...row, views_count: views });
      })
      .catch(() => {
        if (!cancelled) setJob(null);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    listJobs({ data: { category: job.category, kind: job.kind, excludeId: job.id } })
      .then((rows) => {
        if (!cancelled) setRelated(rows.filter((r) => r.id !== job.id).slice(0, 3));
      })
      .catch(() => {});
    listJobs({ data: { raion: job.raion, kind: job.kind, excludeId: job.id } })
      .then((rows) => {
        if (!cancelled) {
          setNearby(rows.filter((r) => r.id !== job.id && r.category !== job.category).slice(0, 3));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [job]);

  useEffect(() => {
    if (!user) {
      setGate(null);
      return;
    }
    let cancelled = false;
    Promise.all([getProfileGate(), getMyProfile().catch(() => null), getMyAccess({ data: { t: Date.now() } }).catch(() => null)])
      .then(([g, profile, money]) => {
        if (cancelled) return;
        setGate({ complete: g.complete, verified: g.verified });
        if (profile?.phone) setPhone(profile.phone);
        else if (g.phone) setPhone(g.phone);
        if (profile?.first_name) setFirstName(profile.first_name);
        if (profile?.last_name) setLastName(profile.last_name);
        if (money) setAccess(money);
      })
      .catch(() => {
        if (!cancelled) setGate({ complete: false, verified: false });
      });
    return () => {
      cancelled = true;
    };
  }, [user, mode]);

  useEffect(() => {
    if (!user || !job) return;
    if (user.id === job.user_id) return;
    let cancelled = false;
    hasApplied({ data: job.id })
      .then((v) => {
        if (!cancelled) setApplied(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, job]);

  if (job === undefined) {
    return (
      <Shell>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <div className="h-80 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }

  if (job === null) {
    return (
      <Shell>
        <main className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-2xl font-semibold text-navy">{t("job.missing")}</h1>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-orange">
            {t("job.back")}
          </Link>
        </main>
      </Shell>
    );
  }

  const listing = job;
  const official = isOficial(listing);
  const isOwner = Boolean(user && user.id === listing.user_id);
  const left = remainingSlots(listing);
  const open = isPubliclyOpen(listing);

  async function onApply() {
    if (busy) return;
    if (!user) {
      await navigate({ to: "/login", search: { next: `/jobs/${listing.id}` } });
      return;
    }
    setBusy(true);
    try {
      let g = gate;
      if (!g) {
        try {
          const fresh = await getProfileGate();
          g = { complete: fresh.complete, verified: fresh.verified };
          setGate(g);
          if (fresh.phone) setPhone(fresh.phone);
        } catch {
          g = { complete: false, verified: false };
          setGate(g);
        }
      }
      if (!g.complete) {
        await navigate({ to: "/complete", search: { next: `/jobs/${listing.id}` } });
        return;
      }
      if (!g.verified) {
        await navigate({ to: "/verify", search: { next: `/jobs/${listing.id}` } });
        return;
      }
      if (showPro && access && !access.canApply) {
        await navigate({ to: "/pro" });
        return;
      }
      await applyToJob({
        data: {
          jobId: listing.id,
          message: message.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      });
      track("job_apply", { id: listing.id });
      setApplied(true);
      toast.success(t("toast.applied"));
      await navigate({ to: "/jobs/$id/aplicat", params: { id: String(listing.id) } });
    } catch (err) {
      const msg = errorText(err, t, t("job.applyFail"));
      // Route on the server's original (Romanian) text, not the translation.
      const raw = err instanceof Error ? err.message : "";
      if (/verific[aă]/i.test(raw) && /sms|telefon/i.test(raw)) {
        await navigate({ to: "/verify", search: { next: `/jobs/${listing.id}` } });
        return;
      }
      if (/completeaz/i.test(raw)) {
        await navigate({ to: "/complete", search: { next: `/jobs/${listing.id}` } });
        return;
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const applyLabel = applied ? t("apply.done") : busy ? t("apply.sending") : t("job.apply");
  const applyBlocked = Boolean(showPro && user && access && !access.canApply);

  const closedCopy =
    listing.status === "cancelled"
      ? t("job.closedCancel")
      : isExpired(listing)
        ? t("job.closedExpired")
        : listing.status === "completed" || listing.status === "closed"
          ? t("job.closedDone")
          : t("job.closedFull");

  const ownerCopy =
    listing.status === "cancelled"
      ? t("job.ownerCancel")
      : isExpired(listing)
        ? t("job.ownerExpired")
        : listing.status === "completed" || listing.status === "closed"
          ? t("job.ownerDone")
          : t("job.ownerOpen");

  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {official ? (
            <Link to="/angajare" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy">
              <ArrowLeft className="size-4" />
              {t("job.backOficial")}
            </Link>
          ) : (
            <Link to="/" hash="joburi" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy">
              <ArrowLeft className="size-4" />
              {t("job.backRapid")}
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <FavoriteButton
              jobId={job.id}
              saved={savedIds.has(job.id)}
              onChange={(v) => setSaved(job.id, v)}
            />
            <ShareJob title={job.title} />
            {!isOwner ? <ReportButton targetType="job" targetId={String(job.id)} /> : null}
          </div>
        </div>

        <article className="mt-4 rounded-[32px] p-5 glass sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                official
                  ? "rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white dark:bg-white/16 dark:text-navy"
                  : "rounded-full bg-orange/15 px-3 py-1 text-xs font-semibold text-orange-deep"
              }
            >
              {t(official ? "kind.badgeOficial" : "kind.badgeRapid")}
            </span>
            <span className="rounded-full bg-navy/8 px-3 py-1 text-xs font-semibold text-navy">
              {t(official ? `ocat.${job.category}` : `cat.${job.category}`)}
            </span>
            <StatusBadge job={job} />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-navy">{job.title}</h1>
          {official && job.company ? (
            <p className="mt-3 flex items-center gap-1.5 text-muted">
              <Building2 className="size-4" />
              {job.company}
            </p>
          ) : null}
          <p className="mt-3 flex items-center gap-1.5 text-muted">
            <MapPin className="size-4" />
            {job.locality}, {job.raion}
          </p>
          {!official ? <JobWhen startsAt={job.starts_at} variant="detail" /> : null}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-subtle">
            <Eye className="size-3.5" />
            {t(job.views_count === 1 ? "job.viewOne" : "job.views", { n: job.views_count })}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {official ? (
              <>
                <Fact
                  icon={Wallet}
                  label={t("kind.salary")}
                  value={
                    job.payment_mdl > 0
                      ? t("kind.salaryMonth", { n: formatMdl(job.payment_mdl).replace(" MDL", "") })
                      : t("kind.salaryNegotiable")
                  }
                  accent
                />
                <Fact
                  icon={Clock}
                  label={t("kind.schedule")}
                  value={job.schedule ? t(`schedule.${job.schedule}`) : "—"}
                />
                <Fact
                  icon={Building2}
                  label={t("kind.contract")}
                  value={job.contract_type ? t(`contract.${job.contract_type}`) : "—"}
                />
                <Fact icon={Users} label={t("kind.openings")} value={formatSlots(job)} />
              </>
            ) : (
              <>
                <Fact icon={Wallet} label={t("job.pay")} value={formatMdl(job.payment_mdl)} accent />
                <Fact icon={Clock} label={t("job.duration")} value={formatDuration(job.duration_minutes)} />
                <Fact icon={Users} label={t("job.spotsLeft")} value={formatSlots(job)} />
                <Fact icon={MapPin} label={t("job.location")} value={job.locality} />
              </>
            )}
          </div>
          {open && !isOwner ? (
            <button
              type="button"
              data-testid="apply-btn-top"
              disabled={busy || isPending || applied}
              onClick={() => void onApply()}
              className="sheen mt-5 flex h-14 w-full items-center justify-center rounded-full text-base font-semibold glass-orange shadow-[var(--shadow-orange)] disabled:opacity-60"
            >
              {applyLabel}
            </button>
          ) : null}
          <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-navy/85">{job.description}</p>
          <p className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted">
            <span>
              {t("job.postedBy")}{" "}
              <Link
                to="/u/$userId"
                params={{ userId: job.user_id }}
                className="font-medium text-navy hover:text-orange"
              >
                {job.poster_name || "—"}
              </Link>
            </span>
            {job.poster_phone_verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-navy">
                <ShieldCheck className="size-3" />
                {t("trust.phone")}
              </span>
            ) : null}
            <RatingBadge compact average={job.poster_rating_avg} count={job.poster_rating_count} />
          </p>
          {user && !isOwner && !official ? <JobReminder jobId={job.id} /> : null}
        </article>

        <JobLocationBlock
          jobId={job.id}
          hasGeo={Boolean(job.has_geo)}
          signedIn={Boolean(user)}
          authPending={isPending}
          isOwner={isOwner}
        />

        {isOwner ? (
          <section className="mt-5 rounded-[28px] p-5 glass sm:p-6">
            <h2 className="text-lg font-semibold text-navy">{t("job.yourJob")}</h2>
            <p className="mt-2 text-sm text-muted">{ownerCopy}</p>
            <Link
              to="/aplicatii"
              className="mt-4 sheen inline-flex h-12 items-center rounded-full px-5 text-sm font-semibold glass-navy"
            >
              {t("job.inbox")}
            </Link>
          </section>
        ) : applied ? (
          <section className="mt-5 rounded-[28px] p-6 text-center glass" data-testid="apply-done">
            <p className="text-base font-semibold text-navy">{t("apply.done")}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t("apply.successBody")}</p>
            <Link
              to="/jobs/$id/aplicat"
              params={{ id: String(job.id) }}
              className="mt-3 inline-block text-sm font-medium text-orange"
            >
              {t("job.seeConfirm")}
            </Link>
          </section>
        ) : open ? (
          <section id="aplica" className="mt-5 rounded-[28px] p-5 glass sm:p-7" data-testid="apply-section">
            <h2 className="text-lg font-semibold text-navy">{t("job.apply")}</h2>
            <p className="mt-1 text-sm text-muted">
              {left === 1 ? t("apply.leftOne") : t("apply.leftMany", { n: left })} {t("apply.contactHint")}
            </p>
            {user && gate && !gate.complete ? (
              <p className="mt-3 text-sm leading-relaxed text-muted">{t("complete.blurb")}</p>
            ) : user && gate && !gate.verified ? (
              <p className="mt-3 text-sm leading-relaxed text-muted">{t("sms.need")}</p>
            ) : user && applyBlocked ? (
              <div className="mt-5">
                <PaywallCard access={access!} action="apply" />
              </div>
            ) : user ? (
              <div className="mt-5 space-y-3">
                {firstName || lastName ? (
                  <p className="text-sm text-navy">
                    <span className="font-semibold">
                      {firstName} {lastName}
                    </span>
                  </p>
                ) : null}
                {phone ? <PhoneLocked phone={phone} /> : null}
                <textarea
                  className="field min-h-24 py-3"
                  placeholder={t(official ? "apply.messageOficial" : "apply.message")}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={800}
                />
                {access ? <UsageHint access={access} action="apply" /> : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">{t("apply.loginHint")}</p>
            )}
            {applyBlocked ? null : (
              <button
                type="button"
                data-testid="apply-btn"
                disabled={busy || isPending || applied}
                onClick={() => void onApply()}
                className="sheen mt-5 flex h-14 w-full items-center justify-center rounded-full text-base font-semibold glass-orange shadow-[var(--shadow-orange)] disabled:opacity-60"
              >
                {applyLabel}
              </button>
            )}
            <p className="mt-3 text-center text-xs leading-relaxed text-muted">{t("home.disclaimer")}</p>
          </section>
        ) : (
          <p className="mt-5 rounded-[24px] p-5 text-sm text-muted glass">{closedCopy}</p>
        )}

        {related.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-semibold text-navy">{t("job.related")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map((r, i) => (
                <JobCard
                  key={r.id}
                  job={r}
                  index={i}
                  saved={savedIds.has(r.id)}
                  onSavedChange={setSaved}
                />
              ))}
            </div>
          </section>
        ) : null}
        {nearby.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-semibold text-navy">{t("job.near")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {nearby.map((r, i) => (
                <JobCard
                  key={r.id}
                  job={r}
                  index={i}
                  saved={savedIds.has(r.id)}
                  onSavedChange={setSaved}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </Shell>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "rounded-2xl bg-orange/12 px-3 py-3" : "rounded-2xl bg-navy/5 px-3 py-3"}>
      <div className="flex items-center gap-1 text-[11px] font-medium text-muted">
        <Icon className="size-3" />
        {label}
      </div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${accent ? "text-orange-deep" : "text-navy"}`}>
        {value}
      </div>
    </div>
  );
}
