import {Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";

import {useWorkspace} from "@/hooks/use-workspace";
import {workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";
import {PlacementOptions} from "./placement-options";

/**
 * Moves a puzzle to another meta or round. The same as Arrange's drag and drop, for phones (where
 * Arrange isn't offered) and for anyone who'd rather pick from a list.
 */
export function MovePuzzleDialog({
  workspaceSlug,
  puzzle,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  puzzle: {id: string; name: string; roundId: string; parentPuzzleId: string | null};
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const workspace = useWorkspace();
  const mutation = useMutation(workspaceMutations.puzzles.update());
  const form = useAppForm({
    defaultValues: {parentPuzzleId: puzzle.parentPuzzleId ?? puzzle.roundId},
    onSubmit: ({value}) => {
      mutation.mutate({workspaceSlug, id: puzzle.id, parentPuzzleId: value.parentPuzzleId});
      setOpen(false);
    },
  });
  return (
    <ControlledModal isOpen={open} onOpenChange={setOpen}>
      <Modal.Container size="sm">
        <Modal.Dialog aria-describedby={undefined}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Move {puzzle.name}</Modal.Heading>
          </Modal.Header>
          <form.AppForm>
            <Modal.Body>
              <form.Form>
                <form.AppField
                  name="parentPuzzleId"
                  children={field => (
                    <field.SelectField variant="secondary" label="Goes in">
                      <PlacementOptions rounds={workspace.rounds} excludeId={puzzle.id} />
                    </field.SelectField>
                  )}
                />
              </form.Form>
            </Modal.Body>
            <Modal.Footer>
              <form.SubmitButton>Move</form.SubmitButton>
            </Modal.Footer>
          </form.AppForm>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}
