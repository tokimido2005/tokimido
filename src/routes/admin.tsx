import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Ban,
  Briefcase,
  Check,
  Coins,
  Crown,
  EyeOff,
  Flag,
  LayoutDashboard,
  Lock,
  MessageSquare,
  ScrollText,
  Search,
  Send,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
  Unlock,
  Users,
} from "lucide-react";
import { Ambient } from "@/components/ambient";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Logo } from "@/components/logo";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LangSwitcher, useT } from "@/lib/locale";
import { ThemeToggle } from "@/lib/theme";
import { seoHead } from "@/lib/seo";
import { cn, formatJobDate, formatJobTime, formatMdl } from "@/lib/utils";
import { Sentry } from "@/lib/sentry";
import {
  adminBanUser,
  adminDeleteJob,
  adminHideJob,
  adminResolveReport,
  adminSendMessage,
  adminUnbanUser,
  adminWarnUser,
  deleteDemoJobs,
  generateDemoJobs,
  getAdminSession,
  getAdminStats,
  getAdminUserDetail,
  listAdminJobs,
  listAdminLog,
  listAdminReports,
  listAdminUsers,
  listSmsLog,
  listSupportMessages,
  type AdminJob,
  type AdminLog,
  type AdminReport,
  type AdminStats,
  type AdminUser,
  type AdminUserDetail,
  type SmsLogRow,
  type SupportRow,
} from "@/lib/admin";
import {
  adminGrantPro,
  adminRevokePro,
  getMonetizationPublic,
  listMonetizationLog,
  listProSubscribers,
  saveMonetization,
  type MonetizationLogRow,
  type MonetizationSettings,
  type MoneyMode,
  type ProSubscriber,
} from "@/lib/monetization";

