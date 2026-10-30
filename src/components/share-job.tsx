import { useEffect, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/locale";

export function ShareJob({ title }: { title: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  const text = `${title} — Rabotaem.md`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url || window.location.href);
      toast.success(t("job.copied"));
      setOpen(false);
    } catch {
      toast.error(t("job.copy"));
    }
  }

  async function nativeShare() {
    const shareUrl = url || window.location.href;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: text, url: shareUrl, text });
        setOpen(false);
        return;
      } catch {
        /* user cancelled or unsupported */
      }
    }
    setOpen((v) => !v);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void nativeShare()}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/70 dark:bg-white/10 px-3 text-sm font-medium text-navy ring-1 ring-navy/10"
      >
        <Share2 className="size-3.5" />
        {t("job.share")}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl p-2 glass-strong">
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center rounded-xl px-3 text-sm font-medium text-navy hover:bg-navy/6"
          >
            {t("job.whatsapp")}
          </a>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-navy hover:bg-navy/6"
          >
            <Copy className="size-3.5" />
            {t("job.copy")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
