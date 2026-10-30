import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale";

export function formatAverage(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return value.toFixed(1).replace(".", ",");
}

export function formatReviewCount(count: number) {
  if (count <= 0) return "fără recenzii";
  if (count === 1) return "pe baza a 1 recenzie";
  return `pe baza a ${count} recenzii`;
}

export function Stars({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const px = size === "lg" ? "size-8" : size === "sm" ? "size-4" : "size-6";
  const interactive = Boolean(onChange);

  return (
    <div
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => setHover(0)}
      role={interactive ? "radiogroup" : "img"}
      aria-label={`${value} din 5 stele`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= shown;
        const star = (
          <Star
            className={cn(px, filled ? "fill-orange text-orange" : "text-navy/20")}
            strokeWidth={1.75}
          />
        );
        if (!interactive) return <span key={n}>{star}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "stea" : "stele"}`}
            className="rounded-md p-0.5 transition-transform duration-100 hover:scale-110"
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => onChange?.(n)}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

export function RatingBadge({
  average,
  count,
  className,
  compact = false,
}: {
  average: number;
  count: number;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useT();
  if (count <= 0) {
    return compact ? null : <span className={cn("text-xs text-subtle", className)}>{t("rating.none")}</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-semibold text-navy", className)}>
      <Star className="size-3.5 fill-orange text-orange" />
      <span className="tabular-nums">{formatAverage(average)}</span>
      {compact ? (
        <span className="font-medium text-muted">({count})</span>
      ) : (
        <span className="font-medium text-muted">
          · {count === 1 ? t("rating.basedOnOne") : t("rating.basedOn", { n: count })}
        </span>
      )}
    </span>
  );
}
