import {createFileRoute} from "@tanstack/react-router";

import {DocsShell} from "@/docs/components/docs-shell";
import {findDoc} from "@/docs/registry";

export const Route = createFileRoute("/_public/docs/$")({
  component: RouteComponent,
  head: ({params}) => ({
    meta: [{title: `${findDoc(params._splat ?? "")?.title ?? "Not found"} | WOW Docs`}],
  }),
});

function RouteComponent() {
  const {_splat} = Route.useParams();
  return <DocsShell base="/docs" slug={_splat ?? ""} />;
}
