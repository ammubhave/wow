import {Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {z} from "zod";

import {useWorkspace} from "@/hooks/use-workspace";
import {newId, workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

export function AddNewMetaPuzzleDialog({
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
  const mutation = useMutation(workspaceMutations.puzzles.create());
  const form = useAppForm({
    defaultValues: {name: "", assignUnassignedPuzzles: true, tags: [] as string[], link: ""},
    onSubmit: ({value}) => {
      mutation.mutate({
        workspaceSlug,
        type: "meta-puzzle",
        ...value,
        id: newId(),
        roundId,
        worksheetType: "google_spreadsheet",
      });
      form.reset();
      setOpen(false);
    },
  });

  return (
    <ControlledModal isOpen={open} onOpenChange={setOpen} trigger={children}>
      <Modal.Container>
        <Modal.Dialog aria-describedby={undefined} className="sm:max-w-[425px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Add new meta puzzle</Modal.Heading>
          </Modal.Header>
          <form.AppForm>
            <Modal.Body>
              <form.Form>
                <div className="grid gap-4 py-4">
                  <form.AppField
                    name="name"
                    validators={{onSubmit: z.string().min(1)}}
                    children={field => (
                      <field.TextField label="Name" autoFocus autoComplete="off" />
                    )}
                  />
                  <form.AppField
                    name="tags"
                    children={field => (
                      <field.ComboboxMultipleField label="Tags" items={workspace.tags} />
                    )}
                  />
                  <form.AppField
                    name="link"
                    validators={{onSubmit: z.url().or(z.string().length(0))}}
                    children={field => (
                      <field.TextField
                        label="Link"
                        type="url"
                        description="Link to this puzzle on the hunt website."
                      />
                    )}
                  />
                  <form.AppField
                    name="assignUnassignedPuzzles"
                    validators={{onSubmit: z.boolean()}}
                    children={field => <field.CheckboxField label="Assign unassigned puzzles" />}
                  />
                </div>
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
