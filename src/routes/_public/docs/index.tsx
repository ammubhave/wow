import {createFileRoute} from "@tanstack/react-router";

import {DocsSkeleton} from "@/components/page-skeletons";
import {DocsShell} from "@/docs/components/docs-shell";
import {preloadDoc} from "@/docs/registry";

export const Route = createFileRoute("/_public/docs/")({
  // The page's text loads with the route (and on link hover), so it opens whole.
  loader: () => preloadDoc(""),
  pendingComponent: DocsSkeleton,
  component: () => <DocsShell base="/docs" slug="" />,
  head: () => ({meta: [{title: "Docs | WOW"}]}),
});
