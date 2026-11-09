import { useEffect } from "react";
import { Briefcase, PlusCircle, UserRound, Wallet, Zap } from "lucide-react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useT } from "@/lib/locale";
import { cn } from "@/lib/utils";
import { useAppsSummary } from "@/lib/apps-summary";
import { NavBadge } from "@/components/header";

const PRELOAD_ROUTES = ["/", "/angajare", "/post", "/aplicatii", "/cont"] as const;

export function TabBar() {
  const { t } = useT();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { badge } = useAppsSummary();

  useEffect(() => {
    let interval = 0;
    let index = 0;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        const to = PRELOAD_ROUTES[index++];
        if (!to) {
          window.clearInterval(interval);
          return;
        }
        void router.preloadRoute({ to }).catch(() => {});
      }, 500);
    }, 1800);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [router]);

  if (
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/complete" ||
    pathname === "/verify" ||
    pathname === "/reset" ||
    pathname === "/pro" ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }
  const items = [
    { id: "jobs", to: "/" as const, hash: "joburi" as string | undefined, icon: Zap, label: t("nav.tabRapid") },
    { id: "angajare", to: "/angajare" as const, hash: undefined, icon: Briefcase, label: t("nav.tabOficial") },
    { id: "post", to: "/post" as const, hash: undefined, icon: PlusCircle, label: t("nav.tabPost") },
    { id: "apps", to: "/aplicatii" as const, hash: undefined, icon: Wallet, label: t("nav.tabApps") },
    { id: "account", to: "/cont" as const, hash: undefined, icon: UserRound, label: t("nav.tabAccount") },
  ];
  return (
    <nav className="tab-bar lg:hidden" aria-label={t("nav.jobs")} data-testid="tab-bar">
      {items.map((item) => {
        const active =
          item.id === "jobs"
            ? pathname === "/"
            : item.id === "angajare"
              ? pathname === "/angajare"
              : pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.id}
            to={item.to}
            hash={item.hash}
            aria-current={active ? "page" : undefined}
            className={cn("tab-bar-item", active && "tab-bar-item-active")}
          >
            <div className="relative">
              <item.icon className="tab-bar-icon" strokeWidth={active ? 2.4 : 1.8} />
              {item.id === "apps" && badge > 0 ? (
                <NavBadge n={badge} className="absolute -top-1.5 -right-3 ml-0" />
              ) : null}
            </div>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
