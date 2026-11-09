import { useCallback, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { RateForm } from "@/components/rate-form";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/lib/locale";
import { listRatingPrompts, RATINGS_CHANGED_EVENT, snoozeRating, type PendingRating } from "@/lib/ratings";

/** Pages where a pop-up would get in the way of finishing a flow. */
const QUIET_PATHS = ["/login", "/complete", "/verify", "/reset", "/admin", "/post"];

function whenLabel(endedAt: string | null, t: (k: string, v?: Record<string, string | number>) => string) {
  if (!endedAt) return "";
  const days = Math.floor((Date.now() - new Date(endedAt).getTime()) / 86_400_000);
  if (days <= 0) return t("review.whenToday");
  if (days === 1) return t("review.whenYesterday");
  return t("review.whenDaysAgo", { n: days });
}

/**
 * After a job ends, ask each side to rate the other in a dialog over the
 * page — one person at a time. "Mai târziu" hides it for 24 hours.
 */
export function RatingPrompt() {
  const { t } = useT();
  const { user } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [queue, setQueue] = useState<PendingRating[]>([]);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const load = useCallback(() => {
    if (!user) {
      setQueue([]);
      return;
    }
    listRatingPrompts()
      .then(setQueue)
      .catch(() => setQueue([]));
  }, [user]);

  useEffect(() => {
    load();
    window.addEventListener(RATINGS_CHANGED_EVENT, load);
    return () => window.removeEventListener(RATINGS_CHANGED_EVENT, load);
  }, [load]);

  // Open a moment after the page settles, and never on top of another dialog.
  useEffect(() => {
    if (quiet || queue.length === 0) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if (document.querySelector('[role="dialog"]:not([data-rating-prompt])')) return;
      setOpen(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [quiet, queue.length, pathname]);

  const current = queue[0];

  const later = useCallback(() => {
    if (!current) return;
    setOpen(false);
    setQueue((q) => q.slice(1));
    void snoozeRating({ data: { jobId: current.jobId, toUserId: current.otherUserId } }).catch(() => {});
  }, [current]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") later();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, later]);

  if (!open || !current || quiet) return null;

  const initials = current.otherName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const title =
    current.otherRole === "poster"
      ? t("review.promptPoster", { n: current.otherName })
      : t("review.promptWorker", { n: current.otherName });
  const meta = [current.jobTitle, whenLabel(current.endedAt, t), current.locality].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0 bg-navy-deep/45 backdrop-blur-sm" onClick={later} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-prompt-title"
        data-rating-prompt
        data-testid="rating-prompt"
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] glass-strong sm:max-w-md sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-orange/15 text-sm font-semibold text-orange-deep">
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <h2 id="rating-prompt-title" className="text-base font-semibold tracking-tight text-navy">
                {title}
              </h2>
              <p className="truncate text-xs text-muted">{meta}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={later}
            aria-label={t("review.later")}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-navy/6"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3">
          <RateForm
            key={`${current.jobId}-${current.otherUserId}-${key}`}
            jobId={current.jobId}
            toUserId={current.otherUserId}
            otherName={current.otherName}
            otherRole={current.otherRole}
            variant="dialog"
            onDone={() => {
              window.setTimeout(() => {
                setOpen(false);
                setQueue((q) => q.slice(1));
                setKey((k) => k + 1);
              }, 900);
            }}
          />
        </div>

        <button
          type="button"
          onClick={later}
          data-testid="rating-later"
          className="mt-1 w-full py-1.5 text-center text-xs font-medium text-muted hover:text-navy"
        >
          {t("review.later")}
        </button>
        {queue.length > 1 ? (
          <p className="mt-1 text-center text-[11px] text-subtle">{t("review.moreQueued", { n: queue.length - 1 })}</p>
        ) : null}
      </div>
    </div>
  );
}
