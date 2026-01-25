import {useMutation} from "@tanstack/react-query";
import {useState} from "react";
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

export function DisconnectDiscordDialog({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children?: React.ReactElement;
}) {
  const mutation = useMutation(orpc.workspaces.discord.disconnect.mutationOptions());
  const [open, setOpen] = useState<boolean>(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {children && <AlertDialogTrigger render={children} />}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will disconnect Discord from this workspace and
            delete all associated voice channels.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={event => {
              toast.promise(
                mutation.mutateAsync(
                  {workspaceSlug},
                  {
                    onSuccess: () => {
                      setOpen(false);
                    },
                  }
                ),
                {
                  loading: "Disconnecting Discord...",
                  success: "Discord was disconnected.",
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
