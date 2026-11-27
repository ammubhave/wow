import {ListBox, Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";

import {IconTooltip} from "@/components/icon-button";
import {useWorkspace} from "@/hooks/use-workspace";
import {workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

export function AssignUnassignedPuzzlesDialog({
  workspaceSlug,
  roundId,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  roundId: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const workspace = useWorkspace();
  const metas = workspace.rounds.find(round => round.id === roundId)?.metaPuzzles ?? [];
  const mutation = useMutation(workspaceMutations.rounds.assignUnassignedPuzzles());
  const form = useAppForm({
    defaultValues: {parentPuzzleId: metas[0]?.id ?? ""},
    onSubmit: ({value}) => {
      mutation.mutate({...value, workspaceSlug});
      form.reset();
      setOpen(false);
    },
  });

  return (
    <ControlledModal isOpen={open} onOpenChange={setOpen} trigger={children}>
      <Modal.Container>
        <Modal.Dialog aria-describedby={undefined}>
          <IconTooltip label="Close">
            <Modal.CloseTrigger />
          </IconTooltip>
          <Modal.Header>
            <Modal.Heading>Assign unassigned puzzles</Modal.Heading>
          </Modal.Header>
          <form.AppForm>
            <Modal.Body>
              <form.Form>
                {metas.length === 0 ? (
                  <p className="text-muted text-sm">
                    This round has no metas yet. Add a meta first, then assign these puzzles to it.
                  </p>
                ) : (
                  <form.AppField
                    name="parentPuzzleId"
                    children={field => (
                      <field.SelectField variant="secondary" label="Make them all feed">
                        {metas.map(meta => (
                          <ListBox.Item key={meta.id} id={meta.id} textValue={meta.name}>
                            {meta.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </field.SelectField>
                    )}
                  />
                )}
              </form.Form>
            </Modal.Body>
            <Modal.Footer>
              {metas.length > 0 && <form.SubmitButton>Assign</form.SubmitButton>}
            </Modal.Footer>
          </form.AppForm>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}
