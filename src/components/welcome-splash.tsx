import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "rabotaem-splash-v22";
const DURATION = 2200;

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
    try {
      if (window.sessionStorage.getItem(KEY) === "1") {
        finish();
        return;
      }
    } catch {
      /* storage unavailable (private mode) — splash just shows again */
    }

    const t = window.setTimeout(finish, DURATION);
    return () => window.clearTimeout(t);
  }, [finish]);

  if (done) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "#071422",
        animation: "splashBgFade 2.2s ease-in-out forwards",
      }}
    >
      <img
        src="/logo-splash.webp"
        alt=""
        className="w-[min(78vw,420px)]"
        style={{
          animation: "splashLogo 2.2s ease-in-out forwards",
        }}
        width={1600}
        height={402}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
