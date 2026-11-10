import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getProfileGate } from "@/lib/profile";
import { seoHead } from "@/lib/seo";
import { Shell } from "@/components/shell";
import { Logo } from "@/components/logo";
import { PhoneVerifyChoice } from "@/components/phone-verify-choice";
import { askNotifications } from "@/components/notify-prompt";
import { safeNextPath } from "@/components/social-auth";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useT } from "@/lib/locale";

type Search = { next?: string };

export const Route = createFileRoute("/verify")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    next: safeNextPath(typeof s.next === "string" ? s.next : undefined),
  }),
  head: () => seoHead("Verificare telefon", "Verifică numărul din cont prin SMS ca să postezi și să aplici.", { noindex: true }),
  component: VerifyPhone,
});

function VerifyPhone() {
  const { t } = useT();
  const { next } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [gate, setGate] = useState<{ complete: boolean; verified: boolean; phone: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getProfileGate()
      .then((g) => {
        if (!cancelled) setGate({ complete: g.complete, verified: g.verified, phone: g.phone });
      })
      .catch(() => {
        if (!cancelled) setGate({ complete: false, verified: false, phone: "" });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dest = gate?.verified ? (next ?? "/") : null;
  useEffect(() => {
    if (dest) window.location.replace(dest);
  }, [dest]);

  if (isPending) {
    return (
      <Shell>
        <main className="mx-auto max-w-lg px-4 py-16">
          <div className="h-80 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (!gate || dest) {
    return (
      <Shell>
        <main className="mx-auto max-w-lg px-4 py-16">
          <div className="h-80 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }
  if (!gate.complete || !gate.phone) {
    return (
      <Shell>
        <main className="mx-auto max-w-lg px-4 py-16">
          <div className="rounded-[32px] p-6 text-center glass-strong">
            <h1 className="text-2xl font-semibold text-navy">{t("complete.title")}</h1>
            <p className="mt-2 text-sm text-muted">{t("complete.blurb")}</p>
            <Link
              to="/complete"
              search={{ next }}
              className="sheen mt-6 inline-flex h-12 items-center rounded-full px-5 text-sm font-semibold glass-orange"
            >
              {t("complete.cta")}
            </Link>
          </div>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="mx-auto flex max-w-lg flex-col px-4 py-12 pb-24 sm:px-6">
        <div className="rounded-[32px] p-6 glass-strong sm:p-8" data-testid="verify-screen">
          <Logo size="lg" priority />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-navy">{t("verify.title")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t("verify.blurb")}</p>
          <p className="mt-2 text-xs text-subtle">{t("verify.changeHint")}</p>
          <div className="mt-6">
            <PhoneVerifyChoice
              phone={gate.phone}
              onVerified={() => {
                askNotifications("signup");
                window.location.href = next ?? "/";
              }}
            />
          </div>
        </div>
        <Link to="/cont" className="mt-6 text-center text-sm text-muted hover:text-navy">
          {t("nav.account")}
        </Link>
      </main>
    </Shell>
  );
}
