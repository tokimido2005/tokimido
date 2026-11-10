import { Link } from "@tanstack/react-router";
import { Briefcase, Zap } from "lucide-react";
import { useT } from "@/lib/locale";
import { cn } from "@/lib/utils";
import type { JobKind } from "@/lib/job-kinds";

export function WorkKindTabs({ active }: { active: JobKind }) {
  const { t, locale } = useT();
  const ru = locale === "ru";
  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-[24px] p-1.5 glass"
      role="tablist"
      aria-label={t("kind.pick")}
      data-testid="work-kind-tabs"
    >
      <Link
        to={ru ? "/ru" : "/"}
        hash="joburi"
        role="tab"
        aria-selected={active === "rapid"}
        data-testid="work-tab-rapid"
        className={cn(
          "inline-flex h-12 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors",
          active === "rapid" ? "glass-orange text-white" : "text-navy hover:bg-navy/6",
        )}
      >
        <Zap className="size-4" />
        {t("kind.tabRapid")}
      </Link>
      <Link
        to={ru ? "/ru/angajare" : "/angajare"}
        role="tab"
        aria-selected={active === "oficial"}
        data-testid="work-tab-oficial"
        className={cn(
          "inline-flex h-12 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors",
          active === "oficial" ? "glass-navy text-white" : "text-navy hover:bg-navy/6",
        )}
      >
        <Briefcase className="size-4" />
        {t("kind.tabOficial")}
      </Link>
    </div>
  );
}
