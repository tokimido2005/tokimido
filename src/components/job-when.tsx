import { CalendarDays, Clock } from "lucide-react";
import { cn, formatJobDate, formatJobTime } from "@/lib/utils";
import { useT } from "@/lib/locale";

export function JobWhen({
  startsAt,
  variant = "card",
}: {
  startsAt: string | null | undefined;
  variant?: "card" | "detail" | "inline";
}) {
  const { t } = useT();
  if (!startsAt) return null;
  const date = formatJobDate(startsAt);
  const time = formatJobTime(startsAt);
  if (!date) return null;

  if (variant === "inline") {
    return (
      <span className="tabular-nums">
        {date} · {time}
      </span>
    );
  }

  if (variant === "detail") {
    return (
      <div className="mt-6 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-orange/12 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <CalendarDays className="size-3.5" />
            {t("job.date")}
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-navy">{date}</div>
        </div>
        <div className="rounded-2xl bg-orange/12 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <Clock className="size-3.5" />
            {t("job.time")}
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-navy">{time}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-orange/12 px-3 py-2.5",
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-navy">
        <CalendarDays className="size-3.5 shrink-0 text-orange-deep" />
        {date}
      </span>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-navy">
        <Clock className="size-3.5 shrink-0 text-orange-deep" />
        {time}
      </span>
    </div>
  );
}
