import { errorText } from "@/lib/i18n";
import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Bell, Camera, ChevronRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { JobCard } from "@/components/job-card";
import { RateForm } from "@/components/rate-form";
import { RatingTagList } from "@/components/rating-tags-list";
import { RatingBadge, Stars } from "@/components/stars";
import { useSavedIds } from "@/components/favorite-button";
import {
  listFavoriteJobs,
  listMyJobs,
  type Job,
} from "@/lib/jobs";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { compressPhotoFile, formatJobDate, formatJobTime } from "@/lib/utils";
import { countHiddenRatings, getPublicProfile, listPendingRatings, type PendingRating, type RatingSummary } from "@/lib/ratings";
import { getMyProfile, saveMyBio, saveMyPhoto, type Profile } from "@/lib/profile";
import { InviteCard } from "@/components/invite-card";
import { PhoneLocked } from "@/components/phone-verify";
import { PhoneVerifyChoice } from "@/components/phone-verify-choice";
import { TrustBadges, computeTrust } from "@/components/trust-badges";
import { listMyReports, type Report } from "@/lib/community";
import { listMyInbox, markInboxRead, type InboxMessage } from "@/lib/admin";
import { getMyAccess, type MonetizationAccess } from "@/lib/monetization";
import { useMoneyMode } from "@/lib/money-mode";
import { ProBadge } from "@/components/paywall";
import { useT } from "@/lib/locale";
import { seoHead } from "@/lib/seo";
import { canRepost } from "@/lib/job-templates";
import { deleteMyAccount, isDeleteConfirmWord } from "@/lib/account-delete";
import { signOut } from "@/lib/auth/client";

type Tab = "jobs" | "apps" | "saved" | "ratings" | "reports" | "inbox";

export const Route = createFileRoute("/cont")({
  head: () => seoHead("Contul meu", "Anunțurile, aplicațiile, salvările și evaluările tale pe Rabotaem.md.", { noindex: true }),
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; msg?: number } => {
    const n = typeof s.msg === "number" ? s.msg : typeof s.msg === "string" ? Number(s.msg) : NaN;
    return {
      tab:
        s.tab === "apps" ||
        s.tab === "ratings" ||
        s.tab === "jobs" ||
        s.tab === "saved" ||
        s.tab === "reports" ||
        s.tab === "inbox"
          ? (s.tab as Tab)
          : undefined,
      msg: Number.isFinite(n) && n > 0 ? n : undefined,
    };
  },
  component: Account,
});

