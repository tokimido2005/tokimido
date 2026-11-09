import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, X } from "lucide-react";
import { markSelectedSeen, useAppsSummary } from "@/lib/apps-summary";
import { useT } from "@/lib/locale";

/** Green "You were selected" strip under the header until the user opens the job. */
export function SelectedBanner() {
  const { t } = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { unseen } = useAppsSummary();
  const first = unseen[0];
  const onItsPage = first ? pathname === `/jobs/${first.job_id}` : false;

  useEffect(() => {
    if (first && onItsPage) markSelectedSeen([first]);
  }, [first, onItsPage]);

  if (!first || onItsPage) return null;
  return (
    <div className="mx-auto mt-3 max-w-3xl px-4 sm:px-6" data-testid="selected-banner">
      <div className="flex items-center gap-3 rounded-[22px] bg-emerald-600 p-3 pl-4 text-white shadow-lg">
        <CheckCircle2 className="size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{t(first.status === "interview" ? "sel.bannerInterview" : "sel.bannerTitle")}</p>
          <p className="truncate text-sm text-white/90">{first.title}</p>
        </div>
        <Link
          to="/jobs/$id"
          params={{ id: String(first.job_id) }}
          onClick={() => markSelectedSeen([first])}
          className="inline-flex h-11 shrink-0 items-center rounded-full bg-white px-4 text-sm font-bold text-emerald-700"
        >
          {t("sel.seeDetails")}
        </Link>
        <button
          type="button"
          aria-label={t("sel.hide")}
          onClick={() => markSelectedSeen(unseen)}
          className="grid size-9 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/15"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
