import { ShieldCheck } from "lucide-react";
import { useT } from "@/lib/locale";
import { cn } from "@/lib/utils";

/** Green "De încredere" pill for posters with a proven track record. */
export function TrustedBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const { t } = useT();
  return (
    <span
      title={t("trust.trustedHint")}
      data-testid="trusted-badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-emerald-600 font-semibold text-white",
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
      )}
    >
      <ShieldCheck className={size === "md" ? "size-3.5" : "size-3"} />
      {t("trust.trusted")}
    </span>
  );
}
