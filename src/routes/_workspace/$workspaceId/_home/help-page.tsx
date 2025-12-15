import {createFileRoute} from "@tanstack/react-router";

import {HelpPage} from "@/components/help-page";

export const Route = createFileRoute("/_workspace/$workspaceId/_home/help-page")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="p-8">
      <HelpPage />
    </div>
  );
}
