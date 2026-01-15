import {createFileRoute} from "@tanstack/react-router";

import {HelpPage} from "@/components/help-page";

export const Route = createFileRoute("/_workspace/$workspaceId/_home/help-page")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Help | WOW"}]}),
});

function RouteComponent() {
  return (
    <div className="p-8">
      <HelpPage />
    </div>
  );
}