function Account() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const search = Route.useSearch();
  const [tab, setTab] = useState<Tab>(search.tab ?? "jobs");
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [saved, setSavedJobs] = useState<Job[] | null>(null);
  const [pending, setPending] = useState<PendingRating[]>([]);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [hiddenRatings, setHiddenRatings] = useState(0);
  const [me, setMe] = useState<Profile | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [inbox, setInbox] = useState<InboxMessage[] | null>(null);
  const [access, setAccess] = useState<MonetizationAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { ids: savedIds, setSaved } = useSavedIds();
  const { showPro, mode } = useMoneyMode();

  useEffect(() => {
    if (search.tab) setTab(search.tab);
  }, [search.tab]);

  const reload = useCallback(() => {
    if (!user) return Promise.resolve();
    return Promise.all([
      listMyJobs(),
      listFavoriteJobs(),
      listPendingRatings(),
      getPublicProfile({ data: user.id }),
      getMyProfile().catch(() => null),
      listMyReports().catch(() => [] as Report[]),
      listMyInbox().catch(() => [] as InboxMessage[]),
      countHiddenRatings().catch(() => 0),
    ]).then(([j, f, p, s, profile, r, inboxRows, hidden]) => {
      setHiddenRatings(hidden);
      setJobs(j);
      setSavedJobs(f);
      setPending(p);
      setSummary(s);
      setMe(profile);
      setReports(r);
      setInbox(inboxRows);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    reload().catch((err: unknown) => {
      if (!cancelled) setError(errorText(err, t, t("home.loadError")));
    });
    getMyAccess({ data: { t: Date.now() } })
      .then((row) => {
        if (!cancelled) setAccess(row);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, reload, t, mode]);

  useEffect(() => {
    if (tab !== "inbox") return;
    void markInboxRead()
      .then(() =>
        setInbox((rows) =>
          (rows ?? []).map((m) => ({ ...m, read_at: m.read_at ?? new Date().toISOString() })),
        ),
      )
      .catch(() => undefined);
  }, [tab]);

  if (isPending) {
    return (
      <Shell>
        <main className="mx-auto max-w-4xl px-4 py-16">
          <div className="h-64 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }
  if (!user) {
    const next = search.tab
      ? `/cont?tab=${search.tab}${search.msg ? `&msg=${search.msg}` : ""}`
      : "/cont";
    return <Navigate to="/login" search={{ next }} />;
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const photo = await compressPhotoFile(file);
      await saveMyPhoto({ data: { photo } });
      toast.success(t("account.photoSaved"));
      await reload();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message === "too-big"
          ? t("account.photoTooBig")
          : err instanceof Error
            ? err.message
            : t("account.photoTooBig"),
      );
    }
  }

  const photo = summary?.photo || me?.photo_data || user.profileImageUrl;
  const display = summary?.displayName || user.displayName || user.primaryEmail || "—";
  const completed = summary?.completedCount ?? 0;
  const flags = computeTrust({
    phoneVerified: Boolean(me?.phone_verified_at),
    hasPhoto: Boolean(photo),
    bio: me?.bio ?? summary?.bio ?? "",
    firstName: me?.first_name,
    lastName: me?.last_name,
    phone: me?.phone,
    completedCount: completed,
    average: summary?.average ?? 0,
    ratingCount: summary?.count ?? 0,
  });

  return (
    <Shell>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <section className="rounded-[32px] p-5 glass sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  className="size-20 rounded-full object-cover ring-1 ring-navy/10"
                />
              ) : (
                <span className="grid size-20 place-items-center rounded-full bg-brand text-2xl font-semibold text-white">
                  {display.charAt(0).toUpperCase()}
                </span>
              )}
              <label className="absolute -bottom-1 -right-1 grid size-9 cursor-pointer place-items-center rounded-full bg-brand text-white ring-2 ring-white dark:ring-canvas">
                <Camera className="size-4" />
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onPhoto(e)} />
                <span className="sr-only">{t("profile.changePhoto")}</span>
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted">{t("account.title")}</p>
              <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-navy">{display}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {showPro && access?.isPro ? <ProBadge until={access.proUntil ? formatJobDate(access.proUntil) : null} /> : null}
                {summary ? <RatingBadge average={summary.average} count={summary.count} /> : null}
                <span className="text-sm text-muted">
                  {completed === 1 ? t("profile.completedOne") : t("profile.completed", { n: completed })}
                </span>
              </div>
              {me?.phone ? (
                <p className="mt-2 text-sm text-navy">
                  {t("account.myPhone")}: <span className="font-semibold tabular-nums">{me.phone}</span>
                  {me.phone_verified_at ? (
                    <span className="ml-2 rounded-full bg-orange/15 px-2 py-0.5 text-[11px] font-semibold text-orange-deep">
                      {t("phone.verified")}
                    </span>
                  ) : null}
                </p>
              ) : null}
              <Link
                to="/u/$userId"
                params={{ userId: user.id }}
                className="mt-2 inline-block text-sm font-medium text-orange"
              >
                {t("account.viewPublic")}
              </Link>
              <TrustBadges flags={flags} />
              {showPro && access && access.mode !== "free" && !access.isAdmin ? (
                <div className="mt-4 rounded-[20px] p-4 ring-1 ring-navy/8">
                  <p className="text-sm font-semibold text-navy">
                    {access.isPro ? t("account.pro") : t("account.freePlan")}
                  </p>
                  {access.isPro && access.proUntil ? (
                    <p className="mt-1 text-xs text-muted">{t("account.proUntil", { d: formatJobDate(access.proUntil) })}</p>
                  ) : access.mode === "freemium" ? (
                    <p className="mt-1 text-xs text-muted">
                      {t("account.usage", { used: access.jobsUsed, limit: access.freeJobLimit })} · {t("money.jobLimit")}
                      {" · "}
                      {t("account.usage", { used: access.appliesUsed, limit: access.freeApplyLimit })} · {t("money.applyLimit")}
                    </p>
                  ) : null}
                  <Link to="/pro" className="mt-2 inline-block text-sm font-medium text-orange">
                    {access.isPro ? t("pro.title") : t("account.proCta")}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
          {me && !me.phone_verified_at && me.phone ? (
            <div className="mt-5">
              <PhoneVerifyChoice phone={me.phone} onVerified={() => void reload()} />
            </div>
          ) : me?.phone_verified_at ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold tracking-wide text-orange uppercase">{t("phone.verified")}</p>
              <PhoneChange mePhone={me.phone} onDone={() => void reload()} />
            </div>
          ) : null}
          <BioBox initial={me?.bio ?? ""} onSaved={reload} />
        </section>

        <Link
          to="/alerte"
          data-testid="account-alerts"
          className="mt-4 flex items-center gap-4 rounded-[28px] p-5 glass hover:bg-white/70 sm:p-6"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-orange/15 text-orange-deep">
            <Bell className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-navy">{t("al.title")}</span>
            <span className="block text-sm text-muted">{t("al.cardHint")}</span>
          </span>
          <ChevronRight className="size-5 text-muted" />
        </Link>
        <InviteCard />

        <div className="mt-6 flex flex-wrap gap-2">
          <TabBtn active={tab === "jobs"} onClick={() => setTab("jobs")}>
            {t("account.jobs")}
          </TabBtn>
          <Link
            to="/aplicatii"
            search={{ tab: "trimise" }}
            data-testid="account-apps-link"
            className="inline-flex h-10 items-center rounded-full bg-white/70 px-4 text-sm font-medium text-navy ring-1 ring-navy/10 dark:bg-white/10"
          >
            {t("account.apps")} →
          </Link>
          <Link
            to="/cv"
            data-testid="account-cv-link"
            className="inline-flex h-10 items-center rounded-full bg-white/70 px-4 text-sm font-medium text-navy ring-1 ring-navy/10 dark:bg-white/10"
          >
            {t("cv.myTitle")} →
          </Link>
          <Link
            to="/firma"
            data-testid="account-company-link"
            className="inline-flex h-10 items-center rounded-full bg-white/70 px-4 text-sm font-medium text-navy ring-1 ring-navy/10 dark:bg-white/10"
          >
            {t("company.myTitle")} →
          </Link>
          <TabBtn active={tab === "saved"} onClick={() => setTab("saved")}>
            {t("account.saved")}
          </TabBtn>
          <TabBtn active={tab === "ratings"} onClick={() => setTab("ratings")}>
            {t("account.ratings")}
            {pending.length > 0 ? (
              <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-orange px-1.5 text-[11px] font-semibold text-white">
                {pending.length}
              </span>
            ) : null}
          </TabBtn>
          <TabBtn active={tab === "reports"} onClick={() => setTab("reports")}>
            {t("account.reports")}
          </TabBtn>
          <TabBtn active={tab === "inbox"} onClick={() => setTab("inbox")}>
            {t("account.inbox")}
            {(inbox ?? []).some((m) => !m.read_at) ? (
              <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-orange px-1.5 text-[11px] font-semibold text-white">
                {(inbox ?? []).filter((m) => !m.read_at).length}
              </span>
            ) : null}
          </TabBtn>
        </div>

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        {tab === "jobs" ? (
          <div className="mt-6">
            {jobs === null ? (
              <div className="h-40 animate-pulse rounded-[28px] bg-white/40 dark:bg-white/8" />
            ) : jobs.length === 0 ? (
              <Empty
                title={t("profile.nonePosted")}
                body={t("account.emptyPostedBody")}
                cta={t("home.ctaPost")}
                to="/post"
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {jobs.map((job, i) => (
                  <div key={job.id} className="flex flex-col gap-2">
                    <JobCard job={job} index={i} saved={savedIds.has(job.id)} onSavedChange={setSaved} />
                    {canRepost(job) ? (
                      <Link
                        to="/post"
                        search={{ from: job.id }}
                        data-testid="repost-link"
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white"
                      >
                        <RotateCcw className="size-4" />
                        {t("repost.btn")}
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === "apps" ? (
          <Navigate to="/aplicatii" search={{ tab: "trimise" }} replace />
        ) : tab === "saved" ? (
          <div className="mt-6">
            {saved === null ? (
              <div className="h-40 animate-pulse rounded-[28px] bg-white/40 dark:bg-white/8" />
            ) : saved.length === 0 ? (
              <Empty
                title={t("profile.noneSaved")}
                body={t("account.emptySavedBody")}
                cta={t("account.seeJobs")}
                to="/"
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {saved.map((job, i) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    index={i}
                    saved={savedIds.has(job.id)}
                    onSavedChange={(id, next) => {
                      setSaved(id, next);
                      if (!next) setSavedJobs((rows) => (rows ?? []).filter((r) => r.id !== id));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : tab === "inbox" ? (
          <InboxPane inbox={inbox} highlightId={search.msg} />
        ) : tab === "reports" ? (
          <div className="mt-6 space-y-3">
            {reports === null ? (
              <div className="h-40 animate-pulse rounded-[28px] bg-white/40 dark:bg-white/8" />
            ) : reports.length === 0 ? (
              <div className="rounded-[28px] p-8 text-center glass">
                <p className="text-sm text-muted">{t("report.empty")}</p>
              </div>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="rounded-[24px] p-5 glass">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-navy">
                        {r.target_type === "job" ? t("admin.job") : t("admin.user")} · {t(`report.${r.reason}`)}
                      </p>
                      {r.details ? <p className="mt-2 text-sm text-muted">{r.details}</p> : null}
                    </div>
                    <span className="rounded-full bg-navy/8 px-2.5 py-1 text-xs font-semibold text-navy">
                      {t(`report.${r.status}`)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {summary ? (
              <section className="rounded-[28px] p-5 glass sm:p-6">
                <h2 className="text-lg font-semibold text-navy">{t("profile.public")}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Stars value={Math.round(summary.average)} size="sm" />
                  <RatingBadge average={summary.average} count={summary.count} />
                </div>
                <Link
                  to="/u/$userId"
                  params={{ userId: user.id }}
                  className="mt-3 inline-block text-sm font-medium text-orange"
                >
                  {t("account.viewPublic")}
                </Link>
              </section>
            ) : null}

            {hiddenRatings > 0 ? (
              <p className="rounded-2xl bg-orange/10 px-4 py-3 text-sm text-navy" data-testid="hidden-ratings">
                {hiddenRatings === 1 ? t("review.hiddenCountOne") : t("review.hiddenCount", { n: hiddenRatings })}
              </p>
            ) : null}
            <section>
              <h2 className="text-lg font-semibold text-navy">{t("account.toRate")}</h2>
              {pending.length === 0 ? (
                <div className="mt-3 rounded-[24px] p-6 text-center glass">
                  <p className="text-sm text-muted">{t("account.noPending")}</p>
                </div>
              ) : (
                <ul className="mt-3 space-y-3">
                  {pending.map((p) => (
                    <li key={`${p.jobId}-${p.otherUserId}`} className="rounded-[24px] p-5 glass">
                      <p className="text-sm font-medium text-muted">{p.jobTitle}</p>
                      <div className="mt-3">
                        <RateForm
                          jobId={p.jobId}
                          toUserId={p.otherUserId}
                          otherName={p.otherName}
                          otherRole={p.otherRole}
                          onDone={() => void reload()}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {summary && summary.reviews.length > 0 ? (
              <section>
                <h2 className="text-lg font-semibold text-navy">{t("account.received")}</h2>
                <ul className="mt-3 space-y-3">
                  {summary.reviews.slice(0, 8).map((r) => (
                    <li key={r.id} className="rounded-[24px] p-5 glass">
                      <Stars value={r.stars} size="sm" />
                      <p className="mt-2 text-sm font-semibold text-navy">{r.from_name}</p>
                      {r.tags?.length ? <RatingTagList tags={r.tags} className="mt-2" /> : null}
                      {r.comment ? <p className="mt-2 text-sm text-navy/80">{r.comment}</p> : null}
                      <Link
                        to="/jobs/$id"
                        params={{ id: String(r.job_id) }}
                        className="mt-2 inline-block text-xs font-medium text-orange"
                      >
                        {r.job_title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
        <DeleteAccount />
      </main>
    </Shell>
  );
}

function DeleteAccount() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expected = t("account.deleteWord");

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount({ data: { confirm: word } });
      toast.success(t("account.deleteDone"));
      // The server already ended the session; clear local state and leave.
      try {
        await signOut("/");
      } catch {
        window.location.href = "/";
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setError(raw.startsWith("account.") ? t(raw) : t("account.deleteFail"));
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-[28px] p-5 ring-1 ring-danger/25 sm:p-6" data-testid="delete-account">
      <h2 className="text-base font-semibold tracking-tight text-navy">{t("account.deleteTitle")}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("account.deleteBody")}</p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 h-11 rounded-full px-4 text-sm font-semibold text-danger ring-1 ring-danger/40 hover:bg-danger/8"
        >
          {t("account.deleteOpen")}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-navy">
            {t("account.deleteType", { w: expected })}
            <input
              className="field mt-1.5"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              data-testid="delete-confirm"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !isDeleteConfirmWord(word)}
              onClick={() => void onDelete()}
              data-testid="delete-submit"
              className="h-11 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? t("account.deleteBusy") : t("account.deleteConfirm")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setWord("");
                setError(null);
              }}
              className="h-11 rounded-full px-4 text-sm font-medium text-muted hover:bg-navy/6"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex h-11 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white"
          : "inline-flex h-11 items-center rounded-full bg-white/45 dark:bg-white/8 px-4 text-sm font-medium text-navy ring-1 ring-navy/8"
      }
    >
      {children}
    </button>
  );
}

function InboxPane({ inbox, highlightId }: { inbox: InboxMessage[] | null; highlightId?: number }) {
  const { t } = useT();
  useEffect(() => {
    if (!highlightId || !inbox) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`inbox-msg-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [highlightId, inbox]);
  if (inbox === null) {
    return <div className="mt-6 h-40 animate-pulse rounded-[28px] bg-white/40 dark:bg-white/8" />;
  }
  if (inbox.length === 0) {
    return (
      <div className="mt-6 rounded-[28px] p-8 text-center glass">
        <p className="text-sm text-muted">{t("admin.emptyInbox")}</p>
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-3">
      {inbox.map((m) => {
        const hit = m.id === highlightId;
        return (
          <article
            key={m.id}
            id={`inbox-msg-${m.id}`}
            data-testid={hit ? "inbox-highlight" : undefined}
            className={hit ? "rounded-[24px] p-5 glass inbox-hit ring-2 ring-orange" : "rounded-[24px] p-5 glass"}
          >
            <p className="text-[11px] font-semibold tracking-[0.16em] text-orange uppercase">{t("inbox.fromAdmin")}</p>
            <div className="mt-1.5 flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-navy">{m.title}</h2>
              <span className="text-xs text-muted">
                {formatJobDate(m.created_at)} {formatJobTime(m.created_at)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-navy/80">{m.body}</p>
          </article>
        );
      })}
    </div>
  );
}

function Empty({
  title,
  body,
  cta,
  to,
}: {
  title: string;
  body: string;
  cta: string;
  to: "/post" | "/";
}) {
  return (
    <div className="rounded-[28px] p-8 text-center glass">
      <p className="text-lg font-semibold text-navy">{title}</p>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <Link
        to={to}
        className="mt-5 inline-flex h-12 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white"
      >
        {cta}
      </Link>
    </div>
  );
}

function BioBox({ initial, onSaved }: { initial: string; onSaved: () => Promise<void> }) {
  const { t } = useT();
  const [bio, setBio] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setBio(initial), [initial]);
  return (
    <div className="mt-5">
      <label className="text-sm font-semibold text-navy">{t("bio.label")}</label>
      <textarea
        className="field mt-2 min-h-24"
        maxLength={280}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder={t("bio.placeholder")}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          saveMyBio({ data: bio })
            .then(() => {
              toast.success(t("bio.save"));
              return onSaved();
            })
            .catch((err: unknown) => toast.error(errorText(err, t, t("bio.save"))))
            .finally(() => setBusy(false));
        }}
        className="mt-2 h-10 rounded-full px-4 text-sm font-semibold glass-navy disabled:opacity-45"
      >
        {t("bio.save")}
      </button>
    </div>
  );
}

function PhoneChange({ mePhone, onDone }: { mePhone: string; onDone: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [nextPhone, setNextPhone] = useState("");
  const ready = nextPhone.replace(/\D/g, "").length >= 8;
  return (
    <div className="mt-5 rounded-[24px] bg-white/45 p-4 ring-1 ring-navy/8 dark:bg-white/8">
      <PhoneLocked phone={mePhone} />
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 h-11 w-full rounded-full text-sm font-medium text-navy ring-1 ring-navy/10 hover:bg-navy/6"
        >
          {t("phone.change")}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-xs leading-relaxed text-muted">{t("phone.changeBlurb")}</p>
          <input
            className="field"
            minLength={8}
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("apply.phone")}
            value={nextPhone}
            onChange={(e) => setNextPhone(e.target.value)}
          />
          {ready ? (
            <PhoneVerifyChoice
              key={nextPhone}
              phone={nextPhone}
              purpose="change"
              autoSendSms={false}
              onVerified={onDone}
            />
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setNextPhone("");
            }}
            className="w-full text-center text-sm font-medium text-muted hover:text-navy"
          >
            {t("confirm.keep")}
          </button>
        </div>
      )}
    </div>
  );
}
