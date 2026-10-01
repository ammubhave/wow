import {AlertDialog, Button} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";

import {workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledAlertDialog} from "./controlled-dialog";

export function DeletePuzzleDialog({
  workspaceSlug,
  puzzleId,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  puzzleId: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const mutation = useMutation(workspaceMutations.puzzles.delete());
  return (
    <ControlledAlertDialog isOpen={open} onOpenChange={setOpen} trigger={children}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[400px]">
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Are you absolutely sure?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>This action cannot be undone. This will permanently delete this puzzle.</p>
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
              Delete
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </ControlledAlertDialog>
  );
}
