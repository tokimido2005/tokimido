import * as Sentry from "@sentry/react";

const DSN =
  import.meta.env.VITE_SENTRY_DSN ||
  "https://2e01535733bcf23e77515b53816258e9804512351927633568.ingest.de.sentry.io/4512351942279248";

if (typeof window !== "undefined" && DSN) {
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
}

export { Sentry };
