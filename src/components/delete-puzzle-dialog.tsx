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

export function DeletePuzzleDialog({
  workspaceId,
  puzzleId,
  children,
  open,
  setOpen,
}: {
  workspaceId: string;
  puzzleId: string;
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
            This action cannot be undone. This will permanently delete this puzzle.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={event => {
              toast.promise(
                workspace.puzzles.delete.mutateAsync(puzzleId, {
                  onSuccess: () => {
                    setOpen(false);
                  },
                }),
                {
                  loading: "Deleting puzzle...",
                  success: "Success! Puzzle deleted.",
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
