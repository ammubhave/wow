import {toast} from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import {useWorkspace} from "./use-workspace";

export function DeleteRoundDialog({
  workspaceId,
  roundId,
  children,
  open,
  setOpen,
}: {
  workspaceId: string;
  roundId: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const workspace = useWorkspace({workspaceId});
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {children && <AlertDialogTrigger render={children} />}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this round.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={event => {
              toast.promise(
                workspace.rounds.delete.mutateAsync(roundId, {
                  onSuccess: () => {
                    setOpen(false);
                  },
                }),
                {
                  loading: "Deleting round...",
                  success: "Success! Round deleted.",
                  error: "Oops! Something went wrong.",
                }
              );
              event.preventDefault();
            }}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
