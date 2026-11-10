export type AnalyticsEvent =
  | "signup"
  | "login"
  | "job_post"
  | "job_apply"
  | "job_search"
  | "job_view"
  | "support_message"
  | "report_submit";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;
    gtag?: (...args: unknown[]) => void;
    rabotaemTrack?: (event: AnalyticsEvent, props?: Record<string, string | number | boolean>) => void;
  }
}

export function track(event: AnalyticsEvent, props: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...props, ts: Date.now() });
  window.plausible?.(event, { props });
  window.gtag?.("event", event, props);
  window.rabotaemTrack?.(event, props);
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Log a finished site search (for "what people look for" in admin stats).
 * Waits until typing stops so "m", "mu", "mut…" count once as "mutări".
 */
export function logSearch(q: string, kind: "rapid" | "oficial", results: number) {
  if (typeof window === "undefined") return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void import("@/components/page-tracker").then((m) => m.sendHit({ t: "search", q, kind, n: results }));
  }, 1500);
}
