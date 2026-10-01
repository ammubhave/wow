import {Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {z} from "zod";

import {newId, workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

export function AddNewRoundDialog({
  workspaceSlug,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const mutation = useMutation(workspaceMutations.rounds.create());
  const form = useAppForm({
    defaultValues: {name: ""},
    onSubmit: ({value}) => {
      mutation.mutate({...value, id: newId(), workspaceSlug});
      form.reset();
      setOpen(false);
    },
  });

  return (
    <ControlledModal isOpen={open} onOpenChange={setOpen} trigger={children}>
      <Modal.Container>
        <Modal.Dialog aria-describedby={undefined} className="sm:max-w-106.25">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Add new round</Modal.Heading>
          </Modal.Header>
          <form.AppForm>
            <Modal.Body>
              <form
                id={form.formId}
                onSubmit={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  void form.handleSubmit();
                }}>
                <div className="flex w-full flex-col gap-4">
                  <form.AppField
                    name="name"
                    validators={{onSubmit: z.string().min(1)}}
                    children={field => (
                      <field.TextField label="Name" autoFocus autoComplete="off" />
                    )}
                  />
                </div>
              </form>
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
