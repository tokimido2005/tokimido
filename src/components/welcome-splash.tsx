import { useCallback, useLayoutEffect, useRef, useState } from "react";

const KEY = "rabotaem-splash-v18";
const FAILSAFE_MS = 4000;
const TOTAL_MS = 2800;

declare global {
  interface Window {
    __RBT_SPLASH_PLAY?: boolean;
  }
}

function paintNavy() {
  const h = document.documentElement;
  h.classList.add("rbt-splash");
  h.classList.remove("rbt-splash-done", "is-reveal");
  h.style.backgroundColor = "#071422";
  h.style.colorScheme = "dark";
  if (document.body) document.body.style.backgroundColor = "#071422";
}

function restorePage() {
  const h = document.documentElement;
  h.classList.remove("rbt-splash", "is-reveal");
  h.classList.add("rbt-splash-done");
  const dark = h.classList.contains("dark");
  h.style.colorScheme = dark ? "dark" : "light";
  if (dark) {
    h.style.backgroundColor = "#071422";
    if (document.body) document.body.style.backgroundColor = "#071422";
  } else {
    h.style.backgroundColor = "#dce6f0";
    if (document.body) document.body.style.backgroundColor = "#dce6f0";
  }
}

export function WelcomeSplash() {
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    restorePage();
    setDone(true);
  }, []);

  useLayoutEffect(() => {
    if (window.__RBT_SPLASH_PLAY !== true) {
      restorePage();
      setDone(true);
      return;
    }

    paintNavy();
    document.documentElement.classList.add("is-reveal");

    const root = rootRef.current;
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName === "rbt-logo-io" || e.animationName === "rbt-logo-m") finish();
    };
    root?.addEventListener("animationend", onEnd);

    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    const fail = window.setTimeout(finish, FAILSAFE_MS);
    const hard = window.setTimeout(finish, mobile ? 1500 : TOTAL_MS + 80);

    return () => {
      root?.removeEventListener("animationend", onEnd);
      window.clearTimeout(fail);
      window.clearTimeout(hard);
    };
  }, [finish]);

  if (done) return null;

  return (
    <div ref={rootRef} className="splash" role="dialog" aria-label="Rabotaem.md">
      <div className="splash-veil" aria-hidden="true" />
      <img
        className="splash-logo"
        src="/logo-splash.webp"
        alt=""
        width={1600}
        height={402}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
