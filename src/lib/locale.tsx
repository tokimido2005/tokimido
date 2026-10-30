import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LOCALES, translate, type Locale } from "@/lib/i18n";

const STORAGE_KEY = "rabotaem-lang";

function readLocale(): Locale {
  if (typeof window === "undefined") return "ro";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ro" || stored === "ru" || stored === "en") return stored;
  } catch {
    /* private mode */
  }
  return "ro";
}

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}>({
  locale: "ro",
  setLocale: () => {},
  t: (key, vars) => translate("ro", key, vars),
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ro");

  useEffect(() => {
    const next = readLocale();
    setLocaleState(next);
    document.documentElement.lang = next;
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = next;
  }

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useT() {
  return useContext(LocaleContext);
}

export function LangSwitcher({ compact = false, cycle = false }: { compact?: boolean; cycle?: boolean }) {
  const { locale, setLocale, t } = useT();
  if (cycle) {
    const idx = Math.max(0, LOCALES.findIndex((item) => item.id === locale));
    const current = LOCALES[idx] ?? LOCALES[0];
    const next = LOCALES[(idx + 1) % LOCALES.length];
    return (
      <button
        type="button"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-navy/6 text-xs font-semibold text-navy dark:bg-white/8"
        aria-label={`${t("lang.label")}: ${current.label}`}
        onClick={() => setLocale(next.id)}
      >
        {current.label}
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-navy/6 p-0.5 dark:bg-white/8" aria-label={t("lang.label")}>
      {LOCALES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setLocale(item.id)}
          className={
            locale === item.id
              ? "h-8 min-w-9 rounded-full bg-brand px-2 text-xs font-semibold text-white"
              : "h-8 min-w-9 rounded-full px-2 text-xs font-semibold text-navy/70 hover:bg-white/50 dark:hover:bg-white/10"
          }
        >
          {item.label}
        </button>
      ))}
      {compact ? null : <span className="sr-only">{t("lang.label")}</span>}
    </div>
  );
}
