import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { loadLocale, loadRareRomanian } from "@/lib/i18n";

// Same as TanStack Start's default client entry, except that on /ru pages the
// Russian strings are loaded first: the server already rendered Russian, and
// hydrating with Romanian strings would flash the wrong language.
function hydrate() {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}

// Texts the page needs before it can hydrate without flashing raw keys.
const path = window.location.pathname;
const waits: Promise<unknown>[] = [];
if (path === "/ru" || path.startsWith("/ru/")) waits.push(loadLocale("ru"));
if (/^\/(admin|confidentialitate)(\/|$)/.test(path)) waits.push(loadRareRomanian());
if (waits.length) Promise.all(waits).then(hydrate, hydrate);
else hydrate();
