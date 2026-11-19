import {createFileRoute} from "@tanstack/react-router";

import {DocsShell} from "@/docs/components/docs-shell";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/help/")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Help | WOW"}]}),
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  return <DocsShell base={`/${workspaceSlug}/help`} slug="" />;
}
