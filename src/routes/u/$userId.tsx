import { errorText } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { enUS, ro, ru } from "date-fns/locale";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { RatingBadge, Stars } from "@/components/stars";
import { RatingTagList } from "@/components/rating-tags-list";
import { ReportButton } from "@/components/report-dialog";
import { TrustBadges, computeTrust } from "@/components/trust-badges";
import { getPublicProfile } from "@/lib/ratings";
import { revealProfilePhone } from "@/lib/profile";
import { blockUser, getBlockStatus, unblockUser } from "@/lib/safety";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatMdl } from "@/lib/utils";
import { useT } from "@/lib/locale";
import { setClientSeo } from "@/lib/seo";

export const Route = createFileRoute("/u/$userId")({
  loader: async ({ params }) => getPublicProfile({ data: params.userId }),
  component: PublicProfile,
});

function PublicProfile() {
  const profile = Route.useLoaderData();
  const { t, locale } = useT();
  const { user } = useCurrentUserState();
  const [phone, setPhone] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "worker" | "poster">("all");
  const dfLocale = locale === "ru" ? ru : locale === "en" ? enUS : ro;
  const isSelf = user?.id === profile.userId;
  const flags = computeTrust({
    phoneVerified: profile.phoneVerified,
    hasPhoto: Boolean(profile.photo),
    bio: profile.bio,
    firstName: profile.firstName,
    lastName: profile.lastName,
    completedCount: profile.completedCount,
    average: profile.average,
    ratingCount: profile.count,
  });
  const reviews = useMemo(() => {
    if (filter === "all") return profile.reviews;
    return profile.reviews.filter((r) => r.role === filter);
  }, [profile.reviews, filter]);
  const maxBreakdown = Math.max(1, ...profile.breakdown.map((b) => b.n));

  useEffect(() => {
    setClientSeo(profile.displayName, t("profile.public"));
  }, [profile.displayName, t]);

  useEffect(() => {
    if (!user) {
      setPhone(null);
      return;
    }
    let cancelled = false;
    revealProfilePhone({ data: profile.userId })
      .then((value) => {
        if (!cancelled) setPhone(value);
      })
      .catch(() => {
        if (!cancelled) setPhone(null);
      });
    if (isSelf) {
      setBlocked(false);
      return () => {
        cancelled = true;
      };
    }
    getBlockStatus({ data: profile.userId })
      .then((row) => {
        if (!cancelled) setBlocked(row.blocked);
      })
      .catch(() => {
        if (!cancelled) setBlocked(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile.userId, isSelf]);

  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted">{t("profile.public")}</p>
          {!isSelf ? (
            <div className="flex flex-wrap items-center gap-2">
              <ReportButton targetType="user" targetId={profile.userId} />
              {user ? (
                <button
                  type="button"
                  disabled={blockBusy}
                  onClick={() => {
                    setBlockBusy(true);
                    const op = blocked ? unblockUser : blockUser;
                    op({ data: profile.userId })
                      .then(() => {
                        setBlocked(!blocked);
                        toast.success(blocked ? t("block.unblocked") : t("block.blocked"));
                      })
                      .catch((err: unknown) => {
                        toast.error(errorText(err, t, t("block.fail")));
                      })
                      .finally(() => setBlockBusy(false));
                  }}
                  className="inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-muted hover:bg-navy/6 hover:text-navy"
                >
                  {blocked ? t("block.undo") : t("block.do")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <section className="mt-3 rounded-[32px] p-5 glass sm:p-7">
          <div className="flex items-center gap-4">
            {profile.photo ? (
              <img
                src={profile.photo}
                alt=""
                className="size-20 rounded-full object-cover ring-1 ring-navy/10"
              />
            ) : (
              <span className="grid size-20 place-items-center rounded-full bg-brand text-2xl font-semibold text-white">
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-semibold tracking-tight text-navy">
                {profile.displayName}
              </h1>
              <div className="mt-2">
                <RatingBadge average={profile.average} count={profile.count} />
              </div>
              <p className="mt-2 text-sm text-muted">
                {profile.completedCount === 1
                  ? t("profile.completedOne")
                  : t("profile.completed", { n: profile.completedCount })}
              </p>
            </div>
          </div>
          <TrustBadges flags={flags} />
          {profile.bio ? <p className="mt-4 text-sm leading-relaxed text-navy/85">{profile.bio}</p> : null}
          {phone ? (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-navy/6 px-3 py-2 text-sm font-semibold text-navy">
              <Phone className="size-3.5" />
              {t("profile.phone")}: <span className="tabular-nums">{phone}</span>
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted">{t("profile.phoneHidden")}</p>
          )}
          {profile.count > 0 ? (
            <ul className="mt-5 space-y-1.5">
              {profile.breakdown.map((row) => (
                <li key={row.stars} className="flex items-center gap-2 text-xs text-muted">
                  <span className="w-8 tabular-nums">{row.stars}★</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy/10">
                    <span
                      className="block h-full rounded-full bg-orange"
                      style={{ width: `${Math.round((row.n / maxBreakdown) * 100)}%` }}
                    />
                  </span>
                  <span className="w-6 text-right tabular-nums">{row.n}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {profile.topTags.length > 0 ? (
            <div className="mt-5" data-testid="profile-top-tags">
              <p className="text-xs font-medium text-muted">{t("review.topTags")}</p>
              <RatingTagList tags={profile.topTags} counts className="mt-2" />
            </div>
          ) : null}
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-navy">{t("profile.reviews")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["all", "worker", "poster"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={
                  filter === id
                    ? "h-9 rounded-full bg-brand px-3 text-sm font-semibold text-white"
                    : "h-9 rounded-full bg-white/45 px-3 text-sm font-medium text-navy ring-1 ring-navy/8 dark:bg-white/8"
                }
              >
                {id === "all" ? t("review.filterAll") : id === "worker" ? t("review.asWorker") : t("review.asPoster")}
              </button>
            ))}
          </div>
          {reviews.length === 0 ? (
            <div className="mt-4 rounded-[28px] p-8 text-center glass">
              <p className="text-sm text-muted">{t("review.empty")}</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {reviews.map((r) => {
                const when = formatDistanceToNow(new Date(r.created_at), {
                  addSuffix: true,
                  locale: dfLocale,
                });
                return (
                  <li key={r.id} className="rounded-[24px] p-5 glass">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Stars value={r.stars} size="sm" />
                        <Link
                          to="/u/$userId"
                          params={{ userId: r.from_user_id }}
                          className="mt-2 block text-sm font-semibold text-navy hover:text-orange"
                        >
                          {r.from_name}
                        </Link>
                        <p className="mt-0.5 text-[11px] font-medium text-subtle">
                          {r.role === "poster" ? t("review.asPoster") : t("review.asWorker")}
                        </p>
                      </div>
                      <span className="text-xs text-subtle">{when}</span>
                    </div>
                    {r.tags?.length ? <RatingTagList tags={r.tags} className="mt-2" /> : null}
                    {r.comment ? (
                      <p className="mt-3 text-sm leading-relaxed text-navy/85">{r.comment}</p>
                    ) : null}
                    <Link
                      to="/jobs/$id"
                      params={{ id: String(r.job_id) }}
                      className="mt-3 inline-block text-xs font-medium text-orange"
                    >
                      {r.job_title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-navy">{t("history.title")}</h2>
          {profile.history.length === 0 ? (
            <div className="mt-4 rounded-[28px] p-8 text-center glass">
              <p className="text-sm text-muted">{t("history.empty")}</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {profile.history.map((job) => (
                <li key={`${job.role}-${job.id}`}>
                  <Link
                    to="/jobs/$id"
                    params={{ id: String(job.id) }}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[22px] p-4 glass"
                  >
                    <div>
                      <p className="font-semibold text-navy">{job.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {job.locality}, {job.raion} ·{" "}
                        {job.role === "poster" ? t("review.asPoster") : t("review.asWorker")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-orange-deep">
                      {formatMdl(job.payment_mdl)}
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
