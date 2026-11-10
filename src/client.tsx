import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { loadLocale } from "@/lib/i18n";

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

const path = window.location.pathname;
if (path === "/ru" || path.startsWith("/ru/")) {
  loadLocale("ru").then(hydrate, hydrate);
} else {
  hydrate();
}
