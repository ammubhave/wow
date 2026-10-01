import {ListBox, Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {z} from "zod";

import {useWorkspace} from "@/hooks/use-workspace";
import {getPuzzleStatusGroups, getPuzzleStatusOptions} from "@/lib/puzzleStatuses";
import {workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

export function EditPuzzleDialog({
  workspaceSlug,
  puzzle,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  puzzle: {
    id: string;
    roundId: string;
    parentPuzzleId: string | null;
    name: string;
    answer: string | null;
    status: string | null;
    link: string | null;
    googleSpreadsheetId: string | null;
    googleDrawingId: string | null;
    isMetaPuzzle: boolean;
    tags: string[];
  };
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const workspace = useWorkspace();
  const mutation = useMutation(workspaceMutations.puzzles.update());
  const form = useAppForm({
    defaultValues: {
      parentPuzzleId: puzzle.parentPuzzleId ?? puzzle.roundId,
      name: puzzle.name,
      answer: puzzle.answer ?? "",
      link: puzzle.link ?? "",
      status: puzzle.status ?? "",
      isMetaPuzzle: puzzle.isMetaPuzzle,
      tags: puzzle.tags,
    },
    onSubmit: ({value}) => {
      mutation.mutate({
        workspaceSlug,
        id: puzzle.id,
        ...value,
        answer: value.answer === "" ? null : value.answer.toUpperCase(),
        link: value.link === "" ? null : value.link,
        status: value.status === "" ? null : value.status,
      });
      // Untouched again, the form follows `puzzle` (now showing this edit) from here on.
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
            <Modal.Heading>Edit puzzle</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form.AppForm>
              <form.Form>
                <form.AppField
                  name="name"
                  validators={{onSubmit: z.string().min(1)}}
                  children={field => (
                    <field.TextField variant="secondary" label="Name" autoComplete="off" />
                  )}
                />
                <form.AppField
                  name="parentPuzzleId"
                  children={field => {
                    const items = [
                      ...(workspace.rounds
                        .flatMap(r => [
                          {
                            id: r.id,
                            name:
                              r.metaPuzzles.length > 0 ? r.name : `${r.name} (Unassigned Puzzles)`,
                            disabled: r.metaPuzzles.length > 0,
                          },
                          ...r.metaPuzzles,
                        ])
                        .map(p => ({
                          value: p.id,
                          label: p.name,
                          disabled: "disabled" in p ? p.disabled : false,
                        })) ?? []),
                    ];
                    return (
                      <field.SelectField variant="secondary" label="Feeds Into" items={items}>
                        {items.map(item => (
                          <ListBox.Item
                            key={item.value}
                            id={item.value ?? ""}
                            textValue={item.label}
                            isDisabled={item.disabled}>
                            {item.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </field.SelectField>
                    );
                  }}
                />
                <form.AppField
                  name="answer"
                  children={field => (
                    <field.TextField
                      variant="secondary"
                      label="Answer"
                      className="font-mono"
                      autoComplete="off"
                    />
                  )}
                />
                <form.AppField
                  name="status"
                  children={field => {
                    return (
                      <field.SelectField
                        variant="secondary"
                        label="Status"
                        items={getPuzzleStatusOptions()}>
                        {getPuzzleStatusGroups().map(group => (
                          <ListBox.Section
                            key={group.groupLabel}
                            aria-label={group.groupLabel}
                            className={group.bgColorNoHover}>
                            {group.values.map(option => (
                              <ListBox.Item
                                key={option.value}
                                id={option.value ?? ""}
                                textValue={option.label}>
                                {option.label}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox.Section>
                        ))}
                      </field.SelectField>
                    );
                  }}
                />
                <form.AppField
                  name="tags"
                  children={field => (
                    <field.ComboboxMultipleField
                      variant="secondary"
                      label="Tags"
                      items={workspace.tags}
                    />
                  )}
                />
                <form.AppField
                  name="link"
                  children={field => (
                    <field.TextField
                      variant="secondary"
                      label="Link"
                      description="Link to this puzzle on the hunt website."
                      type="url"
                      autoComplete="off"
                    />
                  )}
                />
                <form.AppField
                  name="isMetaPuzzle"
                  children={field => (
                    <field.CheckboxField variant="secondary" label="Is this a meta puzzle?" />
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
