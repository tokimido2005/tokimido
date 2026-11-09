import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Building2, ChevronRight } from "lucide-react";
import { getCompanyForOwner } from "@/lib/companies";
import { useT } from "@/lib/locale";

type Card = { slug: string; name: string; logo: string | null; verified: boolean; city: string } | null;

/** Company line on an "angajare" listing: links to the company page when there is one. */
export function CompanyLink({ ownerId, fallbackName }: { ownerId: string; fallbackName: string }) {
  const { t } = useT();
  const [card, setCard] = useState<Card | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getCompanyForOwner({ data: { ownerId } })
      .then((c) => {
        if (!cancelled) setCard(c);
      })
      .catch(() => {
        if (!cancelled) setCard(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  if (!card) {
    return fallbackName ? (
      <p className="mt-3 flex items-center gap-1.5 text-muted">
        <Building2 className="size-4" />
        {fallbackName}
      </p>
    ) : null;
  }
  return (
    <Link
      to="/firma/$slug"
      params={{ slug: card.slug }}
      data-testid="job-company-link"
      className="mt-3 flex items-center gap-3 rounded-2xl bg-white/60 p-3 ring-1 ring-navy/10 hover:bg-white/90 dark:bg-white/8"
    >
      {card.logo ? (
        <img src={card.logo} alt="" className="size-12 shrink-0 rounded-xl bg-white object-contain p-1" />
      ) : (
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-navy/8 text-navy">
          <Building2 className="size-6" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-base font-semibold text-navy">
          {card.name}
          {card.verified ? <BadgeCheck className="size-4 text-emerald-600" aria-label={t("company.verified")} /> : null}
        </span>
        <span className="block text-sm text-[#1d6fd8]">{t("company.seePage")}</span>
      </span>
      <ChevronRight className="size-5 text-muted" />
    </Link>
  );
}
