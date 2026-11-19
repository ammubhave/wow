import {createFileRoute, redirect} from "@tanstack/react-router";

// The Help tab used to be a single page here; it's the docs now (./help). Old links still work.
export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/help-page")({
  beforeLoad: ({params}) => {
    throw redirect({to: "/$workspaceSlug/help", params: {workspaceSlug: params.workspaceSlug}});
  },
});
