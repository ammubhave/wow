import {ListBox, Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {z} from "zod";

import {IconTooltip} from "@/components/icon-button";
import {useWorkspace} from "@/hooks/use-workspace";
import {parseTypedAnswers, splitAnswers} from "@/lib/answers";
import {getPuzzleStatusGroups, getPuzzleStatusOptions} from "@/lib/puzzleStatuses";
import {workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";
import {PlacementOptions} from "./placement-options";

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
    answerCount: number;
    status: string | null;
    link: string | null;
    googleSpreadsheetId: string | null;
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
      // Several answers edit in one box, "; " between them.
      answer: splitAnswers(puzzle.answer).join("; "),
      answerCount: String(puzzle.answerCount),
      link: puzzle.link ?? "",
      status: puzzle.status ?? "",
      isMetaPuzzle: puzzle.isMetaPuzzle,
      tags: puzzle.tags,
    },
    onSubmit: ({value}) => {
      // Only the fields changed here: the rest may have been changed by a teammate since the
      // dialog opened, and sending the values shown here would undo that.
      const changed = (name: keyof typeof value) => form.getFieldMeta(name)?.isDirty === true;
      mutation.mutate({
        workspaceSlug,
        id: puzzle.id,
        parentPuzzleId: changed("parentPuzzleId") ? value.parentPuzzleId : undefined,
        name: changed("name") ? value.name : undefined,
        answer: changed("answer") ? parseTypedAnswers(value.answer) : undefined,
        answerCount: changed("answerCount")
          ? Math.min(20, Math.max(1, Math.trunc(Number(value.answerCount)) || 1))
          : undefined,
        link: changed("link") ? (value.link === "" ? null : value.link) : undefined,
        status: changed("status") ? (value.status === "" ? null : value.status) : undefined,
        isMetaPuzzle: changed("isMetaPuzzle") ? value.isMetaPuzzle : undefined,
        tags: changed("tags") ? value.tags : undefined,
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
          <IconTooltip label="Close">
            <Modal.CloseTrigger />
          </IconTooltip>
          <Modal.Header>
            <Modal.Heading>Edit puzzle</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form.AppForm>
              <form.Form>
                <form.AppField
                  name="name"
                  validators={{onSubmit: z.string().trim().min(1, "Give the puzzle a name.")}}
                  children={field => (
                    <field.TextField variant="secondary" label="Name" autoComplete="off" />
                  )}
                />
                <form.AppField
                  name="parentPuzzleId"
                  children={field => (
                    <field.SelectField variant="secondary" label="Goes in">
                      <PlacementOptions rounds={workspace.rounds} excludeId={puzzle.id} />
                    </field.SelectField>
                  )}
                />
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-start gap-3">
                  <form.AppField
                    name="answer"
                    children={field => (
                      <field.TextField
                        variant="secondary"
                        label="Answer"
                        className="font-mono"
                        autoComplete="off"
                        description="Several? Put ; between them."
                      />
                    )}
                  />
                  <form.AppField
                    name="answerCount"
                    children={field => (
                      <field.TextField
                        variant="secondary"
                        label="How many"
                        type="number"
                        min={1}
                        max={20}
                        description="Answers it has."
                      />
                    )}
                  />
                </div>
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
                  validators={{
                    onSubmit: z
                      .url("Enter a web address, like https://hunt.example/puzzles/name")
                      .or(z.literal("")),
                  }}
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
                    <field.CheckboxField variant="secondary" label="It's a meta" />
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
