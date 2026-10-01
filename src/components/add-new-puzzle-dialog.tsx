import {ListBox, Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {Link} from "@tanstack/react-router";
import {toast} from "sonner";
import {z} from "zod";

import {useWorkspace} from "@/hooks/use-workspace";
import {newId, workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

function PuzzleAddedDescription({
  workspaceSlug,
  puzzleId,
  puzzleName,
}: {
  workspaceSlug: string;
  puzzleId: string;
  puzzleName: string;
}) {
  return (
    <>
      Go to
      <Link
        to="/$workspaceSlug/puzzles/$puzzleId"
        params={{workspaceSlug, puzzleId}}
        className="ml-1 hover:underline">
        {puzzleName}
      </Link>
    </>
  );
}

function showPuzzleAddedToast(workspaceSlug: string, puzzle: {id: string; name: string}) {
  toast.success("Puzzle added", {
    description: (
      <PuzzleAddedDescription
        workspaceSlug={workspaceSlug}
        puzzleId={puzzle.id}
        puzzleName={puzzle.name}
      />
    ),
  });
}

export function AddNewPuzzleDialog({
  workspaceSlug,
  children,
  open,
  setOpen,
  roundId,
  parentPuzzleId,
}: {
  workspaceSlug: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
  roundId: string;
  parentPuzzleId?: string;
}) {
  const workspace = useWorkspace();
  const mutation = useMutation({
    ...workspaceMutations.puzzles.create(),
    // On the mutation (not the `mutate` call) so it fires for every puzzle added, even if the
    // dialog was used again before the server answered.
    onSuccess: puzzle => showPuzzleAddedToast(workspaceSlug, puzzle),
  });
  const form = useAppForm({
    defaultValues: {
      name: "",
      tags: [] as string[],
      link: "",
      worksheetType: "google_spreadsheet" as "google_spreadsheet" | "google_drawing",
    },
    onSubmit: ({value}) => {
      mutation.mutate({
        type: "puzzle",
        ...value,
        // A puzzle goes either under a meta puzzle or straight into a round.
        ...(parentPuzzleId ? {parentPuzzleId} : {roundId}),
        id: newId(),
        workspaceSlug,
      });
      form.reset();
      setOpen(false);
    },
  });
  return (
    <ControlledModal isOpen={open} onOpenChange={setOpen} trigger={children}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[425px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Add new puzzle</Modal.Heading>
          </Modal.Header>
          <form.AppForm>
            <Modal.Body>
              <form
                id={form.formId}
                onSubmit={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}>
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
                      <field.ComboboxMultipleField label="Tags" items={workspace.tags ?? []} />
                    )}
                  />
                  <form.AppField
                    name="link"
                    validators={{onSubmit: z.url().or(z.string().length(0))}}
                    children={field => (
                      <field.TextField
                        label="Link"
                        type="url"
                        autoComplete="off"
                        description="Link to this puzzle on the hunt website."
                      />
                    )}
                  />
                  <form.AppField
                    name="worksheetType"
                    children={field => {
                      const items = [
                        {value: "google_spreadsheet", label: "Google Spreadsheet"},
                        {value: "google_drawing", label: "Google Drawing"},
                      ];
                      return (
                        <field.SelectField
                          label="Worksheet Type"
                          description="The kind of puzzle worksheet you want to use."
                          items={items}>
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
