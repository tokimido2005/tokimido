import { errorText } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Building2, Clock, Eye, MapPin, RotateCcw, ShieldCheck, TriangleAlert, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { JobCard } from "@/components/job-card";
import { StatusBadge } from "@/components/status-badge";
import { JobWhen } from "@/components/job-when";
import { RatingBadge } from "@/components/stars";
import { ShareButtons, ShareJob } from "@/components/share-job";
import { ReportButton } from "@/components/report-dialog";
import { canRepost } from "@/lib/job-templates";
import { askNotifications } from "@/components/notify-prompt";
import { FavoriteButton, useSavedIds } from "@/components/favorite-button";
import { applyToJob, getJob, getMyApplicationForJob, listJobs, recordJobView, type Job } from "@/lib/jobs";
import { AppliedStatus, SelectedPanel, type MyAppInfo } from "@/components/my-application-status";
import { OfficialApply } from "@/components/official-apply";
import { CompanyLink } from "@/components/company-link";
import { BirthYearAsk } from "@/components/birth-year-ask";
import { ADULT_AGE, ageFromYear } from "@/lib/age";
import { JobDetailsBlock } from "@/components/job-details";
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
import { jobPostingJsonLd } from "@/lib/job-jsonld";

const SITE_URL = "https://rabotaem.md";

// Server-rendered title/description/OG + JobPosting JSON-LD so search engines
// and link previews (Facebook, Telegram, Viber) see the real job, not the
// generic site title. The page itself still loads its data client-side.
export const Route = createFileRoute("/jobs/$id/")({
  validateSearch: (s: Record<string, unknown>): { nou?: 1 } => (s.nou === 1 || s.nou === "1" ? { nou: 1 } : {}),
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
  const jsonLd = jobPostingJsonLd(job, url);
  const open = job.status === "open";
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: `${SITE_URL}/og/job/${job.id}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: job.title },
      { name: "twitter:image", content: `${SITE_URL}/og/job/${job.id}` },
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
  const justPosted = Route.useSearch().nou === 1;
  const jobId = Number(id);
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [related, setRelated] = useState<Job[]>([]);
  const [nearby, setNearby] = useState<Job[]>([]);
  const [applied, setApplied] = useState(false);
  const [myApp, setMyApp] = useState<MyAppInfo | null>(null);
  const [appTick, setAppTick] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<{ complete: boolean; verified: boolean; birthYear?: number | null } | null>(null);
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
        setGate({ complete: g.complete, verified: g.verified, birthYear: g.birthYear ?? null });
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
    getMyApplicationForJob({ data: job.id })
      .then((v) => {
        if (cancelled) return;
        setMyApp(v);
        setApplied(Boolean(v && v.status !== "withdrawn"));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, job, appTick]);

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
          g = { complete: fresh.complete, verified: fresh.verified, birthYear: fresh.birthYear ?? null };
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
      if (g.birthYear == null || (listing.adults_only && (ageFromYear(g.birthYear) ?? 0) < ADULT_AGE)) {
        document.getElementById("aplica")?.scrollIntoView({ behavior: "smooth", block: "start" });
        setBusy(false);
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
      if (isOficial(listing)) {
        document.getElementById("aplica")?.scrollIntoView({ behavior: "smooth", block: "start" });
        setBusy(false);
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
      askNotifications("apply");
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
            <ShareJob job={job} />
            {!isOwner ? <ReportButton targetType="job" targetId={String(job.id)} /> : null}
            {isOwner && canRepost(job) ? (
              <Link
                to="/post"
                search={{ from: job.id }}
                data-testid="repost-job"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-3 text-sm font-semibold text-white"
              >
                <RotateCcw className="size-3.5" />
                {t("repost.btn")}
              </Link>
            ) : null}
          </div>
        </div>

        {isOwner && justPosted && job.status === "open" ? (
          <section className="mt-4 rounded-[28px] p-5 glass-strong sm:p-6" data-testid="share-after-post">
            <h2 className="text-lg font-semibold tracking-tight text-navy">{t("share.afterPostT")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t("share.afterPostB")}</p>
            <div className="mt-4">
              <ShareButtons job={job} large />
            </div>
          </section>
        ) : null}

        {myApp?.status === "selected" && !isOwner ? (
          <SelectedPanel job={job} app={myApp} onChanged={() => setAppTick((n) => n + 1)} />
        ) : null}

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
            {job.adults_only ? (
              <span className="rounded-full bg-navy px-3 py-1 text-xs font-bold text-white dark:bg-white/20" data-testid="badge-18">
                {t("age.badge")}
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-navy">{job.title}</h1>
          {official ? <CompanyLink ownerId={job.user_id} fallbackName={job.company} /> : null}
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
                      ? t("kind.salaryMonth", {
                          n:
                            formatMdl(job.payment_mdl).replace(" MDL", "") +
                            ((job.details?.salary_max ?? 0) > job.payment_mdl
                              ? ` – ${formatMdl(job.details!.salary_max).replace(" MDL", "")}`
                              : ""),
                        })
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
          {open && !isOwner && !applied ? (
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
          {official ? <JobDetailsBlock details={job.details} /> : null}
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
          {!isOwner ? (
            <p
              className="mt-5 flex items-start gap-2 rounded-2xl bg-orange/10 px-4 py-3 text-sm leading-relaxed text-navy"
              data-testid="safety-note"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-orange-deep" />
              <span>{t(official ? "job.safetyOficial" : "job.safetyRapid")}</span>
            </p>
          ) : null}
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
        ) : myApp?.status === "selected" ? null : applied && myApp ? (
          <AppliedStatus job={job} app={myApp} onChanged={() => setAppTick((n) => n + 1)} />
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
            ) : user && gate && gate.birthYear == null ? (
              <BirthYearAsk onSaved={(y) => setGate((g) => (g ? { ...g, birthYear: y } : g))} />
            ) : user && gate && job.adults_only && (ageFromYear(gate.birthYear) ?? 0) < ADULT_AGE ? (
              <p className="mt-4 rounded-2xl bg-navy/6 p-4 text-base font-medium text-navy" data-testid="adults-only-msg">
                {t(official ? "age.oficialOnly18" : "age.heavyOnly18")}
              </p>
            ) : user && applyBlocked ? (
              <div className="mt-5">
                <PaywallCard access={access!} action="apply" />
              </div>
            ) : user && official && gate ? (
              <OfficialApply
                jobId={job.id}
                jobTitle={job.title}
                company={job.company}
                firstName={firstName}
                lastName={lastName}
                phone={phone}
                onApplied={() => {
                  setApplied(true);
                  setAppTick((n) => n + 1);
                  toast.success(t("toast.applied"));
                  askNotifications("apply");
                  void navigate({ to: "/jobs/$id/aplicat", params: { id: String(job.id) } });
                }}
              />
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
            {applyBlocked ||
            (user && official && gate?.complete && gate.verified) ||
            (user && gate && gate.birthYear == null) ||
            (user && gate && job.adults_only && (ageFromYear(gate.birthYear) ?? 0) < ADULT_AGE) ? null : (
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
