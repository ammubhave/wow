import {useMutation} from "@tanstack/react-query";
import {toast} from "sonner";

import {orpc} from "@/lib/orpc";

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

export function DeletePuzzleDialog({
  puzzleId,
  children,
  open,
  setOpen,
}: {
  puzzleId: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const mutation = useMutation(orpc.puzzles.delete.mutationOptions());
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
                mutation.mutateAsync(puzzleId, {
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
