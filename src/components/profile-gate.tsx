import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { getProfileGate } from "@/lib/profile";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/lib/locale";

const ALLOWED = ["/complete", "/verify", "/login", "/termeni", "/disclaimer", "/confidentialitate"];

export function ProfileGate({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useT();
  const [gate, setGate] = useState<{ complete: boolean; verified: boolean } | null>(null);

  useEffect(() => {
    if (isPending || !user) {
      setGate(null);
      return;
    }
    let cancelled = false;
    getProfileGate()
      .then((g) => {
        if (!cancelled) setGate({ complete: g.complete, verified: g.verified });
      })
      .catch(() => {
        if (!cancelled) setGate({ complete: false, verified: false });
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending, pathname]);

  useEffect(() => {
    if (!user || !gate) return;
    if (ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    if (!gate.complete) {
      window.location.replace(`/complete?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, gate, pathname]);

  const showBanner = Boolean(user && gate && !gate.verified && !ALLOWED.includes(pathname));

  return (
    <>
      {showBanner ? (
        <div className="sticky top-0 z-50 bg-orange/95 px-4 py-2.5 text-center text-sm font-medium text-white">
          {t("sms.need")}{" "}
          <a href="/verify" className="underline underline-offset-2">
            {t("sms.verify")}
          </a>
        </div>
      ) : null}
      {children}
    </>
  );
}
