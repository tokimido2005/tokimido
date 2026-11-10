import { useEffect, useState } from "react";
import { useT } from "@/lib/locale";
import { cn } from "@/lib/utils";

/** Same key the boot script in __root.tsx reads before the first paint. */
export const TEXT_SIZE_KEY = "rabotaem-text";

function readLarge() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("text-large");
}

function setLarge(on: boolean) {
  document.documentElement.classList.toggle("text-large", on);
  try {
    if (on) localStorage.setItem(TEXT_SIZE_KEY, "lg");
    else localStorage.removeItem(TEXT_SIZE_KEY);
  } catch {
    /* private mode: works until the tab closes */
  }
}

/**
 * "Text mare": makes the whole site ~15% bigger (text, buttons, fields) for
 * people who read with difficulty. Remembered on the device.
 */
export function TextSizeToggle({ variant = "compact" }: { variant?: "compact" | "row" }) {
  const { t } = useT();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(readLarge()), []);

  function toggle() {
    const next = !readLarge();
    setLarge(next);
    setOn(next);
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        data-testid="text-size-row"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-2 text-left text-base font-medium text-navy hover:bg-navy/6"
      >
        <span className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-navy/8 text-sm font-bold dark:bg-white/10">A+</span>
          {t("a11y.bigText")}
        </span>
        <span
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            on ? "bg-emerald-600" : "bg-navy/20 dark:bg-white/20",
          )}
          aria-hidden="true"
        >
          <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggle}
      aria-label={t("a11y.bigText")}
      title={t("a11y.bigText")}
      data-testid="text-size-btn"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors",
        on ? "bg-brand text-white" : "bg-navy/6 text-navy hover:bg-navy/10 dark:bg-white/8",
      )}
    >
      A+
    </button>
  );
}
