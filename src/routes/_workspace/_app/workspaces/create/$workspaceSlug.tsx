import {Button, buttonVariants, Card, Separator} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowLeftIcon, ArrowRightIcon} from "lucide-react";
import {toast} from "sonner";

import {DiscordCardContents} from "@/components/discord-card-contents";
import {GoogleDriveCardContents} from "@/components/google-drive-contents";
import {useWorkspace, WorkspaceProvider} from "@/hooks/use-workspace";
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
  const workspace = useWorkspace();
  const navigate = Route.useNavigate();
  const workspaceDeleteMutation = useMutation(
    orpc.workspaces.delete.mutationOptions({
      // The workspace no longer exists, so don't leave the user on its setup page.
      onSuccess: () => navigate({to: "/workspaces"}),
    })
  );

  return (
    <div className="flex w-full justify-center">
      <div className="flex max-w-3xl flex-1 flex-col gap-4">
        <div>
          <Link to="/workspaces" className={buttonVariants({variant: "ghost", size: "sm"})}>
            <ArrowLeftIcon /> Back
          </Link>
        </div>
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

            {!workspace.googleConnected && (
              <span className="text-muted text-xs">
                You must connect your Google Drive account first.
              </span>
            )}
            <Link
              to="/$workspaceSlug"
              params={{workspaceSlug}}
              disabled={!workspace.googleConnected}
              className={buttonVariants({variant: "primary"})}>
              Go to blackboard
              <ArrowRightIcon />
            </Link>
          </Card.Footer>
        </Card>
      </div>
    </div>
  );
}
