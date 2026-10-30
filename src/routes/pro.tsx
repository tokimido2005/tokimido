import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { activatePro, getMyAccess, type MonetizationAccess } from "@/lib/monetization";
import { useMoneyMode } from "@/lib/money-mode";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatJobDate, formatMdl } from "@/lib/utils";
import { useT } from "@/lib/locale";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/pro")({
  head: () => seoHead("Rabotaem Pro", "Abonament lunar pentru anunțuri și aplicații nelimitate."),
  component: ProPage,
});

function ProPage() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const { showPro, ready } = useMoneyMode();
  const [access, setAccess] = useState<MonetizationAccess | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !showPro) {
      void navigate({ to: "/" });
    }
  }, [ready, showPro, navigate]);

  useEffect(() => {
    let cancelled = false;
    getMyAccess({ data: { t: Date.now() } })
      .then((row) => {
        if (!cancelled) setAccess(row);
      })
      .catch(() => {
        if (!cancelled) setAccess(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function activate() {
    if (!user) {
      await navigate({ to: "/login", search: { next: "/pro" } });
      return;
    }
    setBusy(true);
    try {
      const next = await activatePro();
      setAccess(next);
      toast.success(t("pro.ok"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.updateFail"));
    } finally {
      setBusy(false);
    }
  }

  const benefits = [t("pro.benefit1"), t("pro.benefit2"), t("pro.benefit3"), t("pro.benefit4")];
  const modeHint =
    access?.mode === "paid"
      ? t("pro.paidMode")
      : access?.mode === "freemium"
        ? t("pro.freemiumMode", { jobs: access.freeJobLimit, apps: access.freeApplyLimit })
        : t("pro.freeMode");

  if (ready && !showPro) {
    return <Navigate to="/" />;
  }
  if (!ready || !showPro) {
    return (
      <Shell>
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="h-64 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="text-sm font-semibold tracking-[0.18em] text-orange uppercase">{t("pro.kicker")}</p>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
          <Crown className="size-8 text-orange" />
          {t("pro.title")}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{t("pro.lead")}</p>

        <section className="mt-8 rounded-[32px] p-6 glass sm:p-8" data-testid="pro-card">
          <p className="text-sm font-medium text-muted">{t("money.price")}</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-navy">
            {access ? formatMdl(access.monthlyPriceMdl) : "—"}
            <span className="ml-2 text-base font-medium text-muted">{t("pro.perMonth")}</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted">{modeHint}</p>
          <ul className="mt-6 space-y-3">
            {benefits.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-navy">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-orange/15 text-orange-deep">
                  <Check className="size-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>

          {isPending || access === null ? (
            <div className="mt-8 h-14 animate-pulse rounded-full bg-white/40 dark:bg-white/8" />
          ) : access.isPro && !access.isAdmin ? (
            <div className="mt-8">
              <p className="text-sm font-semibold text-navy">{t("pro.already")}</p>
              {access.proUntil ? (
                <p className="mt-1 text-sm text-muted">{t("pro.until", { d: formatJobDate(access.proUntil) })}</p>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void activate()}
                className="mt-4 h-12 w-full rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? t("pro.busy") : t("pro.extend")}
              </button>
            </div>
          ) : access.isAdmin ? (
            <p className="mt-8 text-sm font-medium text-navy">{t("pro.adminFree")}</p>
          ) : !user ? (
            <Link
              to="/login"
              search={{ next: "/pro" }}
              className="sheen mt-8 flex h-14 items-center justify-center rounded-full text-base font-semibold glass-orange"
            >
              {t("pro.needSignIn")}
            </Link>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void activate()}
              className="sheen mt-8 flex h-14 w-full items-center justify-center rounded-full text-base font-semibold glass-orange disabled:opacity-50"
            >
              {busy ? t("pro.busy") : t("pro.cta")}
            </button>
          )}
          <p className="mt-4 text-xs leading-relaxed text-subtle">{t("pro.demo")}</p>
        </section>
      </main>
    </Shell>
  );
}
