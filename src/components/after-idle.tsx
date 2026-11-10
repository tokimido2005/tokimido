import { Suspense, useEffect, useState, type ReactNode } from "react";

/**
 * Renders its children only after the page has loaded and the browser is
 * idle. Used for things nobody needs in the first second (assistant bubble,
 * notification and review prompts, PWA install), so their code is downloaded
 * and run after the page is already usable. Renders nothing on the server.
 */
export function AfterIdle({ children, timeout = 2500 }: { children: ReactNode; timeout?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(t);
  }, [timeout]);
  return ready ? <Suspense fallback={null}>{children}</Suspense> : null;
}
