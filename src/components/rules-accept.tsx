import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/locale";

export function RulesAccept({ accepted, onToggle }: { accepted: boolean; onToggle: () => void }) {
  const { t } = useT();
  return (
    <div className="rounded-[24px] bg-white/45 p-4 ring-1 ring-navy/8 dark:bg-white/8">
      <h2 className="text-sm font-semibold tracking-tight text-navy">{t("login.rulesTitle")}</h2>
      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs leading-relaxed text-muted">
        <p>{t("login.rulesIntro")}</p>
        <p>{t("login.rulesConfirm")}</p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>{t("login.rules1")}</li>
          <li>{t("login.rules2")}</li>
          <li>{t("login.rules3")}</li>
          <li>{t("login.rules4")}</li>
          <li>{t("login.rules5")}</li>
        </ul>
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={accepted}
        data-testid="rules-accept"
        onClick={onToggle}
        className="mt-4 flex w-full items-start gap-3 text-left"
      >
        <span
          className={
            accepted
              ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-orange text-white"
              : "mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-white/70 ring-1 ring-navy/20 dark:bg-white/10"
          }
        >
          {accepted ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
        <span className="text-sm leading-snug text-navy">{t("login.agree")}</span>
      </button>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        <Link to="/termeni" className="font-medium text-navy underline">
          {t("footer.terms")}
        </Link>
        {" · "}
        <Link to="/disclaimer" className="font-medium text-navy underline">
          {t("footer.disclaimer")}
        </Link>
        {" · "}
        <Link to="/confidentialitate" className="underline hover:text-navy">
          {t("footer.privacy")}
        </Link>
      </p>
    </div>
  );
}
