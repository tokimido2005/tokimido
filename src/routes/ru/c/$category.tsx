import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead, loadCategory } from "@/components/pages/category-page";

export const Route = createFileRoute("/ru/c/$category")({
  loader: ({ params }) => loadCategory(params.category),
  head: ({ params }) => categoryHead(params.category, "ru"),
  component: RouteComponent,
});

function RouteComponent() {
  return <CategoryPage data={Route.useLoaderData()} />;
}
