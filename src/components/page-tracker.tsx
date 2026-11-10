import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

/** Fire-and-forget POST to the anonymous statistics endpoint. */
export function sendHit(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon?.("/api/hit", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/hit", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  } catch {
    /* statistics must never break the page */
  }
}

/**
 * Counts page views for the admin statistics. Anonymous: no cookies, no
 * personal data; the first view of a visit carries where it came from.
 */
export function PageTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const first = useRef(true);
  useEffect(() => {
    if (/bot|crawl|spider|headless|lighthouse/i.test(navigator.userAgent)) return;
    const isFirst = first.current;
    first.current = false;
    sendHit({
      t: "view",
      path: pathname,
      internal: !isFirst,
      ref: isFirst ? document.referrer : "",
      utm: isFirst ? new URLSearchParams(window.location.search).get("utm_source") ?? "" : "",
    });
  }, [pathname]);
  return null;
}
