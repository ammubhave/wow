import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

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
  workspaceId,
  puzzleId,
  children,
  open,
  setOpen,
}: {
  workspaceId: string;
  puzzleId: string;
  children?: React.ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const mutation = trpc.puzzles.delete.useMutation({
    onMutate: async (variables) => {
      setOpen(false);
      await utils.rounds.list.cancel({ workspaceId });
      const previousRounds = utils.rounds.list.getData({ workspaceId });
      const newRounds = previousRounds?.map((round) => ({
        ...round,
        puzzles: round.puzzles.filter((puzzle) => puzzle.id !== variables),
        unassignedPuzzles: round.unassignedPuzzles.filter(
          (puzzle) => puzzle.id !== variables,
        ),
        metaPuzzles: round.metaPuzzles.map((metaPuzzle) => ({
          ...metaPuzzle,
          childPuzzles: metaPuzzle.childPuzzles.filter(
            (puzzle) => puzzle.id !== variables,
          ),
        })),
      }));
      utils.rounds.list.setData({ workspaceId }, newRounds);
      return { previousRounds };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        utils.rounds.list.setData({ workspaceId }, context.previousRounds);
      }
    },
    onSettled: () => {
      utils.rounds.list.invalidate({ workspaceId });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this
            puzzle.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              toast.promise(mutation.mutateAsync(puzzleId), {
                loading: "Deleting puzzle...",
                success: "Success! Puzzle deleted.",
                error: "Oops! Something went wrong.",
              });
              event.preventDefault();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
