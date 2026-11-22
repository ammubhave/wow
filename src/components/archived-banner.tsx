import {Button} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {ArchiveIcon} from "lucide-react";
import {toast} from "sonner";

import {useWorkspace} from "@/hooks/use-workspace";
import {useIsWorkspaceOwner} from "@/hooks/use-workspace-role";
import {orpc} from "@/lib/orpc";

/** Under the header while the workspace is archived: it's read-only, and owners can bring it back. */
export function ArchivedBanner() {
  const {slug, archivedAt} = useWorkspace();
  const isOwner = useIsWorkspaceOwner();
  const unarchive = useMutation(orpc.workspaces.setArchived.mutationOptions());
  if (archivedAt === null) return null;
  return (
    <div
      role="status"
      className="bg-default text-muted flex items-center justify-center gap-3 px-4 py-1.5 text-xs">
      <ArchiveIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>This workspace is archived and read-only.</span>
      {isOwner && (
        <Button
          size="sm"
          variant="tertiary"
          className="h-6"
          isPending={unarchive.isPending}
          onPress={() =>
            unarchive.mutate(
              {workspaceSlug: slug, archived: false},
              {onError: () => toast.error("Couldn't unarchive it. Please try again.")}
            )
          }>
          Unarchive
        </Button>
      )}
    </div>
  );
}
