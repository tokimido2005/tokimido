import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BOOST_PACKAGES, activeBoostTier, purchaseBoost, type BoostTier } from "@/lib/boost";
import type { Job } from "@/lib/jobs";
import { useT } from "@/lib/locale";
import { cn, formatJobDate, formatJobTime, formatMdl } from "@/lib/utils";

function untilLabel(iso: string) {
  const date = formatJobDate(iso);
  const time = formatJobTime(iso);
  return time ? `${date}, ${time}` : date;
}

export function JobBoost({
  job,
  onApplied,
}: {
  job: Job;
  onApplied: (patch: { boost_tier: string; boost_until: string }) => void;
}) {
  const { t } = useT();
  const rootRef = useRef<HTMLElement>(null);
  const tierNow = activeBoostTier(job);
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<BoostTier>(tierNow ?? "standard");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#boost") return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const selected = BOOST_PACKAGES.find((pack) => pack.id === tier) ?? BOOST_PACKAGES[0];
  const until = job.boost_until ? untilLabel(job.boost_until) : "";

  async function pay() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await purchaseBoost({ data: { jobId: job.id, tier: selected.id } });
      onApplied({ boost_tier: res.tier, boost_until: res.until });
      setOpen(false);
      toast.success(t("boost.ok", { d: untilLabel(res.until) }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.updateFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      ref={rootRef}
      id="boost"
      data-testid="job-boost"
      className="mt-4 scroll-mt-24 rounded-[28px] p-5 glass sm:p-6"
    >
      <h2 className="text-lg font-semibold text-navy">{t("boost.title")}</h2>
      {tierNow && until ? (
        <p className="mt-1 text-sm font-medium text-orange-deep">{t("boost.active", { d: until })}</p>
      ) : (
        <p className="mt-1 text-sm leading-relaxed text-muted">{t("boost.lead")}</p>
      )}

      {!open ? (
        <button
          type="button"
          data-testid="boost-cta"
          onClick={() => {
            setTier(tierNow ?? "standard");
            setOpen(true);
          }}
          className="sheen mt-4 flex h-14 w-full items-center justify-center rounded-full px-5 text-center text-base font-semibold glass-orange"
        >
          {tierNow ? t("boost.change") : t("boost.cta")}
        </button>
      ) : (
        <div className="mt-4">
          {tierNow ? <p className="mb-3 text-sm leading-relaxed text-muted">{t("boost.replace")}</p> : null}
          <div className="grid gap-2.5">
            {BOOST_PACKAGES.map((pack) => {
              const on = pack.id === selected.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  aria-pressed={on}
                  data-testid={`boost-${pack.id}`}
                  onClick={() => setTier(pack.id)}
                  className={cn(
                    "rounded-[22px] p-4 text-left transition",
                    on ? "glass-strong ring-2 ring-orange" : "bg-white/40 ring-1 ring-navy/10 dark:bg-white/6",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-semibold text-navy">{t(`boost.${pack.id}`)}</span>
                    <span className="text-lg font-semibold tabular-nums text-orange-deep">{formatMdl(pack.price)}</span>
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-muted">{t(`boost.${pack.id}Body`)}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            data-testid="boost-pay"
            disabled={busy}
            onClick={() => void pay()}
            className="sheen mt-4 flex h-14 w-full items-center justify-center rounded-full text-base font-semibold glass-orange disabled:opacity-50"
          >
            {busy ? t("boost.paying") : t("boost.pay", { n: selected.price })}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 h-10 w-full text-sm font-medium text-muted"
          >
            {t("boost.close")}
          </button>
          <p className="mt-1 text-center text-xs leading-relaxed text-subtle">{t("pro.demo")}</p>
        </div>
      )}
    </section>
  );
}
