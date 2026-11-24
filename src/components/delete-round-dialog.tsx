import {AlertDialog, Button} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";

import {workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledAlertDialog} from "./controlled-dialog";

export function DeleteRoundDialog({
  workspaceSlug,
  roundId,
  roundName,
  puzzleCount,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  roundId: string;
  roundName: string;
  puzzleCount: number;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const mutation = useMutation(workspaceMutations.rounds.delete());
  return (
    <ControlledAlertDialog isOpen={open} onOpenChange={setOpen} trigger={children}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Delete {roundName}?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>
              {puzzleCount === 0
                ? "This can't be undone."
                : `Its ${puzzleCount === 1 ? "puzzle disappears" : `${puzzleCount} puzzles disappear`} from the board too. This can't be undone.`}
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                mutation.mutate({workspaceSlug, id: roundId});
                setOpen(false);
              }}>
              Delete round
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </ControlledAlertDialog>
  );
}
