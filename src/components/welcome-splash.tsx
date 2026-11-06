import { useCallback, useEffect, useRef, useState } from "react";

// Must match the key in THEME_BOOT (__root.tsx), which decides before paint
// whether the splash plays (first visit of the session, home page only).
const KEY = "rabotaem-splash-v23";
const DURATION = 1200;

export function WelcomeSplash() {
  const [done, setDone] = useState(false);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable (private mode) — splash just shows again */
    }
    setDone(true);
  }, []);

  useEffect(() => {
    // THEME_BOOT already decided (and recorded in sessionStorage) whether
    // this load plays the splash.
    const play = (window as Window & { __RBT_SPLASH_PLAY?: boolean }).__RBT_SPLASH_PLAY;
    if (play === false || document.documentElement.classList.contains("rbt-splash-done")) {
      finish();
      return;
    }

    const t = window.setTimeout(finish, DURATION);
    return () => window.clearTimeout(t);
  }, [finish]);

  if (done) return null;

  return (
    <div
      className="splash-overlay pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center"
      data-splash
      style={{
        background: "#071422",
        animation: "splashBgFade 1.2s ease-in-out forwards",
      }}
    >
      <img
        src="/logo-splash-900.webp"
        alt=""
        className="w-[min(78vw,420px)]"
        style={{
          animation: "splashLogo 1.2s ease-in-out forwards",
        }}
        width={900}
        height={226}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
