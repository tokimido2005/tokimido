import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "rabotaem-splash-v19";
const DURATION = 1600;

export function WelcomeSplash() {
  const [done, setDone] = useState(false);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {}
    setDone(true);
  }, []);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(KEY) === "1") {
        finish();
        return;
      }
    } catch {}

    const t = window.setTimeout(finish, DURATION);
    return () => window.clearTimeout(t);
  }, [finish]);

  if (done) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#071422]">
      <img
        src="/logo-splash.webp"
        alt=""
        className="w-[min(78vw,420px)] opacity-0"
        style={{ animation: "fadeInOut 1.6s ease forwards" }}
        width={1600}
        height={402}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
