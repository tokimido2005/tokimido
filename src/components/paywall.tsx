import { Link } from "@tanstack/react-router";
import { Crown, Lock } from "lucide-react";
import { useT } from "@/lib/locale";
import { formatMdl } from "@/lib/utils";
import type { MonetizationAccess } from "@/lib/monetization";
import { useMoneyMode } from "@/lib/money-mode";

export function UsageHint({ access, action }: { access: MonetizationAccess; action: "post" | "apply" }) {
  const { t } = useT();
  const { showPro } = useMoneyMode();
  if (!showPro || access.mode === "free" || access.mode !== "freemium" || access.isPro || access.isAdmin) return null;
  const used = action === "post" ? access.jobsUsed : access.appliesUsed;
  const limit = action === "post" ? access.freeJobLimit : access.freeApplyLimit;
  const left = Math.max(0, limit - used);
  return (
    <p className="text-sm text-muted" data-testid="money-usage">
      {t("paywall.remaining", { n: left })}{" "}
      <span className="tabular-nums">
        ({used}/{limit})
      </span>
    </p>
  );
}

export function PaywallCard({
  access,
  action,
}: {
  access: MonetizationAccess;
  action: "post" | "apply";
}) {
  const { t } = useT();
  const { showPro } = useMoneyMode();
  if (!showPro || access.mode === "free") return null;
  const used = action === "post" ? access.jobsUsed : access.appliesUsed;
  const limit = action === "post" ? access.freeJobLimit : access.freeApplyLimit;
  const paid = access.mode === "paid";
  const title = paid
    ? action === "post"
      ? t("paywall.postPaid")
      : t("paywall.applyPaid")
    : action === "post"
      ? t("paywall.postLimit", { used, limit })
      : t("paywall.applyLimit", { used, limit });

  return (
    <section
      className="rounded-[28px] p-6 text-center glass sm:p-8"
      data-testid="paywall"
      data-mode={access.mode}
    >
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-orange/15 text-orange-deep">
        {paid ? <Lock className="size-5" /> : <Crown className="size-5" />}
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-navy">{t("pro.title")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{title}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-navy">
        {t("pro.price", { n: formatMdl(access.monthlyPriceMdl).replace(" MDL", "") })}
      </p>
      <Link
        to="/pro"
        className="sheen mt-5 inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold glass-orange"
      >
        {t("paywall.cta")}
      </Link>
    </section>
  );
}

export function ProBadge({ until }: { until?: string | null }) {
  const { t } = useT();
  const { showPro } = useMoneyMode();
  if (!showPro) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-orange-deep uppercase">
      <Crown className="size-3" />
      {t("account.pro")}
      {until ? <span className="font-medium normal-case tracking-normal text-muted">· {until}</span> : null}
    </span>
  );
}
