import { createFileRoute } from "@tanstack/react-router";
import { RaionPage, loadRaion, raionHead } from "@/components/pages/raion-page";

export const Route = createFileRoute("/ru/r/$raion")({
  loader: ({ params }) => loadRaion(params.raion),
  head: ({ params }) => raionHead(params.raion, "ru"),
  component: RouteComponent,
});

function RouteComponent() {
  return <RaionPage data={Route.useLoaderData()} />;
}
