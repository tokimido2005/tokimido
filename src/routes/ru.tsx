import { createFileRoute, Outlet } from "@tanstack/react-router";
import { loadLocale } from "@/lib/i18n";

/**
 * Russian versions of the public pages (/ru, /ru/angajare, /ru/lucru/…,
 * /ru/c/…, /ru/r/…). The Russian strings load before the page renders, so
 * the server sends Google a fully Russian page.
 */
export const Route = createFileRoute("/ru")({
  beforeLoad: () => loadLocale("ru"),
  component: Outlet,
});
