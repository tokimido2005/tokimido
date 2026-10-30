import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { getMonetizationPublic, type MoneyMode, type MonetizationSettings } from "@/lib/monetization";

const EVENT = "rabotaem-money";
const STORAGE = "rabotaem-money-rev";

export function notifyMoneyChanged(next?: MonetizationSettings | null) {
  try {
    window.localStorage.setItem(STORAGE, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next ?? null }));
}

type MoneyCtx = {
  mode: MoneyMode | null;
  settings: MonetizationSettings | null;
  showPro: boolean;
  ready: boolean;
  refresh: () => void;
};

const MoneyContext = createContext<MoneyCtx>({
  mode: null,
  settings: null,
  showPro: false,
  ready: false,
  refresh: () => {},
});

export function MoneyModeProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [settings, setSettings] = useState<MonetizationSettings | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    getMonetizationPublic({ data: { t: Date.now() } })
      .then((row) => {
        setSettings(row);
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    function onChange(ev: Event) {
      const detail = (ev as CustomEvent<MonetizationSettings | null>).detail;
      if (detail && typeof detail === "object" && "mode" in detail) {
        setSettings(detail);
        setReady(true);
      }
      refresh();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    window.addEventListener("focus", onChange);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("focus", onChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    const mode = settings?.mode ?? "";
    document.documentElement.dataset.money = mode;
  }, [settings]);

  const value = useMemo<MoneyCtx>(() => {
    const mode = settings?.mode ?? null;
    return {
      mode,
      settings,
      showPro: false,
      ready,
      refresh,
    };
  }, [settings, ready, refresh]);

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoneyMode() {
  return useContext(MoneyContext);
}
