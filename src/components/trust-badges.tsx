import { BadgeCheck, Briefcase, ShieldCheck, Star } from "lucide-react";
import { useT } from "@/lib/locale";

export type TrustFlags = {
  phoneVerified: boolean;
  profileComplete: boolean;
  tenJobs: boolean;
  highRating: boolean;
  trusted: boolean;
};

export function computeTrust(input: {
  phoneVerified: boolean;
  hasPhoto: boolean;
  bio: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  completedCount: number;
  average: number;
  ratingCount: number;
}): TrustFlags {
  const namesOk = (input.firstName?.trim().length ?? 0) >= 2 && (input.lastName?.trim().length ?? 0) >= 2;
  const phoneOk = (input.phone?.trim().length ?? 0) >= 8 || input.phoneVerified;
  return {
    phoneVerified: input.phoneVerified,
    profileComplete: Boolean(input.hasPhoto && input.bio.trim().length >= 12 && (namesOk || phoneOk)),
    tenJobs: input.completedCount >= 10,
    highRating: input.average >= 4.5 && input.ratingCount >= 3,
    trusted: input.phoneVerified && input.completedCount >= 3 && input.ratingCount >= 3 && input.average >= 4.5,
  };
}

export function TrustBadges({ flags }: { flags: TrustFlags }) {
  const { t } = useT();
  const items = [
    flags.trusted ? { icon: ShieldCheck, label: t("trust.trusted"), tone: "trusted" as const } : null,
    flags.phoneVerified ? { icon: ShieldCheck, label: t("trust.phone"), tone: "ok" as const } : null,
    flags.profileComplete ? { icon: BadgeCheck, label: t("trust.complete"), tone: "ok" as const } : null,
    flags.tenJobs ? { icon: Briefcase, label: t("trust.tenJobs"), tone: "ok" as const } : null,
    flags.highRating ? { icon: Star, label: t("trust.rating"), tone: "star" as const } : null,
  ].filter(Boolean) as Array<{ icon: typeof Star; label: string; tone: "ok" | "star" | "trusted" }>;
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item.label}
          className={
            item.tone === "trusted"
              ? "inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
              : item.tone === "star"
              ? "inline-flex items-center gap-1 rounded-full bg-orange/15 px-2.5 py-1 text-[11px] font-semibold text-orange-deep"
              : "inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-navy"
          }
        >
          <item.icon className="size-3" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
