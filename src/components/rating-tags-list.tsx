import { useT } from "@/lib/locale";
import { cn } from "@/lib/utils";

/** Quick tags shown as small pills, e.g. on a review or a profile summary. */
export function RatingTagList({
  tags,
  counts,
  className,
}: {
  tags: Array<string | { tag: string; n: number; good: boolean }>;
  counts?: boolean;
  className?: string;
}) {
  const { t } = useT();
  if (tags.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((item) => {
        const tag = typeof item === "string" ? item : item.tag;
        const n = typeof item === "string" ? 0 : item.n;
        return (
          <li key={tag} className="rounded-full bg-navy/6 px-2.5 py-1 text-[11px] font-medium text-navy">
            {t(`rtag.${tag}`)}
            {counts && n > 0 ? <span className="ml-1 tabular-nums text-muted">×{n}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
