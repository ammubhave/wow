import {AlertDialog, Button} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";

import {workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledAlertDialog} from "./controlled-dialog";

export function DeletePuzzleDialog({
  workspaceSlug,
  puzzleId,
  puzzleName,
  isMetaPuzzle,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  puzzleId: string;
  puzzleName: string;
  isMetaPuzzle: boolean;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const mutation = useMutation(workspaceMutations.puzzles.delete());
  return (
    <ControlledAlertDialog isOpen={open} onOpenChange={setOpen} trigger={children}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Delete {puzzleName}?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>
              Its spreadsheet, whiteboard and chat are deleted for everyone. This can't be undone.
              {isMetaPuzzle && " Its feeders stay, as unassigned puzzles in the round."}
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                mutation.mutate({workspaceSlug, id: puzzleId});
                setOpen(false);
              }}>
              {isMetaPuzzle ? "Delete meta" : "Delete puzzle"}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </ControlledAlertDialog>
  );
}
