import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPendingMs: 2500,
    defaultPendingMinMs: 0,
    defaultStaleReloadMode: "background",
    scrollRestoration: true,
  });
}
