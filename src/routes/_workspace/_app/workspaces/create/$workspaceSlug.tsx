import {buttonVariants, Card, Separator} from "@heroui/react";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowRightIcon, MailIcon, PartyPopperIcon} from "lucide-react";
import {cn} from "tailwind-variants";

import {DiscordCardContents} from "@/components/discord-card-contents";
import {GoogleDriveCardContents} from "@/components/google-drive-contents";
import {Page, READING_WIDTH} from "@/components/page";
import {WorkspaceProvider} from "@/hooks/use-workspace";

export const Route = createFileRoute("/_workspace/_app/workspaces/create/$workspaceSlug")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Set up your workspace | WOW"}]}),
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
        {/* The workspace exists: the next steps come first, the optional extras after. */}
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <PartyPopperIcon className="text-accent size-4" aria-hidden="true" />
              Your workspace is ready
            </Card.Title>
            <Card.Description>
              Open the blackboard to add your first round (a short tour shows you around), and
              invite your team by email or with the link and password.
            </Card.Description>
          </Card.Header>
          <Card.Footer className="flex-wrap gap-3">
            <Link
              to="/$workspaceSlug"
              params={{workspaceSlug}}
              className={buttonVariants({variant: "primary"})}>
              Go to blackboard
              <ArrowRightIcon />
            </Link>
            <Link
              to="/$workspaceSlug/settings/members"
              params={{workspaceSlug}}
              className={buttonVariants({variant: "secondary"})}>
              <MailIcon />
              Invite your team
            </Link>
          </Card.Footer>
        </Card>
        <h2 className="text-muted mt-4 text-xs font-medium tracking-wide uppercase">
          Optional: connect your team's tools
        </h2>
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
          {/* No "Delete workspace" here: deleting workspaces isn't available yet (the server refuses). */}
        </Card>
      </div>
    </Page>
  );
}
