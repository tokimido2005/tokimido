import { errorText } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { getMyReminder, setJobReminder } from "@/lib/reminders";
import { useT } from "@/lib/locale";

export function JobReminder({ jobId }: { jobId: number }) {
  const { t } = useT();
  const [setAt, setSetAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyReminder({ data: jobId })
      .then((row) => {
        if (!cancelled) setSetAt(row && !row.sent_at ? row.remind_at : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function setKind(kind: "1h" | "3h" | "morning") {
    setBusy(true);
    try {
      const res = await setJobReminder({ data: { jobId, kind } });
      setSetAt(res.remindAt);
      toast.success(t("remind.set"));
    } catch (err) {
      toast.error(errorText(err, t, t("remind.add")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-[24px] p-4 glass">
      <p className="flex items-center gap-2 text-sm font-semibold text-navy">
        <Bell className="size-4" />
        {t("remind.add")}
      </p>
      {setAt ? (
        <p className="mt-1 text-xs text-muted">{t("remind.set")}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {(["1h", "3h", "morning"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={busy}
            onClick={() => void setKind(kind)}
            className="h-10 rounded-full bg-white/55 px-3 text-sm font-medium text-navy ring-1 ring-navy/8 hover:bg-white/80 disabled:opacity-45 dark:bg-white/8"
          >
            {t(`remind.${kind}`)}
          </button>
        ))}
      </div>
    </section>
  );
}
