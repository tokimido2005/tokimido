import { createFileRoute } from "@tanstack/react-router";
import { HomePage, homeHead, loadHome } from "@/components/pages/home-page";

export const Route = createFileRoute("/")({
  head: () => homeHead("ro"),
  loader: () => loadHome(),
  component: RouteComponent,
});

function RouteComponent() {
  return <HomePage loaded={Route.useLoaderData()} />;
}
