import {Button, buttonVariants, Card, Separator} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowRightIcon} from "lucide-react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {DiscordCardContents} from "@/components/discord-card-contents";
import {GoogleDriveCardContents} from "@/components/google-drive-contents";
import {Page, READING_WIDTH} from "@/components/page";
import {WorkspaceProvider} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";

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
  const navigate = Route.useNavigate();
  const workspaceDeleteMutation = useMutation(
    orpc.workspaces.delete.mutationOptions({
      // The workspace no longer exists, so don't leave the user on its setup page.
      onSuccess: () => navigate({to: "/workspaces"}),
    })
  );

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
          <Card.Footer className="justify-between gap-4">
            <Button
              variant="ghost"
              onPress={() => {
                toast.promise(workspaceDeleteMutation.mutateAsync({workspaceSlug}), {
                  loading: "Deleting workspace...",
                  success: "Success! Your workspace has been deleted.",
                  error: "Oops! Something went wrong.",
                });
              }}>
              Delete workspace
            </Button>

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
