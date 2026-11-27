import {createFileRoute} from "@tanstack/react-router";

import {DocsSkeleton} from "@/components/page-skeletons";
import {DocsShell} from "@/docs/components/docs-shell";
import {findDoc, preloadDoc} from "@/docs/registry";

export const Route = createFileRoute("/_public/docs/$")({
  // The page's text loads with the route (and on link hover), so it opens whole.
  loader: async ({params}) => {
    const page = findDoc(params._splat ?? "");
    if (page) await preloadDoc(page.slug);
  },
  pendingComponent: DocsSkeleton,
  component: RouteComponent,
  head: ({params}) => ({
    meta: [{title: `${findDoc(params._splat ?? "")?.title ?? "Not found"} | WOW Docs`}],
  }),
});

function RouteComponent() {
  const {_splat} = Route.useParams();
  return <DocsShell base="/docs" slug={_splat ?? ""} />;
}
