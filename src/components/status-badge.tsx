import { jobStatusKey, jobStatusTone, type JobStatusFields } from "@/lib/job-status";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale";

export function StatusBadge({ job, className }: { job: JobStatusFields; className?: string }) {
  const { t } = useT();
  const key = jobStatusKey(job);
  const tone = jobStatusTone(key);
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        tone === "active" && "bg-brand text-white",
        tone === "almost" && "bg-orange/15 text-orange-deep",
        tone === "completed" && "bg-navy/10 text-muted",
        tone === "cancelled" && "bg-danger/12 text-danger",
        tone === "expired" && "bg-navy/12 text-muted ring-1 ring-navy/10",
        className,
      )}
    >
      {t(`status.${key}`)}
    </span>
  );
}
