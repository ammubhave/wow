import {Resizable} from "@heroui-pro/react/resizable";
import {Accordion, Button, ButtonGroup, InputGroup, ListBox, Tooltip} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {BrushIcon, EditIcon, PuzzleIcon, TableIcon} from "lucide-react";
import {useState} from "react";
import {cn} from "tailwind-variants";

import {Chat} from "@/components/chat";
import {CommentBox} from "@/components/comment-box";
import {EditPuzzleDialog} from "@/components/edit-puzzle-dialog";
import {useAppForm} from "@/components/form";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {useWorkspace} from "@/hooks/use-workspace";
import {client} from "@/lib/orpc";
import {getPuzzleImportances} from "@/lib/puzzleImportances";
import {
  getBgColorClassNamesForPuzzleStatusNoHover,
  getPuzzleStatusGroups,
  getPuzzleStatusOptions,
} from "@/lib/puzzleStatuses";
import {usePuzzle} from "@/lib/usePuzzle";
import {workspaceMutations} from "@/lib/workspace-mutations";

export const Route = createFileRoute("/_workspace/$workspaceSlug/puzzles/$puzzleId")({
  component: RouteComponent,
  head: async ({params}) => {
    const puzzle = await client.puzzles.get({
      workspaceSlug: params.workspaceSlug,
      puzzleId: params.puzzleId,
    });
    return {meta: [{title: `${puzzle.name} | WOW`}]};
  },
});

function RouteComponent() {
  const {workspaceSlug, puzzleId} = Route.useParams();
  const puzzle = usePuzzle({puzzleId});

  if (!puzzle.data || !puzzleId) {
    return <></>;
  }

  return (
    <main className="flex flex-1 flex-col">
      <PresencesWebSocket workspaceSlug={workspaceSlug} puzzleId={puzzleId}>
        <div className="flex flex-1">
          <Resizable orientation="horizontal">
            <Resizable.Panel defaultSize={80}>
              {/* oxlint-disable-next-line react/iframe-missing-sandbox -- trusted Google Sheets/Drawings editor that needs scripts, same-origin storage, popups (sign-in, share) and top navigation; any sandbox would break it. */}
              <iframe
                title={`${puzzle.data.name} ${puzzle.data.googleSpreadsheetId ? "spreadsheet" : "drawing"}`}
                src={
                  puzzle.data.googleSpreadsheetId
                    ? `https://docs.google.com/spreadsheets/d/${puzzle.data.googleSpreadsheetId}/edit?widget=true&chrome=false&rm=embedded`
                    : `https://docs.google.com/drawings/d/${puzzle.data.googleDrawingId}/edit?widget=true&chrome=false&rm=embedded`
                }
                allow="fullscreen; geolocation; microphone; camera; payment"
                className="min-h-[calc(100dvh-(--spacing(16)))] w-full flex-1 bg-white"
              />
            </Resizable.Panel>
            <Resizable.Handle type="drag" />
            <Resizable.Panel defaultSize={20}>
              <Resizable orientation="vertical">
                <Resizable.Panel defaultSize={30} className="flex">
                  {/* Keyed so the form (and chat history) never carry over between puzzles: a
                      touched form stops following its default values, so it would otherwise keep
                      showing, and on the next change submit, the previous puzzle's fields. */}
                  <PuzzleInfoPanel
                    key={puzzleId}
                    workspaceSlug={workspaceSlug}
                    puzzle={puzzle.data}
                  />
                </Resizable.Panel>
                <Resizable.Handle type="drag" />
                <Resizable.Panel defaultSize={60} className="flex flex-col">
                  <Chat key={puzzleId} puzzleId={puzzleId} />
                </Resizable.Panel>
              </Resizable>
            </Resizable.Panel>
          </Resizable>
        </div>
      </PresencesWebSocket>
    </main>
  );
}

