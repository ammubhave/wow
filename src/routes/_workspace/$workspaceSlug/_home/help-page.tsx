import {createFileRoute} from "@tanstack/react-router";

import {HelpPage} from "@/components/help-page";
import {Page} from "@/components/page";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/help-page")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Help | WOW"}]}),
});

function RouteComponent() {
  return (
    <Page title="Help">
      <HelpPage />
    </Page>
  );
}
