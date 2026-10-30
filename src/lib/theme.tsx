import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";
import { useT } from "@/lib/locale";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark";

const STORAGE_KEY = "rabotaem-theme";

export function themeFromDom(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(next: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", next === "dark");
  if (document.documentElement.classList.contains("rbt-splash")) {
    document.documentElement.style.colorScheme = "dark";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#071422");
    return;
  }
  document.documentElement.style.colorScheme = next;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", next === "dark" ? "#071422" : "#0B2548");
}

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const current = themeFromDom();
    setThemeState(current);
    if (!document.documentElement.classList.contains("rbt-splash")) {
      applyTheme(current);
    }
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggle: () => {
        const next: Theme = themeFromDom() === "dark" ? "light" : "dark";
        setTheme(next);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { setTheme } = useTheme();
  const { t } = useT();

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setTheme(themeFromDom() === "dark" ? "light" : "dark")}
        aria-label={t("theme.label")}
        title={t("theme.label")}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-navy/6 text-navy transition-colors duration-150 hover:bg-navy/10 dark:bg-white/8 dark:hover:bg-white/12"
      >
        <Sun className="hidden size-5 dark:block" />
        <Moon className="size-5 dark:hidden" />
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full bg-navy/6 p-0.5 dark:bg-white/8"
      role="group"
      aria-label={t("theme.label")}
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label={t("theme.toLight")}
        title={t("theme.toLight")}
        className="grid size-8 place-items-center rounded-full bg-brand text-white dark:bg-transparent dark:text-navy/70 dark:hover:bg-white/10"
      >
        <Sun className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label={t("theme.toDark")}
        title={t("theme.toDark")}
        className="grid size-8 place-items-center rounded-full text-navy/70 hover:bg-white/50 dark:bg-brand dark:text-white dark:hover:bg-brand"
      >
        <Moon className="size-3.5" />
      </button>
    </div>
  );
}

export function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-center"
      toastOptions={{
        className: "glass-strong !text-navy !border-0",
      }}
    />
  );
}
