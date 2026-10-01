import {AlertDialog, Button} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {useState} from "react";
import {toast} from "sonner";

import {orpc} from "@/lib/orpc";

import {ControlledAlertDialog} from "./controlled-dialog";

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
    <ControlledAlertDialog isOpen={open} onOpenChange={setOpen} trigger={children}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Are you absolutely sure?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>
              This action cannot be undone. This will disconnect Discord from this workspace and
              delete all associated voice channels.
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button
              variant="danger"
              isPending={mutation.isPending}
              onPress={() => {
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
              }}>
              Delete
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </ControlledAlertDialog>
  );
}
