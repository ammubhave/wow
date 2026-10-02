import {EmptyState} from "@heroui-pro/react";
import {Resizable} from "@heroui-pro/react/resizable";
import {Button, buttonVariants, InputGroup, ListBox, Tooltip} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {
  BrushIcon,
  EditIcon,
  ExternalLinkIcon,
  PuzzleIcon,
  SheetIcon,
  TableIcon,
} from "lucide-react";
import {useState} from "react";
import {cn} from "tailwind-variants";

import {Chat} from "@/components/chat";
import {CommentBox} from "@/components/comment-box";
import {EditPuzzleDialog} from "@/components/edit-puzzle-dialog";
import {useAppForm} from "@/components/form";
import {NotFoundPage} from "@/components/not-found-page";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {SolveSpark} from "@/components/solve-spark";
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
    // Unknown or since-deleted puzzle: say so inside the workspace rather than a blank page.
    return <NotFoundPage className="min-h-0" />;
  }

  return (
    <main className="flex flex-1 flex-col">
      <PresencesWebSocket workspaceSlug={workspaceSlug} puzzleId={puzzleId}>
        <div className="flex flex-1">
          <Resizable orientation="horizontal">
            <Resizable.Panel defaultSize={80}>
              {puzzle.data.googleSpreadsheetId || puzzle.data.googleDrawingId ? (
                <>
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
                </>
              ) : (
                // No worksheet (e.g. Google Drive isn't connected): the page still has the chat,
                // answer and status, so say so rather than embedding a broken frame.
                <div className="flex min-h-[calc(100dvh-(--spacing(16)))] flex-1 items-center justify-center p-6">
                  <EmptyState>
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <SheetIcon />
                      </EmptyState.Media>
                      <EmptyState.Title>No spreadsheet for this puzzle</EmptyState.Title>
                      <EmptyState.Description>
                        Connect Google Drive in the workspace settings to get a sheet for new
                        puzzles. You can still chat and record the answer here.
                      </EmptyState.Description>
                    </EmptyState.Header>
                    {puzzle.data.link && (
                      <EmptyState.Content>
                        <a
                          href={puzzle.data.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({variant: "secondary"})}>
                          Open the puzzle on the hunt site
                          <ExternalLinkIcon />
                        </a>
                      </EmptyState.Content>
                    )}
                  </EmptyState>
                </div>
              )}
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
    <div className="bg-surface flex min-w-0 flex-1 flex-col overflow-auto">
      <div className="border-separator flex items-center gap-1 border-b py-1.5 ps-3 pe-1.5">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={puzzle.name}>
          {puzzle.name}
        </h2>
        {puzzle.link && (
          <PanelLink href={puzzle.link} label="Open on the hunt site" icon={<PuzzleIcon />} />
        )}
        {puzzle.googleSpreadsheetId && (
          <PanelLink
            href={`https://docs.google.com/spreadsheets/d/${puzzle.googleSpreadsheetId}/edit`}
            label="Open spreadsheet in a new tab"
            icon={<TableIcon />}
          />
        )}
        {puzzle.googleDrawingId && (
          <PanelLink
            href={`https://docs.google.com/drawings/d/${puzzle.googleDrawingId}/edit`}
            label="Open drawing in a new tab"
            icon={<BrushIcon />}
          />
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
      <form.AppForm>
        {/* A property list: muted labels on the left, full-width controls on the right. */}
        <form.Form className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-3">
          <span className="text-muted text-xs">Answer</span>
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
              <div className="min-w-0">
                <InputGroup fullWidth variant="secondary">
                  <field.InputGroupInputField
                    aria-label="Answer"
                    placeholder="Not solved yet"
                    className="font-mono whitespace-pre uppercase placeholder:font-sans placeholder:normal-case"
                    onKeyDown={e => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                </InputGroup>
              </div>
            )}
          />
          <span className="text-muted text-xs">Status</span>
          <form.AppField
            name="status"
            listeners={{
              onChange: async ({fieldApi}) => {
                if (fieldApi.state.value !== "solved" && fieldApi.state.value !== "backsolved") {
                  form.setFieldValue("answer", "");
                }

                if (form.state.isValid) {
                  await form.handleSubmit();
                }
              },
            }}
            children={field => (
              <SolveSpark
                isSolved={field.state.value === "solved" || field.state.value === "backsolved"}>
                <field.SelectField
                  aria-label="Status"
                  variant="secondary"
                  fullWidth
                  placeholder="None"
                  // The trigger carries the status colour, as rows do on the blackboard.
                  className={getBgColorClassNamesForPuzzleStatusNoHover(field.state.value || null)}
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
              </SolveSpark>
            )}
          />
          <span className="text-muted text-xs">Importance</span>
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
              <div className="min-w-0">
                <field.SelectField
                  aria-label="Importance"
                  variant="secondary"
                  fullWidth
                  placeholder="Not set"
                  items={getPuzzleImportances()}>
                  {getPuzzleImportances().map(importance => (
                    <ListBox.Item
                      key={importance.value}
                      id={importance.value}
                      textValue={importance.label}
                      className={importance.color}>
                      <span className="flex items-center gap-2 [&_svg]:size-4">
                        {importance.icon}
                        {importance.label}
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </field.SelectField>
              </div>
            )}
          />
          <span className="text-muted self-start pt-2 text-xs">Tags</span>
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
              <div className="min-w-0">
                <field.ComboboxMultipleField
                  variant="secondary"
                  className="w-full"
                  items={workspace.tags}
                />
              </div>
            )}
          />
        </form.Form>
      </form.AppForm>
      {puzzle.childPuzzles.length > 0 && (
        <section
          className="border-separator flex flex-col gap-1.5 border-t p-3"
          aria-label="Feeder answers">
          <h3 className="text-muted text-xs font-medium">Feeder answers</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {puzzle.childPuzzles.map(child => (
              <li key={child.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{child.name}</span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-xs",
                    child.answer ? "text-success" : "text-muted"
                  )}>
                  {child.answer ? child.answer.toUpperCase() : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="border-separator border-t p-3">
        <CommentBox
          comment={puzzle.comment}
          commentUpdatedAt={puzzle.commentUpdatedAt}
          commentUpdatedBy={puzzle.commentUpdatedBy}
          workspaceSlug={workspaceSlug}
          puzzleId={puzzle.id}
        />
      </div>
    </div>
  );
}

/** An icon-only link in the panel header, labelled by a tooltip. */
function PanelLink({href, label, icon}: {href: string; label: string; icon: React.ReactNode}) {
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <a
          aria-label={label}
          className={buttonVariants({variant: "ghost", size: "sm", isIconOnly: true})}
          href={href}
          target="_blank"
          rel="noopener noreferrer">
          {icon}
        </a>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
