import { errorText } from "@/lib/i18n";
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
import { Sentry, initSentry } from "@/lib/sentry";
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
  adminVerifyStats,
  listSupportMessages,
  type AdminJob,
  type AdminLog,
  type AdminReport,
  type AdminStats,
  type AdminUser,
  type AdminUserDetail,
  type SmsLogRow,
  type VerifyStats,
  type SupportRow,
  adminWipeBackup,
  adminWipePreview,
  adminWipeUsers,
  WIPE_CONFIRM,
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
      {tab === "users" ? (
        <>
          <UsersPane />
          <WipeAllUsers />
        </>
      ) : null}
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
      .catch((err: unknown) => toast.error(errorText(err, t, t("home.loadError"))));
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
    initSentry();
    try {
      const err = new Error("Sentry test error from Rabotaem admin panel");
      Sentry.captureException(err);
      console.log("[sentry] capture called, ready:", (window as any).__RBT_SENTRY_READY);
      toast.success("Test error sent to Sentry");
    } catch (err) {
      console.error("[sentry] test failed", err);
      toast.error("Sentry test failed");
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

function MoneyPane() {
  const { t } = useT();
  const [settings, setSettings] = useState<MonetizationSettings | null>(null);
  const [mode, setMode] = useState<MoneyMode>("free");
  const [price, setPrice] = useState("49");
  const [jobLimit, setJobLimit] = useState("2");
  const [applyLimit, setApplyLimit] = useState("5");
  const [log, setLog] = useState<MonetizationLogRow[] | null>(null);
  const [subs, setSubs] = useState<ProSubscriber[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [grantUser, setGrantUser] = useState("");
  const [grantDays, setGrantDays] = useState("30");
  const [userPick, setUserPick] = useState<AdminUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMonetizationPublic({ data: {} }), listMonetizationLog(), listProSubscribers()])
      .then(([full, rows, people]) => {
        if (cancelled) return;
        setSettings(full);
        setMode(full.mode);
        setPrice(String(full.monthlyPriceMdl));
        setJobLimit(String(full.freeJobLimit));
        setApplyLimit(String(full.freeApplyLimit));
        setLog(rows);
        setSubs(people);
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(errorText(err, t, t("home.loadError")));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const q = grantUser.trim();
    if (q.length < 2) {
      setUserPick([]);
      return;
    }
    const handle = window.setTimeout(() => {
      listAdminUsers({ data: q })
        .then(setUserPick)
        .catch(() => setUserPick([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [grantUser]);

  async function persist() {
    setBusy(true);
    try {
      const saved = await saveMonetization({
        data: {
          mode,
          monthlyPriceMdl: Math.max(1, Number(price) || 49),
          freeJobLimit: Math.max(0, Number(jobLimit) || 0),
          freeApplyLimit: Math.max(0, Number(applyLimit) || 0),
        },
      });
      setSettings(saved);
      setMode(saved.mode);
      setPrice(String(saved.monthlyPriceMdl));
      setJobLimit(String(saved.freeJobLimit));
      setApplyLimit(String(saved.freeApplyLimit));
      setLog(await listMonetizationLog());
      setSubs(await listProSubscribers());
      toast.success(t("money.saved"));
      setPending(false);
      const { notifyMoneyChanged } = await import("@/lib/money-mode");
      notifyMoneyChanged(saved);
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusy(false);
    }
  }

  function pickMode(next: MoneyMode) {
    if (busy) return;
    setMode(next);
  }

  function onSave() {
    if (!settings) return;
    if (mode !== settings.mode) {
      setPending(true);
      return;
    }
    void persist();
  }

  const modeChanged = settings ? mode !== settings.mode : false;
  const dirty = settings
    ? Math.max(1, Number(price) || 0) !== settings.monthlyPriceMdl ||
      Math.max(0, Number(jobLimit) || 0) !== settings.freeJobLimit ||
      Math.max(0, Number(applyLimit) || 0) !== settings.freeApplyLimit
    : false;
  const canSave = Boolean(settings) && (dirty || modeChanged);

  async function grant(userId: string) {
    setBusy(true);
    try {
      await adminGrantPro({ data: { userId, days: Math.max(1, Number(grantDays) || 30) } });
      toast.success(t("money.grantOk"));
      setSubs(await listProSubscribers());
      setGrantUser("");
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    setBusy(true);
    try {
      await adminRevokePro({ data: userId });
      toast.success(t("money.revokeOk"));
      setSubs(await listProSubscribers());
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusy(false);
    }
  }

  const modes: Array<{
    id: MoneyMode;
    icon: typeof Unlock;
    title: string;
    body: string;
  }> = [
    { id: "free", icon: Unlock, title: t("money.freeTitle"), body: t("money.freeBody") },
    { id: "freemium", icon: Sparkles, title: t("money.freemiumTitle"), body: t("money.freemiumBody") },
    { id: "paid", icon: Lock, title: t("money.paidTitle"), body: t("money.paidBody") },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-navy">{t("money.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("money.lead")}</p>

      {settings ? (
        <div
          className="mt-5 rounded-[24px] p-5 glass-navy"
          data-testid="money-active-mode"
          data-mode={settings.mode}
        >
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase opacity-70">
            <Coins className="size-3.5" />
            {t("admin.modeNow")}
          </p>
          <p className="mt-1 text-2xl font-semibold">{t(`money.mode.${settings.mode}`)}</p>
          <p className="mt-1 text-sm opacity-80">
            {settings.mode === "freemium"
              ? t("money.effect.freemium", { jobs: settings.freeJobLimit, apps: settings.freeApplyLimit })
              : settings.mode === "paid"
                ? t("money.effect.paid")
                : t("money.effect.free")}
          </p>
          {settings.mode !== "free" ? (
            <p className="mt-2 text-sm font-medium tabular-nums">
              {t("money.dashPrice", { n: settings.monthlyPriceMdl })}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 h-28 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
      )}

      <p className="mt-5 text-sm text-muted">{t("money.clickHint")}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {modes.map((m) => {
          const Icon = m.icon;
          const selected = mode === m.id;
          const live = settings?.mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              data-testid={`money-mode-${m.id}`}
              data-live={live ? "true" : "false"}
              disabled={busy}
              onClick={() => pickMode(m.id)}
              className={cn(
                "min-h-44 rounded-[24px] p-5 text-left transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-60",
                live ? "glass-navy" : "glass text-navy",
                selected && !live ? "ring-2 ring-orange" : "",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full",
                    live ? "bg-white/15" : "bg-orange/15 text-orange-deep",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                {live ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
                    data-testid="money-live-badge"
                  >
                    <Check className="size-3" />
                    {t("money.live")}
                  </span>
                ) : selected ? (
                  <span className="rounded-full bg-orange/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-orange-deep uppercase">
                    {t("money.selected")}
                  </span>
                ) : null}
              </span>
              <p className="mt-3 text-xs font-semibold tracking-wide uppercase opacity-80">{t(`money.mode.${m.id}`)}</p>
              <p className="mt-1 text-lg font-semibold">{m.title}</p>
              <p className={cn("mt-2 text-sm leading-relaxed", live ? "opacity-80" : "text-muted")}>{m.body}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[24px] p-5 glass sm:p-6">
        <h2 className="text-base font-semibold text-navy">{t("money.priceSection")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-navy">{t("money.price")}</span>
            <input
              className="field mt-2 tabular-nums"
              type="number"
              min={1}
              max={5000}
              data-testid="money-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <span className="mt-1 block text-xs text-muted">{t("money.priceHint")}</span>
          </label>
          <label className={cn("block", mode === "freemium" ? "" : "opacity-50")}>
            <span className="text-sm font-medium text-navy">{t("money.jobLimit")}</span>
            <input
              className="field mt-2 tabular-nums"
              type="number"
              min={0}
              max={100}
              data-testid="money-job-limit"
              disabled={mode !== "freemium"}
              value={jobLimit}
              onChange={(e) => setJobLimit(e.target.value)}
            />
          </label>
          <label className={cn("block", mode === "freemium" ? "" : "opacity-50")}>
            <span className="text-sm font-medium text-navy">{t("money.applyLimit")}</span>
            <input
              className="field mt-2 tabular-nums"
              type="number"
              min={0}
              max={200}
              data-testid="money-apply-limit"
              disabled={mode !== "freemium"}
              value={applyLimit}
              onChange={(e) => setApplyLimit(e.target.value)}
            />
          </label>
        </div>
        {mode === "freemium" ? <p className="mt-3 text-xs text-muted">{t("money.limitsHint")}</p> : null}
        <p className="mt-3 text-sm text-navy" data-testid="money-impact">
          {mode === "freemium"
            ? t("money.effect.freemium", { jobs: Math.max(0, Number(jobLimit) || 0), apps: Math.max(0, Number(applyLimit) || 0) })
            : mode === "paid"
              ? t("money.effect.paid")
              : t("money.effect.free")}
        </p>
        {dirty || modeChanged ? (
          <p className="mt-2 text-xs font-medium text-orange-deep" data-testid="money-unsaved">
            {t("money.unsaved")}
          </p>
        ) : null}
        <button
          type="button"
          data-testid="money-save"
          disabled={busy || !canSave}
          onClick={onSave}
          className="sheen mt-5 inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold glass-orange disabled:opacity-50"
        >
          {modeChanged ? t("money.save") : t("money.saveSettings")}
        </button>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-navy">{t("money.subscribers")}</h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const match = userPick.find(
              (u) => u.id === grantUser || u.email === grantUser || u.name === grantUser,
            ) ?? userPick[0];
            if (match) void grant(match.id);
            else toast.error(t("admin.pickUser"));
          }}
        >
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              className="field pl-10"
              value={grantUser}
              onChange={(e) => setGrantUser(e.target.value)}
              placeholder={t("admin.searchUsers")}
            />
          </label>
          <label className="sm:w-28">
            <span className="sr-only">{t("money.grantDays")}</span>
            <input
              className="field tabular-nums"
              type="number"
              min={1}
              max={730}
              value={grantDays}
              onChange={(e) => setGrantDays(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-12 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("money.grant")}
          </button>
        </form>
        {userPick.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {userPick.slice(0, 5).map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setGrantUser(u.id)}
                  className="w-full rounded-2xl px-3 py-2 text-left text-sm text-navy hover:bg-navy/6"
                >
                  {u.name || u.email || u.id}
                  {u.pro_until ? ` · Pro` : ""}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 space-y-2">
          {subs === null ? (
            <div className="h-24 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
          ) : subs.length === 0 ? (
            <EmptyCard text={t("money.emptySub")} />
          ) : (
            subs.map((s) => (
              <article key={s.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] p-4 glass">
                <div>
                  <p className="font-semibold text-navy">{s.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {s.email ?? s.user_id} · {t("money.until", { d: formatJobDate(s.expires_at) })}
                    {s.source === "admin" ? " · admin" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void revoke(s.user_id)}
                  className="h-10 rounded-full px-3 text-sm font-medium text-danger hover:bg-danger/8 disabled:opacity-50"
                >
                  {t("money.revoke")}
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-navy">{t("money.log")}</h2>
        <div className="mt-3 space-y-2">
          {log === null ? (
            <div className="h-24 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
          ) : log.length === 0 ? (
            <EmptyCard text={t("money.emptyLog")} />
          ) : (
            log.map((row) => (
              <article key={row.id} className="rounded-[22px] p-4 glass" data-testid="money-log-row">
                <p className="text-sm font-semibold text-navy">
                  {moneyModeLabel(row.from_mode, t)}
                  {" → "}
                  {moneyModeLabel(row.to_mode, t)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {row.monthly_price_mdl} MDL · {row.free_job_limit}/{row.free_apply_limit} · {row.admin_name} ·{" "}
                  {formatJobDate(row.created_at)} {formatJobTime(row.created_at)}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <ConfirmDialog
        open={pending}
        title={t("money.confirmTitle")}
        body={t("money.confirmBody", {
          from: settings ? t(`money.mode.${settings.mode}`) : "",
          to: t(`money.mode.${mode}`),
        })}
        confirmLabel={t("money.save")}
        cancelLabel={t("confirm.keep")}
        busy={busy}
        onConfirm={() => void persist()}
        onClose={() => {
          setPending(false);
          if (settings) setMode(settings.mode);
        }}
      />
    </div>
  );
}

function JobsPane() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<AdminJob[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminJob | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [pendingDemoWipe, setPendingDemoWipe] = useState(false);

  const reload = useCallback(() => {
    return listAdminJobs({ data: { q, status } })
      .then(setRows)
      .catch((err: unknown) => {
        toast.error(errorText(err, t, t("home.loadError")));
        setRows([]);
      });
  }, [q, status, t]);

  useEffect(() => {
    const handle = window.setTimeout(() => void reload(), 180);
    return () => window.clearTimeout(handle);
  }, [reload]);

  async function hide(job: AdminJob, hidden: boolean) {
    setBusyId(job.id);
    try {
      await adminHideJob({ data: { id: job.id, hidden } });
      await reload();
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await adminDeleteJob({ data: pendingDelete.id });
      toast.success(t("toast.deleted"));
      setPendingDelete(null);
      await reload();
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusyId(null);
    }
  }

  async function makeDemo() {
    setDemoBusy(true);
    try {
      const res = await generateDemoJobs({ data: {} });
      if (res.created === 0) toast.error(t("admin.demoNoNew"));
      else toast.success(t("admin.demoGenerated", { n: res.created }));
      await reload();
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setDemoBusy(false);
    }
  }

  async function wipeDemo() {
    setDemoBusy(true);
    try {
      const res = await deleteDemoJobs({ data: {} });
      setPendingDemoWipe(false);
      if (res.deleted === 0) toast(t("admin.demoNone"));
      else toast.success(t("admin.demoDeleted", { n: res.deleted }));
      await reload();
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setDemoBusy(false);
    }
  }

  const filters = [
    { id: "all", label: t("admin.filterAll") },
    { id: "open", label: t("admin.filterOpen") },
    { id: "demo", label: t("admin.filterDemo") },
    { id: "hidden", label: t("admin.filterHidden") },
    { id: "expired", label: t("status.expired") },
    { id: "cancelled", label: t("status.cancelled") },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-navy">{t("admin.jobs")}</h1>
      <section className="mt-4 rounded-[24px] p-5 glass">
        <p className="text-sm font-semibold text-navy">{t("admin.demoTitle")}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t("admin.demoLead")}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            data-testid="demo-generate"
            disabled={demoBusy}
            onClick={() => void makeDemo()}
            className="sheen inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold glass-orange disabled:opacity-50"
          >
            <Sparkles className="size-4" />
            {t("admin.demoGenerate")}
          </button>
          <button
            type="button"
            data-testid="demo-delete"
            disabled={demoBusy}
            onClick={() => setPendingDemoWipe(true)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-danger ring-1 ring-danger/25 hover:bg-danger/8 disabled:opacity-50"
          >
            <Trash2 className="size-4" />
            {t("admin.demoDelete")}
          </button>
        </div>
      </section>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            className="field pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.search")}
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={cn(
                "h-10 rounded-full px-3 text-sm font-medium",
                status === f.id ? "bg-brand text-white" : "bg-white/45 text-navy ring-1 ring-navy/8 dark:bg-white/8",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {rows === null ? (
          <div className="h-40 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
        ) : rows.length === 0 ? (
          <EmptyCard text={t("admin.emptyJobs")} />
        ) : (
          rows.map((job) => (
            <article key={job.id} className="rounded-[22px] p-4 glass" data-demo={job.is_demo ? "true" : "false"}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/jobs/$id"
                      params={{ id: String(job.id) }}
                      className="font-semibold text-navy hover:text-orange"
                    >
                      {job.title}
                    </Link>
                    {job.is_demo ? (
                      <span
                        className="rounded-full bg-orange/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-orange-deep uppercase"
                        data-testid="demo-badge"
                      >
                        {t("admin.demoBadge")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {job.poster_name} · {job.locality}, {job.raion} · {job.status}
                    {job.starts_at ? ` · ${formatJobDate(job.starts_at)} ${formatJobTime(job.starts_at)}` : ""}
                    {job.hidden ? ` · ${t("admin.hidden")}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === job.id}
                    onClick={() => void hide(job, !job.hidden)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-navy hover:bg-navy/6 disabled:opacity-50"
                  >
                    <EyeOff className="size-4" />
                    {job.hidden ? t("admin.unhide") : t("admin.hide")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === job.id}
                    onClick={() => setPendingDelete(job)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-danger hover:bg-danger/8 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                    {t("admin.delete")}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t("confirm.deleteTitle")}
        body={t("admin.confirmDelete")}
        confirmLabel={t("admin.delete")}
        cancelLabel={t("confirm.keep")}
        danger
        busy={busyId === pendingDelete?.id}
        onConfirm={() => void remove()}
        onClose={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={pendingDemoWipe}
        title={t("admin.demoDelete")}
        body={t("admin.confirmDemoDelete")}
        confirmLabel={t("admin.demoDelete")}
        cancelLabel={t("confirm.keep")}
        danger
        busy={demoBusy}
        onConfirm={() => void wipeDemo()}
        onClose={() => setPendingDemoWipe(false)}
      />
    </div>
  );
}

function UsersPane() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");

  const reload = useCallback(() => {
    return listAdminUsers({ data: q })
      .then(setRows)
      .catch((err: unknown) => {
        toast.error(errorText(err, t, t("home.loadError")));
        setRows([]);
      });
  }, [q, t]);

  useEffect(() => {
    const handle = window.setTimeout(() => void reload(), 180);
    return () => window.clearTimeout(handle);
  }, [reload]);

  async function openUser(id: string) {
    try {
      setDetail(await getAdminUserDetail({ data: id }));
    } catch (err) {
      toast.error(errorText(err, t, t("home.loadError")));
    }
  }

  async function warn(userId: string) {
    if (reason.trim().length < 4) {
      toast.error(t("admin.warnNeed"));
      return;
    }
    setBusyId(userId);
    try {
      await adminWarnUser({ data: { userId, reason } });
      toast.success(t("admin.warned"));
      await reload();
      if (detail?.user.id === userId) await openUser(userId);
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusyId(null);
    }
  }

  async function ban(userId: string, days: 0 | 1 | 3 | 7 | 30) {
    if (reason.trim().length < 8) {
      toast.error(t("admin.reasonNeed"));
      return;
    }
    setBusyId(userId);
    try {
      await adminBanUser({ data: { userId, days, reason } });
      toast.success(t("admin.banned"));
      await reload();
      if (detail?.user.id === userId) await openUser(userId);
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusyId(null);
    }
  }

  async function unban(userId: string) {
    setBusyId(userId);
    try {
      await adminUnbanUser({ data: userId });
      await reload();
      if (detail?.user.id === userId) await openUser(userId);
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusyId(null);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusyId(detail.user.id);
    try {
      await adminSendMessage({ data: { userId: detail.user.id, title: msgTitle, body: msgBody } });
      toast.success(t("admin.sent"));
      setMsgTitle("");
      setMsgBody("");
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-navy">{t("admin.users")}</h1>
      <label className="relative mt-4 block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input
          className="field pl-10"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("admin.searchUsers")}
        />
      </label>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-2">
          {rows === null ? (
            <div className="h-40 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
          ) : rows.length === 0 ? (
            <EmptyCard text={t("admin.emptyUsers")} />
          ) : (
            rows.map((u) => {
              const banned = isBanned(u);
              return (
                <article key={u.id} className="rounded-[22px] p-4 glass">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button type="button" onClick={() => void openUser(u.id)} className="min-w-0 text-left">
                      <p className="font-semibold text-navy">{u.name || u.email || u.id}</p>
                      <p className="mt-1 text-xs text-muted">
                        {u.email ?? "—"}
                        {u.phone ? ` · ${u.phone}` : ""} · {u.jobs_count} {t("admin.posted")}
                        {u.warnings_count ? ` · ${t("admin.warnings", { n: u.warnings_count })}` : ""}
                        {u.pro_until ? ` · Pro` : ""}
                        {banned ? ` · ${t("admin.banned")}` : ""}
                      </p>
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      {banned ? (
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => void unban(u.id)}
                          className="h-10 rounded-full px-3 text-sm font-medium text-navy hover:bg-navy/6 disabled:opacity-50"
                        >
                          {t("admin.unban")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void openUser(u.id)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-danger hover:bg-danger/8"
                        >
                          <Ban className="size-4" />
                          {t("admin.ban")}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
        <aside className="rounded-[24px] p-5 glass lg:sticky lg:top-24">
          {detail ? (
            <UserDetail
              detail={detail}
              reason={reason}
              setReason={setReason}
              busy={busyId === detail.user.id}
              onBan={(d) => void ban(detail.user.id, d)}
              onWarn={() => void warn(detail.user.id)}
              onUnban={() => void unban(detail.user.id)}
              onGrantPro={() => {
                void (async () => {
                  setBusyId(detail.user.id);
                  try {
                    await adminGrantPro({ data: { userId: detail.user.id, days: 30 } });
                    toast.success(t("money.grantOk"));
                    await reload();
                    await openUser(detail.user.id);
                  } catch (err) {
                    toast.error(errorText(err, t, t("toast.updateFail")));
                  } finally {
                    setBusyId(null);
                  }
                })();
              }}
              onRevokePro={() => {
                void (async () => {
                  setBusyId(detail.user.id);
                  try {
                    await adminRevokePro({ data: detail.user.id });
                    toast.success(t("money.revokeOk"));
                    await reload();
                    await openUser(detail.user.id);
                  } catch (err) {
                    toast.error(errorText(err, t, t("toast.updateFail")));
                  } finally {
                    setBusyId(null);
                  }
                })();
              }}
              msgTitle={msgTitle}
              msgBody={msgBody}
              setMsgTitle={setMsgTitle}
              setMsgBody={setMsgBody}
              onSend={send}
            />
          ) : (
            <p className="text-sm text-muted">{t("admin.pickUser")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function UserDetail({
  detail,
  reason,
  setReason,
  busy,
  onBan,
  onWarn,
  onUnban,
  onGrantPro,
  onRevokePro,
  msgTitle,
  msgBody,
  setMsgTitle,
  setMsgBody,
  onSend,
}: {
  detail: AdminUserDetail;
  reason: string;
  setReason: (v: string) => void;
  busy: boolean;
  onBan: (days: 0 | 1 | 3 | 7 | 30) => void;
  onWarn: () => void;
  onUnban: () => void;
  onGrantPro: () => void;
  onRevokePro: () => void;
  msgTitle: string;
  msgBody: string;
  setMsgTitle: (v: string) => void;
  setMsgBody: (v: string) => void;
  onSend: (e: FormEvent) => void;
}) {
  const { t } = useT();
  const u = detail.user;
  const banned = isBanned(u);
  return (
    <div>
      <h2 className="text-lg font-semibold text-navy">{u.name || u.email}</h2>
      <p className="mt-1 text-xs text-muted">
        {u.email} · {u.phone || "—"}
        {u.warnings_count ? ` · ${t("admin.warnings", { n: u.warnings_count })}` : ""}
      </p>
      {u.pro_until ? (
        <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-orange-deep">
          <Crown className="size-3.5" />
          {t("account.proUntil", { d: formatJobDate(u.pro_until) })}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">{t("account.freePlan")}</p>
      )}
      {banned ? (
        <p className="mt-2 text-sm font-medium text-danger">
          {t("admin.banned")}{" "}
          {u.banned_until
            ? t("admin.until", { d: formatJobDate(u.banned_until) })
            : t("admin.forever")}
          {u.ban_reason ? ` · ${u.ban_reason}` : ""}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(
          ["admin.reasonFalse", "admin.reasonScam", "admin.reasonAbuse", "admin.reasonSpam", "admin.reasonRules"] as const
        ).map((key) => (
          <button
            key={key}
            type="button"
            data-testid="ban-reason-chip"
            onClick={() => setReason(t(key))}
            className={cn(
              "h-10 rounded-full px-3 text-sm font-medium",
              reason === t(key) ? "bg-brand text-white" : "bg-white/45 text-navy ring-1 ring-navy/8 dark:bg-white/8",
            )}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <input
        className="field mt-3"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("admin.reason")}
      />
      {banned ? (
        <button
          type="button"
          disabled={busy}
          onClick={onUnban}
          className="mt-3 h-11 w-full rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-50"
        >
          {t("admin.unban")}
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={onWarn}
            className="mt-3 h-11 w-full rounded-full bg-orange/15 text-sm font-semibold text-orange-deep ring-1 ring-orange/25 disabled:opacity-50"
          >
            {t("admin.warn")}
          </button>
          {u.warnings_count < 1 ? (
            <p className="mt-2 text-xs text-muted">{t("admin.warnNeed")}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {([1, 3, 7, 30, 0] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy || reason.trim().length < 8}
                  onClick={() => onBan(d)}
                  className="h-10 rounded-full px-3 text-sm font-medium text-danger ring-1 ring-danger/25 hover:bg-danger/8 disabled:opacity-50"
                >
                  {d === 0 ? t("admin.banPerm") : t(`admin.ban${d}`)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {u.pro_until ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRevokePro}
          className="mt-3 h-11 w-full rounded-full px-3 text-sm font-semibold text-danger ring-1 ring-danger/25 hover:bg-danger/8 disabled:opacity-50"
        >
          {t("money.revoke")}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onGrantPro}
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-orange/15 text-sm font-semibold text-orange-deep ring-1 ring-orange/25 disabled:opacity-50"
        >
          <Crown className="size-4" />
          {t("money.grant")}
        </button>
      )}
      <h3 className="mt-6 text-sm font-semibold text-navy">{t("admin.history")}</h3>
      <ul className="mt-2 space-y-1.5 text-xs text-muted">
        {detail.jobs.slice(0, 6).map((j) => (
          <li key={j.id}>
            {j.title} · {j.status}
          </li>
        ))}
        {detail.ratings.slice(0, 4).map((r, i) => (
          <li key={`r-${i}`}>
            {r.stars}★ {r.comment}
          </li>
        ))}
        {detail.reports.slice(0, 4).map((r) => (
          <li key={r.id}>
            {r.target_type} · {r.reason} · {r.status}
          </li>
        ))}
      </ul>
      <form onSubmit={onSend} className="mt-6 space-y-2">
        <p className="text-sm font-semibold text-navy">{t("admin.direct")}</p>
        <input
          className="field"
          required
          minLength={2}
          value={msgTitle}
          onChange={(e) => setMsgTitle(e.target.value)}
          placeholder={t("admin.msgTitle")}
        />
        <textarea
          className="field min-h-24"
          required
          minLength={4}
          value={msgBody}
          onChange={(e) => setMsgBody(e.target.value)}
          placeholder={t("admin.msgBody")}
        />
        <button
          type="submit"
          disabled={busy}
          className="sheen inline-flex h-11 w-full items-center justify-center gap-2 rounded-full glass-orange text-sm font-semibold disabled:opacity-50"
        >
          <Send className="size-4" />
          {t("admin.send")}
        </button>
        <p className="text-xs leading-relaxed text-muted">{t("admin.pushHint")}</p>
      </form>
    </div>
  );
}

function ReportsPane() {
  const { t } = useT();
  const [rows, setRows] = useState<AdminReport[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [banTarget, setBanTarget] = useState<AdminReport | null>(null);
  const [banReason, setBanReason] = useState("");

  const reload = useCallback(() => {
    return listAdminReports()
      .then(setRows)
      .catch((err: unknown) => {
        toast.error(errorText(err, t, t("home.loadError")));
        setRows([]);
      });
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function act(
    id: number,
    status: "reviewed" | "dismissed",
    extra?: { deleteJob?: boolean; banUser?: boolean; reason?: string },
  ) {
    setBusyId(id);
    try {
      await adminResolveReport({ data: { id, status, ...extra } });
      await reload();
      setBanTarget(null);
      setBanReason("");
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusyId(null);
    }
  }

  function confirmBan() {
    if (!banTarget) return;
    if (banReason.trim().length < 8) {
      toast.error(t("admin.reasonNeed"));
      return;
    }
    void act(banTarget.id, "reviewed", { banUser: true, reason: banReason.trim() });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-navy">{t("admin.reports")}</h1>
      <div className="mt-4 space-y-2">
        {rows === null ? (
          <div className="h-40 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
        ) : rows.length === 0 ? (
          <EmptyCard text={t("admin.empty")} />
        ) : (
          rows.map((r) => {
            const targetHref = r.target_type === "job" ? `/jobs/${r.target_id}` : `/u/${encodeURIComponent(r.target_id)}`;
            return (
              <article key={r.id} className="rounded-[22px] p-5 glass">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      {r.target_type === "job" ? t("admin.job") : t("admin.user")} · {t(`report.${r.reason}`)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {r.reporter_name} · {formatJobDate(r.created_at)} {formatJobTime(r.created_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-navy/8 px-2.5 py-1 text-xs font-semibold text-navy">
                    {t(`report.${r.status}`)}
                  </span>
                </div>
                {r.details ? <p className="mt-3 text-sm leading-relaxed text-navy/80">{r.details}</p> : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {r.target_type === "job" ? (
                    <Link
                      to="/jobs/$id"
                      params={{ id: r.target_id }}
                      className="h-10 rounded-full px-3 text-sm font-medium text-orange hover:bg-orange/10"
                    >
                      {targetHref}
                    </Link>
                  ) : (
                    <Link
                      to="/u/$userId"
                      params={{ userId: r.target_id }}
                      className="h-10 rounded-full px-3 text-sm font-medium text-orange hover:bg-orange/10"
                    >
                      {t("profile.public")}
                    </Link>
                  )}
                  {r.status === "pending" ? (
                    <>
                      {r.target_type === "job" ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void act(r.id, "reviewed", { deleteJob: true })}
                          className="h-10 rounded-full px-3 text-sm font-medium text-danger hover:bg-danger/8 disabled:opacity-50"
                        >
                          {t("admin.actionDeleteJob")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => {
                          setBanTarget(r);
                          setBanReason(t(`report.${r.reason}`) || r.reason);
                        }}
                        className="h-10 rounded-full px-3 text-sm font-medium text-danger hover:bg-danger/8 disabled:opacity-50"
                      >
                        {t("admin.actionBan")}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void act(r.id, "reviewed")}
                        className="h-10 rounded-full bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {t("report.reviewed")}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void act(r.id, "dismissed")}
                        className="h-10 rounded-full px-3 text-sm font-medium text-muted hover:bg-navy/6 disabled:opacity-50"
                      >
                        {t("report.dismissed")}
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
      {banTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-navy-deep/45 backdrop-blur-sm"
            aria-label={t("confirm.keep")}
            onClick={() => (busyId === banTarget.id ? undefined : setBanTarget(null))}
          />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-[28px] p-6 glass-strong">
            <h2 className="text-lg font-semibold tracking-tight text-navy">{t("admin.ban")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t("admin.reasonNeed")}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(
                ["admin.reasonFalse", "admin.reasonScam", "admin.reasonAbuse", "admin.reasonSpam", "admin.reasonRules"] as const
              ).map((key) => (
                <button
                  key={key}
                  type="button"
                  data-testid="ban-reason-chip"
                  onClick={() => setBanReason(t(key))}
                  className={cn(
                    "h-10 rounded-full px-3 text-sm font-medium",
                    banReason === t(key) ? "bg-brand text-white" : "bg-white/45 text-navy ring-1 ring-navy/8 dark:bg-white/8",
                  )}
                >
                  {t(key)}
                </button>
              ))}
            </div>
            <input
              className="field mt-3"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder={t("admin.reason")}
              data-testid="report-ban-reason"
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setBanTarget(null)}
                className="h-11 rounded-full px-4 text-sm font-medium text-muted hover:bg-navy/6"
              >
                {t("confirm.keep")}
              </button>
              <button
                type="button"
                disabled={busyId === banTarget.id || banReason.trim().length < 8}
                onClick={confirmBan}
                className="h-11 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("admin.actionBan")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MessagesPane() {
  const { t } = useT();
  const [rows, setRows] = useState<SupportRow[] | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listSupportMessages()
      .then(setRows)
      .catch((err: unknown) => {
        toast.error(errorText(err, t, t("home.loadError")));
        setRows([]);
      });
    listAdminUsers({ data: "" })
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [t]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await adminSendMessage({ data: { userId, title, body } });
      toast.success(t("admin.sent"));
      setTitle("");
      setBody("");
    } catch (err) {
      toast.error(errorText(err, t, t("toast.updateFail")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-navy">{t("admin.direct")}</h1>
        <form onSubmit={(e) => void send(e)} className="mt-4 space-y-3 rounded-[24px] p-5 glass">
          <select
            className="field"
            required
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">{t("admin.pickUser")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email || u.id}
              </option>
            ))}
          </select>
          <input
            className="field"
            required
            minLength={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("admin.msgTitle")}
          />
          <textarea
            className="field min-h-28"
            required
            minLength={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("admin.msgBody")}
          />
          <button
            type="submit"
            disabled={busy}
            className="sheen inline-flex h-11 w-full items-center justify-center gap-2 rounded-full glass-orange text-sm font-semibold disabled:opacity-50"
          >
            <Send className="size-4" />
            {t("admin.send")}
          </button>
          <p className="text-xs leading-relaxed text-muted">{t("admin.pushHint")}</p>
        </form>
      </section>
      <section>
        <h2 className="text-2xl font-semibold tracking-tight text-navy">{t("admin.support")}</h2>
        <div className="mt-4 space-y-2">
          {rows === null ? (
            <div className="h-40 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
          ) : rows.length === 0 ? (
            <EmptyCard text={t("admin.emptySupport")} />
          ) : (
            rows.map((m) => (
              <article key={m.id} className="rounded-[22px] p-4 glass">
                <p className="text-sm font-semibold text-navy">
                  {m.name} · {m.email}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatJobDate(m.created_at)} {formatJobTime(m.created_at)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-navy/80">{m.message}</p>
                {m.user_id ? (
                  <button
                    type="button"
                    onClick={() => setUserId(m.user_id ?? "")}
                    className="mt-2 text-sm font-medium text-orange"
                  >
                    {t("admin.direct")}
                  </button>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function LogPane() {
  const { t } = useT();
  const [rows, setRows] = useState<AdminLog[] | null>(null);
  const [banned, setBanned] = useState<AdminUser[]>([]);
  const [filter, setFilter] = useState<"all" | "bans" | "messages" | "money">("all");

  useEffect(() => {
    setRows(null);
    listAdminLog({ data: { filter } })
      .then(setRows)
      .catch((err: unknown) => {
        toast.error(errorText(err, t, t("home.loadError")));
        setRows([]);
      });
  }, [t, filter]);

  useEffect(() => {
    if (filter !== "bans") {
      setBanned([]);
      return;
    }
    listAdminUsers({ data: "" })
      .then((users) => setBanned(users.filter(isBanned)))
      .catch(() => setBanned([]));
  }, [filter]);

  const filters = [
    { id: "all" as const, label: t("admin.logAll") },
    { id: "bans" as const, label: t("admin.logBans") },
    { id: "messages" as const, label: t("admin.logMsgs") },
    { id: "money" as const, label: t("admin.logMoney") },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-navy">
        {filter === "bans" ? t("admin.banLog") : t("admin.log")}
      </h1>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            data-testid={f.id === "bans" ? "admin-log-bans" : undefined}
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-10 rounded-full px-3 text-sm font-medium",
              filter === f.id ? "bg-brand text-white" : "bg-white/45 text-navy ring-1 ring-navy/8 dark:bg-white/8",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {filter === "bans" && banned.length > 0 ? (
        <section className="mt-4 rounded-[24px] p-4 glass" data-testid="admin-banned-now">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">{t("admin.bannedNow")}</p>
          <ul className="mt-2 space-y-2">
            {banned.map((u) => (
              <li key={u.id} className="text-sm text-navy">
                <span className="font-semibold">{u.name || u.email || u.id}</span>
                <span className="text-muted">
                  {" · "}
                  {u.banned_until ? t("admin.until", { d: formatJobDate(u.banned_until) }) : t("admin.forever")}
                  {u.ban_reason ? ` · ${u.ban_reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mt-4 space-y-2">
        {rows === null ? (
          <div className="h-40 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
        ) : rows.length === 0 ? (
          <EmptyCard text={t("admin.emptyLog")} />
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              className="rounded-[22px] p-4 glass"
              data-testid={row.action.startsWith("user.ban") || row.action === "report.ban_user" ? "admin-ban-log-row" : undefined}
            >
              <p className="text-sm font-semibold text-navy">{formatLogAction(row.action, t)}</p>
              <p className="mt-1 text-xs text-muted">
                {row.target_name || row.target_id}
                {row.details ? ` · ${row.details}` : ""} · {formatJobDate(row.created_at)} {formatJobTime(row.created_at)}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function SmsPane() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SmsLogRow[] | null>(null);
  const [stats, setStats] = useState<VerifyStats | null>(null);

  useEffect(() => {
    adminVerifyStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      listSmsLog({ data: { q } })
        .then(setRows)
        .catch((err: unknown) => {
          toast.error(errorText(err, t, t("home.loadError")));
          setRows([]);
        });
    }, 180);
    return () => window.clearTimeout(handle);
  }, [q, t]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-navy">{t("admin.sms")}</h1>
      <p className="mt-2 text-sm text-muted">{t("admin.smsLead")}</p>
      {stats ? (
        <div className="mt-4 grid grid-cols-2 gap-2" data-testid="verify-stats">
          {stats.map((s) => {
            const total = s.telegram + s.sms;
            const share = total ? Math.round((s.telegram / total) * 100) : 0;
            return (
              <div key={s.days} className="rounded-[22px] p-4 glass">
                <p className="text-xs font-semibold text-muted">{t("admin.statsDays", { n: String(s.days) })}</p>
                <p className="mt-2 text-sm text-navy">
                  Telegram: <b className="tabular-nums">{s.telegram}</b> · SMS: <b className="tabular-nums">{s.sms}</b>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t("admin.tgShare", { p: String(share) })} · {t("admin.smsSent", { n: String(s.smsSent) })}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
      <label className="relative mt-4 block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input className="field pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.search")} />
      </label>
      <div className="mt-4 space-y-2">
        {rows === null ? (
          <div className="h-40 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />
        ) : rows.length === 0 ? (
          <EmptyCard text={t("admin.emptySms")} />
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              className="rounded-[22px] p-4 glass"
              data-testid="sms-log-row"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tabular-nums text-navy">{row.phone || "—"}</p>
                  <p className="mt-1 text-xs text-muted">
                    {t(`sms.purpose.${row.purpose}`) === `sms.purpose.${row.purpose}`
                      ? row.purpose
                      : t(`sms.purpose.${row.purpose}`)}
                    {" · "}
                    <span className={row.event === "blocked" ? "font-semibold text-danger" : undefined}>
                      {t(`sms.event.${row.event}`) === `sms.event.${row.event}`
                        ? row.event
                        : t(`sms.event.${row.event}`)}
                    </span>
                    {row.detail ? ` · ${row.detail}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    IP {row.ip || "—"}
                    {row.user_id ? ` · ${row.user_id.slice(0, 10)}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted">
                  {formatJobDate(row.created_at)} {formatJobTime(row.created_at)}
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] p-8 text-center glass">
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}

function formatLogAction(action: string, t: (key: string) => string) {
  const key = `log.${action}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return action.replaceAll(".", " · ");
}

function moneyModeLabel(mode: string, t: (key: string) => string) {
  if (mode === "free" || mode === "freemium" || mode === "paid") return t(`money.mode.${mode}`);
  return mode || "—";
}

function isBanned(u: Pick<AdminUser, "banned_at" | "banned_until">) {
  if (!u.banned_at) return false;
  if (!u.banned_until) return true;
  return new Date(u.banned_until).getTime() > Date.now();
}

/** Danger zone: delete every account except the admin, after a backup. Admin-only, Romanian. */
function WipeAllUsers() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof adminWipePreview>> | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  async function start() {
    setOpen(true);
    try {
      setPreview(await adminWipePreview());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nu am putut număra conturile");
    }
  }

  async function backup() {
    setBusy(true);
    try {
      const json = await adminWipeBackup();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rabotaem-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackedUp(true);
      toast.success("Copia de rezervă a fost descărcată");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nu am putut face copia de rezervă");
    } finally {
      setBusy(false);
    }
  }

  async function wipe() {
    setBusy(true);
    try {
      const res = await adminWipeUsers({ data: { confirm: word } });
      setDone(res.deletedUsers);
      setPreview(await adminWipePreview().catch(() => null));
      toast.success(`Au fost șterse ${res.deletedUsers} conturi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ștergerea a eșuat");
    } finally {
      setBusy(false);
    }
  }

  const ready = backedUp && word.trim().toUpperCase().replace("STERGE", "ȘTERGE") === WIPE_CONFIRM;

  return (
    <section className="mt-10 rounded-[28px] p-5 ring-1 ring-danger/30 sm:p-6" data-testid="wipe-users">
      <h2 className="text-lg font-semibold text-danger">Zonă periculoasă: șterge toate conturile</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Șterge definitiv toți utilizatorii, în afară de admin, împreună cu anunțurile, aplicațiile, evaluările,
        salvările, notificările și datele SMS ale lor. Oamenii vor trebui să-și facă cont nou, cu verificare SMS.
        Acțiunea nu poate fi anulată.
      </p>
      {done !== null ? (
        <p className="mt-4 rounded-2xl bg-navy/6 px-4 py-3 text-sm font-medium text-navy" data-testid="wipe-done">
          Gata: au fost șterse {done} conturi. Au rămas doar conturile de admin.
        </p>
      ) : null}
      {!open ? (
        <button
          type="button"
          onClick={() => void start()}
          className="mt-4 h-11 rounded-full px-4 text-sm font-semibold text-danger ring-1 ring-danger/40 hover:bg-danger/8"
          data-testid="wipe-open"
        >
          Pregătește ștergerea
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-navy/5 p-4 text-sm text-navy" data-testid="wipe-preview">
            {preview ? (
              <>
                Se vor șterge <b>{preview.users}</b> conturi, <b>{preview.jobs}</b> anunțuri, <b>{preview.applications}</b>{" "}
                aplicații și <b>{preview.ratings}</b> evaluări. Rămân {preview.admins} cont(uri) de admin.
              </>
            ) : (
              "Se numără…"
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-navy">1. Descarcă o copie de rezervă (fără parole sau poze)</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void backup()}
              data-testid="wipe-backup"
              className="mt-2 h-10 rounded-full px-4 text-sm font-semibold text-navy ring-1 ring-navy/20 hover:bg-navy/5 disabled:opacity-50"
            >
              {backedUp ? "Descarcă din nou" : "Descarcă copia de rezervă"}
            </button>
          </div>
          <label className="block text-sm font-medium text-navy">
            2. Scrie <span className="font-semibold">{WIPE_CONFIRM}</span> ca să confirmi
            <input
              className="field mt-1.5"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              disabled={!backedUp}
              autoComplete="off"
              data-testid="wipe-confirm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !ready}
              onClick={() => void wipe()}
              data-testid="wipe-submit"
              className="h-11 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? "Se șterge…" : "Șterge toate conturile"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setWord("");
              }}
              className="h-11 rounded-full px-4 text-sm font-medium text-muted hover:bg-navy/6"
            >
              Renunță
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
