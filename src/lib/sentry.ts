import * as Sentry from "@sentry/react";

const DSN =
  import.meta.env.VITE_SENTRY_DSN ||
  "https://2d01535733bdf23e77919b53016250e9@o4512351927533568.ingest.de.sentry.io/4512351942279248";

let inited = false;

export function initSentry() {
  if (typeof window === "undefined") return;
  if (inited) return;
  if (!DSN) {
    console.warn("[sentry] no DSN");
    return;
  }
  try {
    Sentry.init({
      dsn: DSN,
      environment: import.meta.env.PROD ? "production" : "development",
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      ignoreErrors: [
        "ResizeObserver loop",
        "Non-Error promise rejection",
        "Failed to fetch",
        "Load failed",
        "NetworkError",
      ],
    });
    inited = true;
    (window as any).__RBT_SENTRY_READY = true;
  } catch (err) {
    console.error("[sentry] init failed", err);
  }
}

if (typeof window !== "undefined") {
  initSentry();
}

export { Sentry };
