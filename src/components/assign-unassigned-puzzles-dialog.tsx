import {ListBox, Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {toast} from "sonner";

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
  const mutation = useMutation(workspaceMutations.rounds.assignUnassignedPuzzles());
  const form = useAppForm({
    defaultValues: {parentPuzzleId: ""},
    onSubmit: ({value}) => {
      if (value.parentPuzzleId === "") {
        toast.info("No action taken -- please select a meta puzzle.");
        return;
      }
      mutation.mutate({...value, workspaceSlug});
      form.reset();
      setOpen(false);
    },
  });

  return (
    <ControlledModal isOpen={open} onOpenChange={setOpen} trigger={children}>
      <Modal.Container>
        <Modal.Dialog aria-describedby={undefined}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Assign unassigned puzzles</Modal.Heading>
          </Modal.Header>
          <form.AppForm>
            <Modal.Body>
              <form.Form>
                <form.AppField
                  name="parentPuzzleId"
                  children={field => {
                    const items = [
                      {value: "", label: "None"},
                      ...(workspace.rounds
                        .filter(round => round.id === roundId)
                        .flatMap(round => round.metaPuzzles)
                        .map(metaPuzzle => ({value: metaPuzzle.id, label: metaPuzzle.name})) ?? []),
                    ];
                    return (
                      <field.SelectField variant="secondary" label="Feeds Into" items={items}>
                        {items.map(item => (
                          <ListBox.Item key={item.value} id={item.value} textValue={item.label}>
                            {item.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </field.SelectField>
                    );
                  }}
                />
              </form.Form>
            </Modal.Body>
            <Modal.Footer>
              <form.SubmitButton>Save</form.SubmitButton>
            </Modal.Footer>
          </form.AppForm>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}
