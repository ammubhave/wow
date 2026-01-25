import {useMutation} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowLeftIcon, ArrowRightIcon} from "lucide-react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {DiscordCardContents} from "@/components/discord-card-contents";
import {GoogleDriveCardContents} from "@/components/google-drive-contents";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {useWorkspace} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/_app/workspaces/create/$workspaceSlug")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Create Workspace | WOW"}]}),
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  const workspaceDeleteMutation = useMutation(orpc.workspaces.delete.mutationOptions());

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
            workspaceSlug={workspaceSlug!}
            redirectUrl={`/workspaces/create/${workspaceSlug}`}
          />
          <div className="border-t" />
          <DiscordCardContents
            workspaceSlug={workspaceSlug!}
            redirectUrl={`/workspaces/create/${workspaceSlug}`}
          />
          <CardContent className="flex items-center justify-between gap-4 border-t pt-6">
            <Button
              variant="ghost"
              onClick={() => {
                toast.promise(workspaceDeleteMutation.mutateAsync({workspaceSlug}), {
                  loading: "Deleting workspace...",
                  success: "Success! Your workspace has been deleted.",
                  error: "Oops! Something went wrong.",
                });
              }}>
              Delete workspace
            </Button>

            {!workspace.googleAccessToken && (
              <span className="text-muted-foreground text-xs">
                You must connect your Google Drive account first.
              </span>
            )}
            <Button
              className={cn(
                "gap-2",
                !workspace.googleAccessToken && "pointer-events-none opacity-50"
              )}
              render={
                <Link to="/$workspaceSlug" params={{workspaceSlug}}>
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
