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

export function DeleteRoundDialog({
  roundId,
  children,
  open,
  setOpen,
}: {
  roundId: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const mutation = useMutation(orpc.rounds.delete.mutationOptions());
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
                mutation.mutateAsync(roundId, {
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
