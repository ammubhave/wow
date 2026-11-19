import {buttonVariants, Card, Separator} from "@heroui/react";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowRightIcon} from "lucide-react";
import {cn} from "tailwind-variants";

import {DiscordCardContents} from "@/components/discord-card-contents";
import {GoogleDriveCardContents} from "@/components/google-drive-contents";
import {Page, READING_WIDTH} from "@/components/page";
import {WorkspaceProvider} from "@/hooks/use-workspace";

export const Route = createFileRoute("/_workspace/_app/workspaces/create/$workspaceSlug")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Create Workspace | WOW"}]}),
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  return (
    <WorkspaceProvider workspaceSlug={workspaceSlug}>
      <RouteComponentInner />
    </WorkspaceProvider>
  );
}

function RouteComponentInner() {
  const {workspaceSlug} = Route.useParams();
  return (
    <Page title="Set up your workspace">
      <div className={cn(READING_WIDTH, "flex flex-col gap-4")}>
        <Card>
          <GoogleDriveCardContents
            workspaceSlug={workspaceSlug}
            redirectUrl={`/workspaces/create/${workspaceSlug}`}
          />
          <Separator />
          <DiscordCardContents
            workspaceSlug={workspaceSlug}
            redirectUrl={`/workspaces/create/${workspaceSlug}`}
          />
          <Separator />
          {/* No "Delete workspace" here: deleting workspaces isn't available yet (the server refuses). */}
          <Card.Footer className="justify-end gap-4">
            <Link
              to="/$workspaceSlug"
              params={{workspaceSlug}}
              className={buttonVariants({variant: "primary"})}>
              Go to blackboard
              <ArrowRightIcon />
            </Link>
          </Card.Footer>
        </Card>
      </div>
    </Page>
  );
}
