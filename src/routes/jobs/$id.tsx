import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/jobs/$id")({
  component: () => <Outlet />,
});
