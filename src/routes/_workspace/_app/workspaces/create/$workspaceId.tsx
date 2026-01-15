import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowLeftIcon, ArrowRightIcon} from "lucide-react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {DiscordCardContents} from "@/components/discord-card-contents";
import {GoogleDriveCardContents} from "@/components/google-drive-contents";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {useWorkspace} from "@/components/use-workspace";

export const Route = createFileRoute("/_workspace/_app/workspaces/create/$workspaceId")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Create Workspace | WOW"}]}),
});

function RouteComponent() {
  const {workspaceId} = Route.useParams();
  const workspace = useWorkspace({workspaceId});

  return (
    <div className="flex justify-center w-full">
      <div className="max-w-3xl flex-1 flex flex-col gap-2">
        <div>
          <Button
            variant="outline"
            size="sm"
            aria-label="Go Back"
            render={
              <Link to="/workspaces">
                <ArrowLeftIcon /> Back
              </Link>
            }
          />
        </div>
        <Card>
          <GoogleDriveCardContents
            workspaceId={workspaceId!}
            redirectUrl={`/workspaces/create/${workspaceId}`}
          />
          <div className="border-t" />
          <DiscordCardContents
            workspaceId={workspaceId!}
            redirectUrl={`/workspaces/create/${workspaceId}`}
          />
          <CardContent className="flex items-center justify-between gap-4 border-t pt-6">
            <Button
              variant="ghost"
              onClick={() => {
                toast.promise(workspace.delete.mutateAsync(workspaceId!), {
                  loading: "Deleting workspace...",
                  success: "Success! Your workspace has been deleted.",
                  error: "Oops! Something went wrong.",
                });
              }}>
              Delete workspace
            </Button>

            {workspace.get.data?.isOnboarding && (
              <span className="text-muted-foreground text-xs">
                You must connect your Google Drive account first.
              </span>
            )}
            <Button
              className={cn(
                "gap-2",
                (!workspace.get.data || workspace.get.data.isOnboarding) &&
                  "pointer-events-none opacity-50"
              )}
              render={
                <Link to="/$workspaceId" params={{workspaceId}}>
                  Go to blackboard
                  <ArrowRightIcon />
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
