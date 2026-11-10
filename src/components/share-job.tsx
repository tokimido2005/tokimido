import { useEffect, useRef, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/locale";
import type { Job } from "@/lib/jobs";
import { cn, formatJobDate, formatJobTime, formatMdl } from "@/lib/utils";

type Channel = "viber" | "telegram" | "whatsapp" | "facebook";
type ShareJobInfo = Pick<
  Job,
  "id" | "title" | "payment_mdl" | "locality" | "raion" | "starts_at" | "kind" | "company" | "details"
>;

const CHANNELS: Array<{ id: Channel; label: string; color: string }> = [
  { id: "viber", label: "Viber", color: "#7360f2" },
  { id: "telegram", label: "Telegram", color: "#229ed9" },
  { id: "whatsapp", label: "WhatsApp", color: "#1fa855" },
  { id: "facebook", label: "Facebook", color: "#1877f2" },
];

function jobUrl(id: number, source: string) {
  const origin = typeof window === "undefined" ? "https://rabotaem.md" : window.location.origin;
  return `${origin}/jobs/${id}?utm_source=${source}`;
}

/** Ready-made message: what, how much, where, when. */
export function useShareText(job: ShareJobInfo) {
  const { t } = useT();
  const place = [job.locality, job.raion].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
  if (job.kind === "oficial") {
    const salary =
      job.payment_mdl > 0
        ? `${formatMdl(job.payment_mdl)}${(job.details?.salary_max ?? 0) > job.payment_mdl ? ` – ${formatMdl(job.details!.salary_max)}` : ""}`
        : "";
    return `💼 ${[job.title, job.company, place, salary].filter(Boolean).join(" · ")}\n${t("share.applyHere")}:`;
  }
  const when = job.starts_at ? `${formatJobDate(job.starts_at)} ${formatJobTime(job.starts_at)}` : "";
  return `📌 ${[job.title, formatMdl(job.payment_mdl), place, when].filter(Boolean).join(" · ")}\n${t("share.applyHere")}:`;
}

function channelHref(channel: Channel, text: string, url: string) {
  const e = encodeURIComponent;
  switch (channel) {
    case "viber":
      return `viber://forward?text=${e(`${text} ${url}`)}`;
    case "telegram":
      return `https://t.me/share/url?url=${e(url)}&text=${e(text)}`;
    case "whatsapp":
      return `https://wa.me/?text=${e(`${text} ${url}`)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`;
  }
}

/** Big buttons: Viber, Telegram, WhatsApp, Facebook, copy link (and the phone's share sheet). */
export function ShareButtons({ job, onDone, large = false }: { job: ShareJobInfo; onDone?: () => void; large?: boolean }) {
  const { t } = useT();
  const text = useShareText(job);
  const [canNative, setCanNative] = useState(false);
  useEffect(() => setCanNative(typeof navigator !== "undefined" && "share" in navigator), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(jobUrl(job.id, "link"));
      toast.success(t("job.copied"));
      onDone?.();
    } catch {
      toast.error(t("job.copy"));
    }
  }

  async function native() {
    try {
      await navigator.share({ title: job.title, text, url: jobUrl(job.id, "share") });
      onDone?.();
    } catch {
      /* cancelled */
    }
  }

  const btn = cn(
    "flex items-center justify-center gap-2 rounded-full font-semibold text-white transition-transform active:scale-[0.97]",
    large ? "h-12 text-base" : "h-11 text-sm",
  );
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="share-buttons">
      {CHANNELS.map((c) => (
        <a
          key={c.id}
          href={channelHref(c.id, text, jobUrl(job.id, c.id))}
          target={c.id === "viber" ? undefined : "_blank"}
          rel="noreferrer"
          onClick={() => onDone?.()}
          className={btn}
          style={{ backgroundColor: c.color }}
          data-channel={c.id}
        >
          {c.label}
        </a>
      ))}
      <button
        type="button"
        onClick={() => void copy()}
        className={cn(btn, "bg-white/70 text-navy ring-1 ring-navy/10 dark:bg-white/10", !canNative && "col-span-2")}
      >
        <Copy className="size-4" />
        {t("job.copy")}
      </button>
      {canNative ? (
        <button
          type="button"
          onClick={() => void native()}
          className={cn(btn, "bg-white/70 text-navy ring-1 ring-navy/10 dark:bg-white/10")}
        >
          <Share2 className="size-4" />
          {t("share.more")}
        </button>
      ) : null}
    </div>
  );
}

/** "Distribuie" button on the job page with a dropdown of share buttons. */
export function ShareJob({ job }: { job: ShareJobInfo }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="share-open"
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/70 px-3 text-sm font-medium text-navy ring-1 ring-navy/10 dark:bg-white/10"
      >
        <Share2 className="size-3.5" />
        {t("job.share")}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[19rem] rounded-2xl p-3 glass-strong">
          <p className="mb-2 px-1 text-sm font-semibold text-navy">{t("share.title")}</p>
          <ShareButtons job={job} onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
