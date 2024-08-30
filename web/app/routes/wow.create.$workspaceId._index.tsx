import { ArrowLongRightIcon } from "@heroicons/react/24/solid";
import { Link, useNavigate, useParams } from "@remix-run/react";
import { toast } from "sonner";

import { DiscordCardContents } from "@/components/discord-card-contents";
import { GoogleDriveCardContents } from "@/components/google-drive-contents";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

import { TopNav } from "./wow.create._index";

export default function Page() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const workspace = trpc.workspaces.get.useQuery(workspaceId!);

  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const mutation = trpc.workspaces.delete.useMutation({
    onSuccess: () => {
      utils.invalidate();
      navigate("/wow");
    },
  });

  return (
    <div className="flex justify-center">
      <div className="max-w-3xl flex-1">
        <Card>
          <TopNav
            steps={[
              { name: "Create workspace", status: "complete" } as const,
              { name: "Configure workspace", status: "current" } as const,
            ]}
          >
            <GoogleDriveCardContents
              workspaceId={workspaceId!}
              redirectUrl={`/wow/create/${workspaceId}`}
            />
            <div className="border-t" />
            <DiscordCardContents
              workspaceId={workspaceId!}
              redirectUrl={`/wow/create/${workspaceId}`}
            />
            <CardContent className="flex items-center justify-between gap-4 border-t pt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  toast.promise(mutation.mutateAsync(workspaceId!), {
                    loading: "Deleting workspace...",
                    success: "Success! Your workspace has been deleted.",
                    error: "Oops! Something went wrong.",
                  });
                }}
              >
                Delete workspace
              </Button>

              {workspace.data?.isOnboarding && (
                <span className="text-muted-foreground text-sm">
                  You must connect your Google Drive account first.
                </span>
              )}
              <Button
                asChild
                className={cn(
                  "gap-2",
                  (!workspace.data || workspace.data.isOnboarding) &&
                    "pointer-events-none opacity-50",
                )}
              >
                <Link to={`/wow/${workspaceId}`}>
                  Go to blackboard
                  <ArrowLongRightIcon className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </TopNav>
        </Card>
      </div>
    </div>
  );
}
