import { useState } from "react";
import { toast } from "sonner";
import { birthYearRange } from "@/lib/age";
import { saveBirthYear } from "@/lib/profile";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";

/** Asks the year of birth once (needed for the 16+ / 18+ rules). Never shown publicly. */
export function BirthYearAsk({ onSaved }: { onSaved: (year: number) => void }) {
  const { t } = useT();
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { min, max } = birthYearRange();

  async function save() {
    const y = Number(year);
    if (!y || y < min || y > max) {
      setError(t("age.yearInvalid", { max }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveBirthYear({ data: { year: y } });
      toast.success(t("age.saved"));
      onSaved(y);
    } catch (err) {
      setError(errorText(err, t, t("error.update")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-navy/5 p-4" data-testid="birth-year-ask">
      <p className="text-base font-semibold text-navy">{t("age.askTitle")}</p>
      <p className="mt-1 text-sm text-muted">{t("age.askWhy")}</p>
      <div className="mt-3 flex gap-2">
        <input
          className="field text-base tabular-nums"
          inputMode="numeric"
          maxLength={4}
          placeholder="1990"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          aria-label={t("age.askTitle")}
          data-testid="birth-year-input"
        />
        <button
          type="button"
          disabled={busy || year.length !== 4}
          onClick={() => void save()}
          data-testid="birth-year-save"
          className="h-12 shrink-0 rounded-full bg-brand px-5 text-base font-semibold text-white disabled:opacity-50"
        >
          {t("age.save")}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
