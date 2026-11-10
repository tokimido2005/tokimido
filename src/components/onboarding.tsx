import { useEffect, useState } from "react";
import { useT } from "@/lib/locale";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const KEY = "rabotaem-onboarded";

export function Onboarding() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isPending || !user) return;
    try {
      if (window.localStorage.getItem(KEY) === "1") return;
    } catch {
      return;
    }
    setOpen(true);
  }, [user, isPending]);

  if (!open) return null;

  const steps = [
    { title: t("onboard.1t"), body: t("onboard.1") },
    { title: t("onboard.2t"), body: t("onboard.2") },
    { title: t("onboard.3t"), body: t("onboard.3") },
  ];
  const current = steps[step];

  function finish() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4">
      <div className="absolute inset-0 bg-navy-deep/50 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-[32px] p-6 glass-strong sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-orange-deep uppercase">
          {t("onboard.kicker")} · {step + 1}/3
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-navy">{current.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{current.body}</p>
        <div className="mt-5 flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={i === step ? "h-1.5 flex-1 rounded-full bg-orange" : "h-1.5 flex-1 rounded-full bg-navy/12"}
            />
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between gap-2">
          <button type="button" onClick={finish} className="h-11 rounded-full px-3 text-sm font-medium text-muted">
            {t("onboard.skip")}
          </button>
          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white"
            >
              {t("onboard.next")}
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              className="h-11 rounded-full px-5 text-sm font-semibold glass-orange"
            >
              {t("onboard.done")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
