import { useState } from "react";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { useT } from "@/lib/locale";

/** Safe in-app path, or undefined. Rejects protocol-relative / open redirects. */
export function safeNextPath(next?: string) {
  if (!next) return undefined;
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  if (next.startsWith("/complete") || next.startsWith("/login") || next.startsWith("/auth/") || next.startsWith("/reset") || next.startsWith("/verify")) {
    return undefined;
  }
  return next;
}

/** After Google/X, land on /complete so phone + disclaimer can be collected. */
export function oauthFinishUrl(next?: string) {
  const safe = safeNextPath(next);
  return safe ? `/complete?next=${encodeURIComponent(safe)}` : "/complete";
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.42 2.21-1.18 3.05-.79.89-2.1 1.58-3.36 1.48-.14-1.1.4-2.25 1.16-3.1.8-.9 2.2-1.56 3.38-1.43zM20.48 17.22c-.57 1.32-.84 1.9-1.57 3.07-1.02 1.61-2.46 3.62-4.25 3.64-1.58.02-1.99-1.03-4.15-1.02-2.17.01-2.61 1.05-4.2 1.03-1.78-.03-3.14-1.83-4.16-3.44-2.85-4.5-3.15-9.78-1.39-12.59 1.24-1.98 3.2-3.14 5.05-3.14 1.88 0 3.06 1.03 4.62 1.03 1.52 0 2.45-1.04 4.63-1.04 1.65 0 3.4.9 4.63 2.45-4.07 2.23-3.41 8.04.79 9.01z"
      />
    </svg>
  );
}

export function SocialAuthButtons({ next, locked = false }: { next?: string; locked?: boolean }) {
  const { t } = useT();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!authEnabled) return null;

  const callbackURL = oauthFinishUrl(next);

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={`${t("login.continueApple")} — ${t("login.comingSoon")}`}
        className="btn-apple btn-apple-disabled"
      >
        <AppleMark />
        <span>{t("login.continueApple")}</span>
        <span className="btn-apple-soon">{t("login.comingSoon")}</span>
      </button>
      {GROK_PROVIDERS.map((p) => {
        // Use direct Google social provider instead of Grok broker for Google.
        const effectiveId = p.providerId === "grok-google" ? "google" : p.providerId;
        return (
          <button
            key={p.providerId}
            type="button"
            disabled={busyId !== null || locked}
            onClick={() => {
              setError(null);
              setBusyId(p.providerId);
              void signIn(effectiveId, {
                callbackURL,
                errorCallbackURL: "/login",
              }).catch((err: unknown) => {
                setBusyId(null);
                setError(err instanceof Error ? err.message : t("login.submitIn"));
              });
            }}
            className="sheen flex h-12 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t("login.continueWith", { p: p.label })}
          </button>
        );
      })}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
