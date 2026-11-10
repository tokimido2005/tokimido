import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Shield, X, Crown } from "lucide-react";
import { Logo } from "@/components/logo";
import { AuthSlot } from "@/components/auth-slot";
import { RatingNudge } from "@/components/rating-nudge";
import { LangSwitcher, useT } from "@/lib/locale";
import { TextSizeToggle } from "@/components/text-size";
import { ThemeToggle } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isAdminEmail } from "@/lib/admin-public";
import { getAdminSession } from "@/lib/admin";
import { useMoneyMode } from "@/lib/money-mode";
import { useAppsSummary } from "@/lib/apps-summary";

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useT();
  const { user } = useCurrentUserState();
  const [isAdmin, setIsAdmin] = useState(false);
  const { showPro } = useMoneyMode();
  const { badge } = useAppsSummary();

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    if (isAdminEmail(user.primaryEmail)) {
      setIsAdmin(true);
      return;
    }
    let cancelled = false;
    getAdminSession()
      .then((s) => {
        if (!cancelled) setIsAdmin(s.admin);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const nav = [
    { id: "jobs", to: "/" as const, hash: "joburi" as string | undefined, search: undefined as { tab: "saved" } | undefined, label: t("nav.jobs") },
    { id: "angajare", to: "/angajare" as const, hash: undefined, search: undefined, label: t("nav.angajare") },
    { id: "post", to: "/post" as const, hash: undefined, search: undefined, label: t("nav.post") },
    { id: "apps", to: "/aplicatii" as const, hash: undefined, search: undefined, label: t("nav.apps") },
    { id: "account", to: "/cont" as const, hash: undefined, search: undefined, label: t("nav.account") },
  ];

  function isActive(item: (typeof nav)[number]) {
    if (item.id === "account") return pathname === "/cont";
    if (item.id === "angajare") return pathname === "/angajare";
    if (item.to === "/") return pathname === "/";
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  }

  return (
    <header className="sticky top-0 z-40 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
      <div className="mx-auto flex max-w-6xl items-center gap-2 rounded-[28px] px-2.5 py-1.5 glass-strong sm:gap-3 sm:px-4 sm:py-2">
        <Logo size="md" priority />
        <nav className="ml-2 hidden items-center gap-1 lg:flex">
          {nav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.id}
                to={item.to}
                hash={item.hash}
                search={item.search}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-150",
                  active ? "bg-brand text-white" : "text-navy/75 hover:bg-navy/8 hover:text-navy",
                )}
              >
                {item.label}
                {item.id === "apps" && badge > 0 ? <NavBadge n={badge} /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {isAdmin ? (
            <Link
              to="/admin"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-orange/15 px-3 text-sm font-semibold text-orange-deep hover:bg-orange/25"
            >
              <Shield className="size-3.5" />
              {t("nav.admin")}
            </Link>
          ) : showPro ? (
            <Link
              to="/pro"
              data-testid="nav-pro"
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-orange-deep hover:bg-orange/15"
            >
              <Crown className="size-3.5" />
              {t("pro.nav")}
            </Link>
          ) : null}
          <LangSwitcher compact />
          <ThemeToggle />
          <TextSizeToggle />
          <RatingNudge />
          <AuthSlot />
        </div>
        <div className="ml-auto flex items-center gap-0.5 lg:hidden">
          <LangSwitcher compact cycle />
          <ThemeToggle compact />
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-navy"
            aria-label={open ? "Close" : "Menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="mx-auto mt-2 max-w-6xl rounded-[24px] p-3 glass-strong lg:hidden">
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                hash={item.hash}
                search={item.search}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-base font-medium text-navy hover:bg-navy/6"
              >
                {item.label}
                {item.id === "apps" && badge > 0 ? <NavBadge n={badge} /> : null}
              </Link>
            ))}
            {isAdmin ? (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold text-orange-deep hover:bg-orange/10"
              >
                <Shield className="size-4" />
                {t("nav.admin")}
              </Link>
            ) : showPro ? (
              <Link
                to="/pro"
                data-testid="nav-pro-mobile"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold text-orange-deep hover:bg-orange/10"
              >
                <Crown className="size-4" />
                {t("pro.nav")}
              </Link>
            ) : null}
          </nav>
          <div className="mt-2 border-t border-navy/10 px-2 py-3">
            <div className="-mx-2 mb-2">
              <TextSizeToggle variant="row" />
            </div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <LangSwitcher />
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <RatingNudge />
              </div>
            </div>
            <AuthSlot />
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function NavBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      data-testid="apps-badge"
      className={cn(
        "ml-1.5 inline-grid min-w-5 place-items-center rounded-full bg-orange px-1.5 text-[11px] leading-5 font-bold text-white tabular-nums",
        className,
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}