function PuzzleInfoPanel({
  workspaceSlug,
  puzzle,
}: {
  workspaceSlug: string;
  puzzle: {
    comment: string | null;
    commentUpdatedAt: Date | null;
    commentUpdatedBy: string | null;
    id: string;
    roundId: string;
    parentPuzzleId: string | null;
    name: string;
    link: string | null;
    googleSpreadsheetId: string | null;
    googleDrawingId: string | null;
    answer: string | null;
    status: string | null;
    importance: string | null;
    childPuzzles: {id: string; answer: string | null; name: string}[];
    isMetaPuzzle: boolean;
    tags: string[];
  };
}) {
  const workspace = useWorkspace();
  const puzzleUpdateMutation = useMutation(workspaceMutations.puzzles.update());
  // Each field commits as soon as it's edited. In between, the form is reset (untouched) so it
  // keeps following `puzzle` — this change's overlay, then the server and other solvers' edits —
  // and only a field that is actually being typed into holds on to its own value.
  const form = useAppForm({
    defaultValues: {
      answer: puzzle.answer ?? "",
      // React Aria collection keys can't be null, so the "None" status option uses "".
      status: puzzle.status ?? "",
      importance: puzzle.importance,
      tags: puzzle.tags,
    },
    onSubmit: ({value}) => {
      puzzleUpdateMutation.mutate({
        workspaceSlug,
        id: puzzle.id,
        answer: value.answer,
        status: value.status || null,
        importance: value.importance,
        tags: value.tags,
      });
      form.reset(value);
    },
  });

  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col",
        getBgColorClassNamesForPuzzleStatusNoHover(puzzle.status)
      )}>
      <div className="bg-surface-secondary/50 flex w-full flex-wrap items-center gap-2.5 rounded-md px-3 py-2.5 text-xs/relaxed">
        <div className="flex flex-1 flex-col gap-1">
          <div className="line-clamp-1 flex w-fit items-center gap-2 text-xs/relaxed leading-snug font-medium underline-offset-4">
            {puzzle.name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {puzzle.googleSpreadsheetId && (
            <Tooltip>
              <Tooltip.Trigger>
                <a
                  aria-label="Google spreadsheet"
                  className="button button--icon-only button--sm button--ghost"
                  href={`https://docs.google.com/spreadsheets/d/${puzzle.googleSpreadsheetId}/edit?gid=0#gid=0`}
                  target="_blank"
                  rel="noopener noreferrer">
                  <TableIcon />
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content>Link to the puzzle's Google spreadsheet</Tooltip.Content>
            </Tooltip>
          )}
          {puzzle.googleDrawingId && (
            <Tooltip>
              <Tooltip.Trigger>
                <a
                  aria-label="Google drawing"
                  className="button button--icon-only button--sm button--ghost"
                  href={`https://docs.google.com/drawings/d/${puzzle.googleDrawingId}/edit?gid=0#gid=0`}
                  target="_blank"
                  rel="noopener noreferrer">
                  <BrushIcon />
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content>Link to the puzzle's Google drawing</Tooltip.Content>
            </Tooltip>
          )}
          {puzzle.link && (
            <Tooltip>
              <Tooltip.Trigger>
                <a
                  aria-label="Puzzle page on the hunt website"
                  className="button button--icon-only button--sm button--ghost"
                  href={puzzle.link}
                  target="_blank"
                  rel="noopener noreferrer">
                  <PuzzleIcon />
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content>Link to the puzzle page on the hunt website</Tooltip.Content>
            </Tooltip>
          )}
          <EditPuzzleDialog
            workspaceSlug={workspaceSlug}
            puzzle={puzzle}
            open={isEditPuzzleDialogOpen}
            setOpen={setIsEditPuzzleDialogOpen}>
            <Button size="sm" isIconOnly variant="ghost" aria-label="Edit puzzle">
              <EditIcon />
            </Button>
          </EditPuzzleDialog>
        </div>
      </div>
      <div className="flex flex-col gap-2 overflow-auto text-sm">
        <form.AppForm>
          <form.Form>
            <div className="flex w-full flex-col gap-0">
              <form.AppField
                name="answer"
                listeners={{
                  onBlur: async ({fieldApi}) => {
                    // onBlur is called whenever focus is lost. Only actually submit the form if the
                    // field value changed. (A missing answer is shown as "", so compare against
                    // that: otherwise tabbing through an empty answer marks the puzzle solved.)
                    if (fieldApi.state.value === (puzzle.answer ?? "")) {
                      // Blurring marks the field touched; untouch it so it follows `puzzle` again.
                      form.reset();
                      return;
                    }
                    if (form.state.isValid) {
                      const currentStatus = form.getFieldValue("status");
                      if (
                        fieldApi.state.value !== "" &&
                        currentStatus !== "solved" &&
                        currentStatus !== "backsolved"
                      ) {
                        form.setFieldValue("status", "solved");
                      }

                      await form.handleSubmit();
                    }
                  },
                }}
                children={field => (
                  <ButtonGroup className="w-full">
                    <span className="button button--md button--primary pointer-events-none min-w-22 shrink-0">
                      Answer
                    </span>
                    <InputGroup className="min-w-0 flex-1">
                      <field.InputGroupInputField
                        aria-label="Answer"
                        className="font-mono whitespace-pre uppercase"
                      />
                    </InputGroup>
                  </ButtonGroup>
                )}
              />
              <form.AppField
                name="status"
                listeners={{
                  onChange: async ({fieldApi}) => {
                    if (
                      fieldApi.state.value !== "solved" &&
                      fieldApi.state.value !== "backsolved"
                    ) {
                      form.setFieldValue("answer", "");
                    }

                    if (form.state.isValid) {
                      await form.handleSubmit();
                    }
                  },
                }}
                children={field => (
                  <ButtonGroup className="w-full">
                    <span className="button button--md button--primary pointer-events-none min-w-22 shrink-0">
                      Status
                    </span>
                    <InputGroup className="min-w-0 flex-1">
                      <field.SelectField
                        aria-label="Status"
                        className="border-0 bg-transparent"
                        items={getPuzzleStatusOptions()}>
                        {getPuzzleStatusGroups().map(group => (
                          <ListBox.Section key={group.groupLabel} className={group.bgColorNoHover}>
                            {group.values.map(option => (
                              <ListBox.Item
                                key={option.value ?? ""}
                                id={option.value ?? ""}
                                textValue={option.label}>
                                {option.label}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox.Section>
                        ))}
                      </field.SelectField>
                    </InputGroup>
                  </ButtonGroup>
                )}
              />
              <form.AppField
                name="importance"
                listeners={{
                  onChange: async () => {
                    if (form.state.isValid) {
                      await form.handleSubmit();
                    }
                  },
                }}
                children={field => (
                  <ButtonGroup className="w-full">
                    <span className="button button--md button--primary pointer-events-none min-w-22 shrink-0">
                      Importance
                    </span>
                    <InputGroup className="min-w-0 flex-1">
                      <field.SelectField
                        aria-label="Importance"
                        className="border-0 bg-transparent"
                        items={getPuzzleImportances().map(importance => {
                          return {
                            value: importance.value,
                            label: (
                              <>
                                {importance.icon} {importance.label}
                              </>
                            ),
                          };
                        })}>
                        {getPuzzleImportances().map(importance => (
                          <ListBox.Item
                            key={importance.value}
                            id={importance.value}
                            textValue={importance.label}
                            className={importance.color}>
                            {importance.icon} {importance.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </field.SelectField>
                    </InputGroup>
                  </ButtonGroup>
                )}
              />
              <form.AppField
                name="tags"
                listeners={{
                  onChange: async () => {
                    if (form.state.isValid) {
                      await form.handleSubmit();
                    }
                  },
                }}
                children={field => (
                  <ButtonGroup className="w-full">
                    <span className="button button--md button--primary pointer-events-none min-w-22 shrink-0">
                      Tags
                    </span>
                    <InputGroup className="h-auto min-w-0 flex-1">
                      <field.ComboboxMultipleField
                        className="border-0 bg-transparent"
                        items={workspace.tags}
                      />
                    </InputGroup>
                  </ButtonGroup>
                )}
              />
              {puzzle.childPuzzles.length > 0 && (
                <div>
                  <Accordion>
                    <Accordion.Item>
                      <Accordion.Heading>
                        <Accordion.Trigger>
                          Feeder Puzzle Answers
                          <Accordion.Indicator />
                        </Accordion.Trigger>
                      </Accordion.Heading>
                      <Accordion.Panel>
                        <Accordion.Body>
                          <div className="relative w-full overflow-x-auto">
                            <table className="w-full caption-bottom text-xs">
                              <tbody>
                                {puzzle.childPuzzles.map(childPuzzle => (
                                  <tr
                                    key={childPuzzle.id}
                                    className="hover:bg-surface-secondary/50 border-b transition-colors">
                                    <td className="p-2 align-middle whitespace-nowrap">
                                      {childPuzzle.name}
                                    </td>
                                    <td className="p-2 align-middle font-mono whitespace-nowrap">
                                      {childPuzzle.answer}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Accordion.Body>
                      </Accordion.Panel>
                    </Accordion.Item>
                  </Accordion>
                </div>
              )}
            </div>
          </form.Form>
        </form.AppForm>
        <div className="flex flex-col gap-2 px-2">
          <CommentBox
            comment={puzzle.comment}
            commentUpdatedAt={puzzle.commentUpdatedAt}
            commentUpdatedBy={puzzle.commentUpdatedBy}
            workspaceSlug={workspaceSlug}
            puzzleId={puzzle.id}
          />
        </div>
      </div>
    </div>
  );
}
