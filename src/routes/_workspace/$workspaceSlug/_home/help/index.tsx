import {createFileRoute} from "@tanstack/react-router";

import {DocsSkeleton} from "@/components/page-skeletons";
import {DocsShell} from "@/docs/components/docs-shell";
import {preloadDoc} from "@/docs/registry";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/help/")({
  // The page's text loads with the route (and on link hover), so it opens whole.
  loader: () => preloadDoc(""),
  pendingComponent: DocsSkeleton,
  component: RouteComponent,
  head: () => ({meta: [{title: "Help | WOW"}]}),
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  return <DocsShell base={`/${workspaceSlug}/help`} slug="" />;
}
