import { createFileRoute } from "@tanstack/react-router";
import { LandingPage, landingHead, loadLanding } from "@/components/pages/landing-page";

export const Route = createFileRoute("/lucru/$tema")({
  loader: ({ params }) => loadLanding(params.tema),
  head: ({ params }) => landingHead(params.tema, "ro"),
  component: RouteComponent,
});

function RouteComponent() {
  return <LandingPage data={Route.useLoaderData()} />;
}
