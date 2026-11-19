import {createFileRoute} from "@tanstack/react-router";

import {DocsShell} from "@/docs/components/docs-shell";
import {findDoc} from "@/docs/registry";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/help/$")({
  component: RouteComponent,
  head: ({params}) => ({
    meta: [{title: `${findDoc(params._splat ?? "")?.title ?? "Not found"} | Help | WOW`}],
  }),
});

function RouteComponent() {
  const {workspaceSlug, _splat} = Route.useParams();
  return <DocsShell base={`/${workspaceSlug}/help`} slug={_splat ?? ""} />;
}
