import {Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {z} from "zod";

import {workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

export function EditRoundDialog({
  workspaceSlug,
  round,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  round: {id: string; name: string};
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const mutation = useMutation(workspaceMutations.rounds.update());
  const form = useAppForm({
    defaultValues: {name: round.name},
    onSubmit: ({value}) => {
      mutation.mutate({workspaceSlug, id: round.id, ...value});
      // Untouched again, the form follows `round` (now showing this edit) from here on.
      form.reset();
      setOpen(false);
    },
  });

  return (
    <ControlledModal
      isOpen={open}
      onOpenChange={isOpen => {
        // Discard unsaved edits when the dialog is dismissed.
        if (!isOpen) form.reset();
        setOpen(isOpen);
      }}
      trigger={children}>
      <Modal.Container>
        <Modal.Dialog aria-describedby={undefined}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Edit round</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form.AppForm>
              <form.Form>
                <form.AppField
                  name="name"
                  validators={{onSubmit: z.string().min(1)}}
                  children={field => (
                    <field.TextField
                      variant="secondary"
                      label="Name"
                      autoFocus
                      autoComplete="off"
                    />
                  )}
                />
              </form.Form>
            </form.AppForm>
          </Modal.Body>
          <Modal.Footer>
            <form.AppForm>
              <form.SubmitButton>Save</form.SubmitButton>
            </form.AppForm>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}
