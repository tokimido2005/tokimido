import { createFileRoute } from "@tanstack/react-router";
import { AngajarePage, angajareHead, loadAngajare } from "@/components/pages/angajare-page";

export const Route = createFileRoute("/angajare")({
  head: () => angajareHead("ro"),
  loader: () => loadAngajare(),
  component: RouteComponent,
});

function RouteComponent() {
  return <AngajarePage loaded={Route.useLoaderData()} />;
}