const TABS = ["overview", "money", "jobs", "users", "reports", "messages", "log", "sms"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/admin")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({
    tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : undefined,
  }),
  head: () => seoHead("Admin", "Panou de administrare Rabotaem.md."),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const search = Route.useSearch();
  const tab: Tab = search.tab ?? "overview";
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setAllowed(null);
      return;
    }
    let cancelled = false;
    getAdminSession()
      .then((s) => {
        if (!cancelled) setAllowed(s.admin);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (isPending || (user && allowed === null)) {
    return (
      <div className="relative min-h-dvh">
        <Ambient />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <div className="h-64 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" search={{ next: "/admin" }} />;
  if (!allowed) {
    return (
      <AdminChrome tab={tab} locked>
        <div className="mx-auto max-w-lg rounded-[32px] p-8 text-center glass-strong">
          <Shield className="mx-auto size-10 text-orange" />
          <h1 className="mt-4 text-2xl font-semibold text-navy">{t("admin.denied")}</h1>
          <p className="mt-2 text-sm text-muted">{t("admin.noAccess")}</p>
          <Link
            to="/"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white"
          >
            {t("admin.back")}
          </Link>
        </div>
      </AdminChrome>
    );
  }

  return (
    <AdminChrome tab={tab}>
      {tab === "overview" ? <OverviewPane /> : null}
      {tab === "money" ? <MoneyPane /> : null}
      {tab === "jobs" ? <JobsPane /> : null}
      {tab === "users" ? <UsersPane /> : null}
      {tab === "reports" ? <ReportsPane /> : null}
      {tab === "messages" ? <MessagesPane /> : null}
      {tab === "log" ? <LogPane /> : null}
      {tab === "sms" ? <SmsPane /> : null}
    </AdminChrome>
  );
}

function AdminChrome({
  tab,
  locked,
  children,
}: {
  tab: Tab;
  locked?: boolean;
  children: ReactNode;
}) {
  const { t } = useT();
  const items: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: "overview", label: t("admin.overview"), icon: LayoutDashboard },
    { id: "money", label: t("admin.money"), icon: Coins },
    { id: "jobs", label: t("admin.jobs"), icon: Briefcase },
    { id: "users", label: t("admin.users"), icon: Users },
    { id: "reports", label: t("admin.reports"), icon: Flag },
    { id: "messages", label: t("admin.messages"), icon: MessageSquare },
    { id: "log", label: t("admin.log"), icon: ScrollText },
    { id: "sms", label: t("admin.sms"), icon: Smartphone },
  ];

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <Ambient />
      <header className="sticky top-0 z-40 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <div className="mx-auto flex max-w-7xl items-center gap-2 rounded-[28px] px-2.5 py-1.5 glass-strong sm:gap-3 sm:px-4 sm:py-2">
          <Logo size="md" />
          <span className="hidden items-center gap-1.5 rounded-full bg-orange/15 px-2.5 py-1 text-xs font-semibold tracking-wide text-orange-deep uppercase sm:inline-flex">
            <Shield className="size-3.5" />
            {t("admin.panel")}
          </span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <LangSwitcher compact />
            <ThemeToggle compact />
            <Link
              to="/"
              className="hidden h-10 items-center rounded-full px-3 text-sm font-medium text-muted hover:bg-navy/6 hover:text-navy sm:inline-flex"
            >
              {t("admin.back")}
            </Link>
            <button
              type="button"
              onClick={() => void signOut("/")}
              className="h-10 rounded-full px-3 text-sm font-medium text-muted hover:text-navy"
            >
              {t("auth.signOut")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-w-0 max-w-7xl flex-col gap-4 px-3 py-5 sm:px-5 lg:flex-row lg:items-start">
        {!locked ? (
          <nav className="flex max-w-full min-w-0 gap-1 overflow-x-auto pb-1 lg:w-52 lg:shrink-0 lg:flex-col lg:overflow-visible">
            {items.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <Link
                  key={item.id}
                  to="/admin"
                  search={{ tab: item.id }}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors",
                    active ? "bg-brand text-white" : "text-navy/75 hover:bg-navy/8 hover:text-navy",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}

function OverviewPane() {
  const { t } = useT();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : t("home.loadError")));
  }, [t]);

  const cards = stats
    ? [
        { label: t("admin.statUsers"), value: stats.users, tab: "users" as const },
        { label: t("admin.statActive"), value: stats.activeJobs, tab: "jobs" as const },
        { label: t("admin.statExpired"), value: stats.expiredJobs, tab: "jobs" as const },
        { label: t("admin.statCancelled"), value: stats.cancelledJobs, tab: "jobs" as const },
        { label: t("admin.statReports"), value: stats.pendingReports, tab: "reports" as const },
        { label: t("admin.statBanned"), value: stats.bannedUsers, tab: "users" as const },
        { label: t("admin.statPro"), value: stats.proSubscribers, tab: "money" as const },
        { label: t("admin.statDemo"), value: stats.demoJobs, tab: "jobs" as const },
      ]
    : [];

  function testSentry() {
    try {
      throw new Error("Sentry test error from Rabotaem admin panel");
    } catch (err) {
      Sentry.captureException(err);
      toast.success("Test error sent to Sentry");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-navy">{t("admin.title")}</h1>
          <p className="mt-2 text-sm text-muted">{t("admin.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={testSentry}
          className="h-10 rounded-full bg-orange px-4 text-sm font-semibold text-white"
        >
          Test Sentry
        </button>
      </div>
      {stats ? (
        <Link
          to="/admin"
          search={{ tab: "money" }}
          className="mt-6 block rounded-[24px] p-5 glass-navy"
          data-testid="overview-mode"
          data-mode={stats.moneyMode}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase opacity-70">
                <Coins className="size-3.5" />
                {t("admin.modeNow")}
              </p>
              <p className="mt-1 text-2xl font-semibold">{t(`money.mode.${stats.moneyMode}`)}</p>
              <p className="mt-1 text-sm opacity-80">
                {stats.moneyMode === "freemium"
                  ? t("money.effect.freemium", { jobs: stats.freeJobLimit, apps: stats.freeApplyLimit })
                  : stats.moneyMode === "paid"
                    ? t("money.effect.paid")
                    : t("money.effect.free")}
              </p>
              {stats.moneyMode !== "free" ? (
                <p className="mt-2 text-sm font-medium tabular-nums">
                  {t("money.dashPrice", { n: stats.moneyPrice })}
                </p>
              ) : null}
            </div>
            <span className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold glass-orange">
              {t("admin.modeChange")}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5" data-testid="overview-mode-pills">
            {(["free", "freemium", "paid"] as const).map((id) => (
              <span
                key={id}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  stats.moneyMode === id ? "glass-orange" : "bg-white/15 opacity-80",
                )}
              >
                {t(`money.mode.${id}`)}
              </span>
            ))}
          </div>
        </Link>
      ) : (
        <div className="mt-6 h-28 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
      )}
      {stats === null ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.label}
              to="/admin"
              search={{ tab: c.tab }}
              className="rounded-[24px] p-5 glass transition-transform duration-150 hover:-translate-y-0.5"
            >
              <p className="text-sm font-medium text-muted">{c.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-navy">{c.value}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
