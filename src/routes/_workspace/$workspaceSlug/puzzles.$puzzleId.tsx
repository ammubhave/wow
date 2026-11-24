import {Resizable} from "@heroui-pro/react/resizable";
import {
  Button,
  buttonVariants,
  Chip,
  Dropdown,
  InputGroup,
  Label,
  ListBox,
  Spinner,
  Tabs,
  Tooltip,
} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute, Link, useNavigate} from "@tanstack/react-router";
import {
  BrushIcon,
  ChevronRightIcon,
  CopyIcon,
  EditIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  LinkIcon,
  PresentationIcon,
  SheetIcon,
  TableIcon,
  TimerIcon,
  TrashIcon,
} from "lucide-react";
import {type ReactNode, useEffect, useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";
import {useMediaQuery} from "usehooks-ts";
import {z} from "zod";

import {Chat} from "@/components/chat";
import {CommentBox} from "@/components/comment-box";
import {DeletePuzzleDialog} from "@/components/delete-puzzle-dialog";
import {EditPuzzleDialog} from "@/components/edit-puzzle-dialog";
import {useAppForm} from "@/components/form";
import {PuzzleGuesses} from "@/components/guess-queue";
import {NotFoundPage} from "@/components/not-found-page";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {HelpedToggle, PuzzleContributorAvatars} from "@/components/puzzle-contributors";
import {PuzzleSheet} from "@/components/sheet/sheet";
import {SolveSpark} from "@/components/solve-spark";
import {PuzzleWhiteboard} from "@/components/whiteboard/whiteboard";
import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {formatPuzzleTime, usePuzzleTimeTracker} from "@/hooks/use-puzzle-time";
import {useWorkspace} from "@/hooks/use-workspace";
import {track} from "@/lib/analytics";
import {formatAnswers, joinAnswers, solvedByAnswer, splitAnswers} from "@/lib/answers";
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
  // Which surface the left pane shows; in the URL so a shared link opens the same view.
  // On phones, chat and the puzzle's details are views too (on desktop they're always shown).
  validateSearch: z.object({view: z.enum(["sheet", "whiteboard", "chat", "info"]).optional()}),
  component: RouteComponent,
  head: async ({params}) => {
    const puzzle = await client.puzzles.get({
      workspaceSlug: params.workspaceSlug,
      puzzleId: params.puzzleId,
    });
    return {meta: [{title: `${puzzle.name} | WOW`}]};
  },
});

/** The puzzle's Google file (its sheet, or else its drawing), without the editor or preview part. */
const googleFileUrl = (puzzle: {
  googleSpreadsheetId: string | null;
  googleDrawingId: string | null;
}) =>
  puzzle.googleSpreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${puzzle.googleSpreadsheetId}`
    : `https://docs.google.com/drawings/d/${puzzle.googleDrawingId}`;

function RouteComponent() {
  const {workspaceSlug, puzzleId} = Route.useParams();
  const puzzle = usePuzzle({puzzleId});
  // Phones get one view at a time (tabs) instead of side-by-side panels.
  const isWide = useMediaQuery("(min-width: 768px)");

  if (!puzzle.data || !puzzleId) {
    // Unknown or since-deleted puzzle: say so inside the workspace rather than a blank page.
    return <NotFoundPage className="min-h-0" />;
  }

  // Keyed so the form (and chat history) never carry over between puzzles: a touched form stops
  // following its default values, so it would otherwise keep showing, and on the next change
  // submit, the previous puzzle's fields.
  const info = (
    <PuzzleInfoPanel key={puzzleId} workspaceSlug={workspaceSlug} puzzle={puzzle.data} />
  );
  const chat = <Chat key={puzzleId} puzzleId={puzzleId} />;

  if (!isWide) {
    return (
      // min-w-0: as a flex item it would otherwise grow to its widest content, not the screen.
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PresencesWebSocket workspaceSlug={workspaceSlug} puzzleId={puzzleId}>
          <WorksheetPane puzzle={puzzle.data} phone={{chat, info}} />
        </PresencesWebSocket>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <PresencesWebSocket workspaceSlug={workspaceSlug} puzzleId={puzzleId}>
        <div className="flex flex-1">
          <Resizable orientation="horizontal">
            <Resizable.Panel defaultSize={75} className="flex min-h-0 flex-col">
              <WorksheetPane puzzle={puzzle.data} />
            </Resizable.Panel>
            <Resizable.Handle type="drag" />
            {/* Wide enough for an answer and tags; the info half tall enough for its fields. */}
            <Resizable.Panel defaultSize={25}>
              <Resizable orientation="vertical">
                <Resizable.Panel defaultSize={45} className="flex">
                  {info}
                </Resizable.Panel>
                <Resizable.Handle type="drag" />
                <Resizable.Panel defaultSize={55} className="flex flex-col">
                  {chat}
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
    answerCount: number;
    status: string | null;
    importance: string | null;
    childPuzzles: {id: string; answer: string | null; name: string}[];
    isMetaPuzzle: boolean;
    tags: string[];
    contributorIds: string[];
  };
}) {
  const workspace = useWorkspace();
  // Archived: the fields show the puzzle as it was left, and can't be changed.
  const isReadOnly = useIsReadOnly();
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
  const [isDeletePuzzleDialogOpen, setIsDeletePuzzleDialogOpen] = useState(false);
  const navigate = useNavigate();
  // A feeder's siblings: the meta's other feeders, with their answers so far.
  const meta = puzzle.parentPuzzleId
    ? workspace.rounds.flatMap(r => r.puzzles).find(p => p.id === puzzle.parentPuzzleId)
    : undefined;
  const siblings = meta?.childPuzzles.filter(child => child.id !== puzzle.id) ?? [];

  return (
    // Scrolls down only: the solve sparks' canvas reaches past the Status field's edge, which
    // would otherwise add a sideways scroll to the whole panel.
    <div className="bg-surface flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
      <div className="border-separator flex items-center gap-1 border-b py-1.5 ps-3 pe-1.5">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={puzzle.name}>
          {puzzle.name}
        </h2>
        {/* Reading the puzzle is what people come here for, so it's a labelled button. */}
        {puzzle.link && (
          <a
            data-tour="open-puzzle"
            className={buttonVariants({variant: "secondary", size: "sm", className: "shrink-0"})}
            href={puzzle.link}
            target="_blank"
            rel="noopener noreferrer">
            Open puzzle
            <ExternalLinkIcon />
          </a>
        )}
        {puzzle.googleSpreadsheetId && (
          <PanelLink
            href={`https://docs.google.com/spreadsheets/d/${puzzle.googleSpreadsheetId}/${isReadOnly ? "preview" : "edit"}`}
            label="Open spreadsheet in a new tab"
            icon={<TableIcon />}
          />
        )}
        {puzzle.googleDrawingId && (
          <PanelLink
            href={`https://docs.google.com/drawings/d/${puzzle.googleDrawingId}/${isReadOnly ? "preview" : "edit"}`}
            label="Open drawing in a new tab"
            icon={<BrushIcon />}
          />
        )}
        <Dropdown>
          <Button size="sm" isIconOnly variant="ghost" aria-label="Puzzle actions">
            <EllipsisIcon />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu>
              {!isReadOnly && (
                <Dropdown.Item
                  id="edit"
                  textValue="Edit puzzle"
                  onAction={() => setIsEditPuzzleDialogOpen(true)}>
                  <EditIcon />
                  <Label>Edit or move puzzle</Label>
                </Dropdown.Item>
              )}
              <Dropdown.Item
                id="copy-link"
                textValue="Copy link"
                onAction={() =>
                  void navigator.clipboard.writeText(window.location.href).then(
                    () => toast.success("Link copied"),
                    () => toast.error("Couldn't copy. Copy the address from the address bar.")
                  )
                }>
                <LinkIcon />
                <Label>Copy link</Label>
              </Dropdown.Item>
              {!isReadOnly && (
                <Dropdown.Item
                  id="delete"
                  textValue="Delete puzzle"
                  variant="danger"
                  onAction={() => setIsDeletePuzzleDialogOpen(true)}>
                  <TrashIcon />
                  <Label>{puzzle.isMetaPuzzle ? "Delete meta" : "Delete puzzle"}</Label>
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        {isEditPuzzleDialogOpen && (
          <EditPuzzleDialog
            workspaceSlug={workspaceSlug}
            puzzle={puzzle}
            open={isEditPuzzleDialogOpen}
            setOpen={setIsEditPuzzleDialogOpen}
          />
        )}
        {isDeletePuzzleDialogOpen && (
          <DeletePuzzleDialog
            workspaceSlug={workspaceSlug}
            puzzleId={puzzle.id}
            puzzleName={puzzle.name}
            isMetaPuzzle={puzzle.isMetaPuzzle}
            open={isDeletePuzzleDialogOpen}
            setOpen={setIsDeletePuzzleDialogOpen}
            onDeleted={() => void navigate({to: "/$workspaceSlug", params: {workspaceSlug}})}
          />
        )}
      </div>
      <PuzzleContext workspaceSlug={workspaceSlug} puzzle={puzzle} />
      <form.AppForm>
        {/* A property list: muted labels on the left, full-width controls on the right. */}
        <form.Form
          data-tour="puzzle-info"
          className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-3">
          <span className="text-muted self-start pt-2 text-xs">
            {puzzle.answerCount > 1 ? "Answers" : "Answer"}
          </span>
          {puzzle.answerCount > 1 ? (
            <MultiAnswers workspaceSlug={workspaceSlug} puzzle={puzzle} isReadOnly={isReadOnly} />
          ) : (
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
                      readOnly={isReadOnly}
                      className="font-mono whitespace-pre uppercase placeholder:font-sans placeholder:normal-case"
                      onKeyDown={e => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                  </InputGroup>
                </div>
              )}
            />
          )}
          <span className="text-muted text-xs">Status</span>
          <form.AppField
            name="status"
            listeners={{
              // The answer stays whatever the status (as on the board): moving a puzzle back to,
              // say, Extraction shouldn't throw away an answer someone typed. Clear it by hand.
              onChange: async () => {
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
                  isDisabled={isReadOnly}
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
                  isDisabled={isReadOnly}
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
          {isReadOnly ? (
            <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-1">
              {puzzle.tags.length > 0 ? (
                puzzle.tags.map(tag => (
                  <Chip key={tag} size="sm" variant="secondary">
                    {tag}
                  </Chip>
                ))
              ) : (
                <span className="text-muted text-sm">None</span>
              )}
            </div>
          ) : (
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
          )}
          <span className="text-muted text-xs">Solvers</span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <PuzzleContributorAvatars
              workspaceSlug={workspaceSlug}
              contributorIds={puzzle.contributorIds}
              max={5}
            />
            <HelpedToggle
              workspaceSlug={workspaceSlug}
              puzzleId={puzzle.id}
              contributorIds={puzzle.contributorIds}
            />
          </div>
        </form.Form>
      </form.AppForm>
      <PuzzleGuesses workspaceSlug={workspaceSlug} puzzleId={puzzle.id} />
      {puzzle.childPuzzles.length > 0 && (
        <PuzzleList
          workspaceSlug={workspaceSlug}
          title="Feeder answers"
          puzzles={puzzle.childPuzzles}
        />
      )}
      {siblings.length > 0 && (
        <PuzzleList workspaceSlug={workspaceSlug} title="Other feeders" puzzles={siblings} />
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

/** Where the puzzle sits: its round and (for a feeder) its meta, as links. */
function PuzzleContext({
  workspaceSlug,
  puzzle,
}: {
  workspaceSlug: string;
  puzzle: {roundId: string; parentPuzzleId: string | null};
}) {
  const workspace = useWorkspace();
  const round = workspace.rounds.find(r => r.id === puzzle.roundId);
  const meta = puzzle.parentPuzzleId
    ? round?.puzzles.find(p => p.id === puzzle.parentPuzzleId)
    : undefined;
  if (!round) return null;
  return (
    <nav
      aria-label="Puzzle location"
      className="text-muted flex min-w-0 items-center gap-1 px-3 pt-2 text-xs">
      <Link
        to="/$workspaceSlug"
        params={{workspaceSlug}}
        hash={round.id}
        className="hover:text-foreground min-w-0 truncate">
        {round.name}
      </Link>
      {meta && (
        <>
          <ChevronRightIcon className="size-3 shrink-0" aria-hidden />
          <Link
            to="/$workspaceSlug/puzzles/$puzzleId"
            params={{workspaceSlug, puzzleId: meta.id}}
            className="hover:text-foreground min-w-0 truncate">
            {meta.name}
          </Link>
        </>
      )}
    </nav>
  );
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[ch]!);

/**
 * Copies puzzles as a table, a header row then one puzzle per row (name, answers, letter count),
 * both as tab-separated text (pastes into a sheet's cells) and as an HTML table (pastes as a table
 * into docs, and into sheets that prefer it). Several answers share a cell, " · " between them.
 */
async function copyPuzzlesTable(puzzles: {name: string; answer: string | null}[]) {
  const rows = [
    ["Puzzle", "Answer", "Letters"],
    ...puzzles.map(p => {
      const answer = formatAnswers(p.answer);
      const letters = splitAnswers(p.answer)
        .map(a => a.replace(/[^\p{L}]/gu, "").length)
        .join(" · ");
      return [p.name, answer, letters];
    }),
  ].map(row => row.map(cell));
  const tsv = rows.map(row => row.join("\t")).join("\n");
  const html = `<table><thead><tr>${rows[0]!.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>${rows
    .slice(1)
    .map(row => `<tr>${row.map(c => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([tsv], {type: "text/plain"}),
        "text/html": new Blob([html], {type: "text/html"}),
      }),
    ]);
  } else {
    await navigator.clipboard.writeText(tsv);
  }
}

function cell(value: string) {
  return value.replace(/[\t\r\n]+/g, " ").trim();
}

/** A list of puzzles with their answers (a meta's feeders, a feeder's siblings), as links. */
function PuzzleList({
  workspaceSlug,
  title,
  puzzles,
}: {
  workspaceSlug: string;
  title: string;
  puzzles: {id: string; name: string; answer: string | null}[];
}) {
  const solved = puzzles.filter(p => p.answer).length;
  return (
    <section className="border-separator flex flex-col gap-1.5 border-t p-3" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-muted text-xs font-medium">
          {title}{" "}
          <span className="tabular-nums">
            ({solved}/{puzzles.length})
          </span>
        </h3>
        <Button
          size="sm"
          variant="ghost"
          className="-my-1.5 h-7 px-2 text-xs"
          aria-label={`Copy ${title.toLowerCase()} as a table`}
          onPress={() => {
            toast.promise(copyPuzzlesTable(puzzles), {
              success: `Copied a table of ${puzzles.length} ${puzzles.length === 1 ? "puzzle" : "puzzles"}: paste it into a sheet or doc`,
              error: "Couldn't copy to the clipboard",
            });
            track("feeder_table_copied", {rows: puzzles.length});
          }}>
          <CopyIcon className="size-3.5" />
          Copy table
        </Button>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {puzzles.map(child => (
          <li key={child.id} className="flex items-baseline justify-between gap-3">
            <Link
              to="/$workspaceSlug/puzzles/$puzzleId"
              params={{workspaceSlug, puzzleId: child.id}}
              className="min-w-0 truncate hover:underline">
              {child.name}
            </Link>
            <span
              className={cn(
                "shrink-0 font-mono text-xs",
                child.answer ? "text-success" : "text-muted"
              )}>
              {child.answer ? formatAnswers(child.answer) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A puzzle with several answers: a box for each. Committed when you leave a box (Enter does too);
 * once all are in, the puzzle is marked solved, as filling in a single answer does.
 */
function MultiAnswers({
  workspaceSlug,
  puzzle,
  isReadOnly,
}: {
  workspaceSlug: string;
  puzzle: {id: string; answer: string | null; answerCount: number; status: string | null};
  isReadOnly: boolean;
}) {
  const {mutate} = useMutation(workspaceMutations.puzzles.update());
  const found = splitAnswers(puzzle.answer);
  // While you're typing, your drafts; otherwise the puzzle's answers (as teammates change them).
  const [drafts, setDrafts] = useState<string[] | null>(null);
  const values = Array.from({length: puzzle.answerCount}, (_, i) => drafts?.[i] ?? found[i] ?? "");
  const commit = () => {
    if (drafts === null) return;
    const answer = joinAnswers(values);
    setDrafts(null);
    if (answer === (puzzle.answer || null)) return;
    mutate({workspaceSlug, id: puzzle.id, answer: answer ?? "", ...solvedByAnswer(answer, puzzle)});
  };
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {values.map((value, i) => (
        // oxlint-disable-next-line react/no-array-index-key -- the boxes are positions (answer 1, 2, …), not items.
        <InputGroup key={i} fullWidth variant="secondary">
          <InputGroup.Prefix className="text-muted w-6 justify-center text-xs tabular-nums">
            {i + 1}
          </InputGroup.Prefix>
          <InputGroup.Input
            aria-label={`Answer ${i + 1}`}
            placeholder="Not found yet"
            readOnly={isReadOnly}
            value={value}
            onChange={e => {
              const next = [...values];
              next[i] = e.target.value;
              setDrafts(next);
            }}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
          />
        </InputGroup>
      ))}
      <span className="text-muted text-xs tabular-nums">
        {found.length} of {puzzle.answerCount} found
      </span>
    </div>
  );
}

/**
 * Your time on this puzzle, ticking each second while it counts (this tab is in front of you) and
 * dimmed while it's paused. Also what records it (see `usePuzzleTimeTracker`).
 */
function PuzzleTimer({puzzleId}: {puzzleId: string}) {
  const {workspaceSlug} = Route.useParams();
  const {seconds, isCounting} = usePuzzleTimeTracker(workspaceSlug, puzzleId);
  return (
    // At the end of the bar (the tooltip trigger doesn't pass layout classes through).
    <div data-tour="timer" className="ms-auto flex shrink-0">
      <Tooltip delay={300}>
        <Tooltip.Trigger>
          <Chip
            size="sm"
            variant="secondary"
            aria-label={`Your time on this puzzle: ${seconds === undefined ? "loading" : formatPuzzleTime(seconds)}`}
            className={cn("gap-1 tabular-nums transition-opacity", !isCounting && "opacity-60")}>
            <TimerIcon className="size-3.5" />
            <Chip.Label>{seconds === undefined ? "–:––" : formatPuzzleTime(seconds)}</Chip.Label>
          </Chip>
        </Tooltip.Trigger>
        <Tooltip.Content>
          Your time on this puzzle. It counts while this tab is the one in front of you.
        </Tooltip.Content>
      </Tooltip>
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

/**
 * The puzzle's working surface: its sheet and a shared whiteboard, switched from a tab bar. The
 * sheet is the puzzle's Google sheet (or drawing) if it has one; otherwise it's the built-in
 * spreadsheet. Both stay mounted once opened, so
 * switching never reloads the sheet; the whiteboard only loads (and connects) when first opened.
 */
function WorksheetPane({
  puzzle,
  phone,
}: {
  puzzle: {
    id: string;
    name: string;
    link: string | null;
    googleSpreadsheetId: string | null;
    googleDrawingId: string | null;
  };
  /** On phones, chat and the details panel become tabs here too. */
  phone?: {chat: ReactNode; info: ReactNode};
}) {
  const navigate = useNavigate({from: Route.fullPath});
  const isReadOnly = useIsReadOnly();
  // A Google sheet (or drawing) made for this puzzle is shown even if the workspace has since
  // disconnected Drive (it still opens for anyone with access); other puzzles get the built-in one.
  const googleWorksheet = Boolean(puzzle.googleSpreadsheetId || puzzle.googleDrawingId);
  const defaultView = "sheet";
  const requested = Route.useSearch().view ?? defaultView;
  // Chat and details are only views on phones; a phone link opened on desktop shows the sheet.
  const view = !phone && (requested === "chat" || requested === "info") ? defaultView : requested;
  // Mount the whiteboard the first time it's shown, then keep it (and its connection) around.
  const [whiteboardOpened, setWhiteboardOpened] = useState(view === "whiteboard");
  if (view === "whiteboard" && !whiteboardOpened) setWhiteboardOpened(true);
  const sheetLabel =
    googleWorksheet && puzzle.googleDrawingId && !puzzle.googleSpreadsheetId ? "Drawing" : "Sheet";

  return (
    <>
      <div className="border-separator flex h-10 shrink-0 items-center border-b px-2">
        <Tabs
          selectedKey={view}
          className={cn(phone && "min-w-0 flex-1")}
          onSelectionChange={key => {
            const next = VIEWS.find(v => v === key) ?? "sheet";
            track("puzzle_view_switched", {view: next, phone});
            void navigate({search: prev => ({...prev, view: next}), replace: true});
          }}>
          <Tabs.ListContainer>
            <Tabs.List
              data-tour="puzzle-views"
              aria-label="Puzzle views"
              className={cn(phone ? "w-full" : "w-fit")}>
              <Tabs.Tab id="sheet" className={cn("h-7 px-3 text-xs", phone && "flex-1")}>
                {/* Phones: words only, so all four tabs fit next to the timer. */}
                {!phone && <SheetIcon className="me-1.5 size-3.5" />}
                <span>{sheetLabel}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="whiteboard" className={cn("h-7 px-3 text-xs", phone && "flex-1")}>
                {!phone && <PresentationIcon className="me-1.5 size-3.5" />}
                <span>Whiteboard</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              {phone && (
                <>
                  <Tabs.Tab id="chat" className="h-7 flex-1 px-3 text-xs">
                    <span>Chat</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="info" className="h-7 flex-1 px-3 text-xs">
                    <span>Info</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </>
              )}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <PuzzleTimer puzzleId={puzzle.id} />
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col", view !== "sheet" && "hidden")}>
        {googleWorksheet ? (
          <WorksheetFrame
            // A new puzzle gets a fresh frame (and loading state), and so does archiving.
            key={`${puzzle.id}${isReadOnly ? ":read-only" : ""}`}
            title={`${puzzle.name} ${puzzle.googleSpreadsheetId ? "spreadsheet" : "drawing"}`}
            src={
              // Archived: Google's read-only preview, since WOW can't stop edits inside Google's own
              // editor (anyone with access to the file could still change it there).
              isReadOnly
                ? `${googleFileUrl(puzzle)}/preview`
                : `${googleFileUrl(puzzle)}/edit?widget=true&chrome=false&rm=embedded`
            }
            openHref={`${googleFileUrl(puzzle)}/${isReadOnly ? "preview" : "edit"}`}
          />
        ) : (
          <PuzzleSheet key={puzzle.id} puzzleId={puzzle.id} />
        )}
      </div>
      {whiteboardOpened && (
        <div
          className={cn(
            // Fills exactly what the panel has: a computed height overflowed the page.
            "flex min-h-0 flex-1 flex-col",
            view !== "whiteboard" && "hidden"
          )}>
          <PuzzleWhiteboard puzzleId={puzzle.id} />
        </div>
      )}
      {phone && (
        <>
          {/* Kept mounted (hidden) so chat keeps its connection and unread history. */}
          <div className={cn("flex min-h-0 flex-1 flex-col", view !== "chat" && "hidden")}>
            {phone.chat}
          </div>
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 overflow-auto",
              view !== "info" && "hidden"
            )}>
            {phone.info}
          </div>
        </>
      )}
    </>
  );
}

const VIEWS = ["sheet", "whiteboard", "chat", "info"] as const;

/** Google can be slow to answer; after this long, offer a retry or a new tab. */
const SLOW_SHEET_MS = 15_000;

/**
 * The Google Sheet/Drawing, with a placeholder until it has loaded (instead of a blank white
 * frame), and a way out if it's slow.
 */
function WorksheetFrame({title, src, openHref}: {title: string; src: string; openHref: string}) {
  // When the current load started (a retry starts a new one, with a fresh frame).
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (loaded) return undefined;
    const timer = setTimeout(() => setSlow(true), startedAt + SLOW_SHEET_MS - Date.now());
    return () => clearTimeout(timer);
  }, [loaded, startedAt]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* oxlint-disable-next-line react/iframe-missing-sandbox -- trusted Google Sheets/Drawings editor that needs scripts, same-origin storage, popups (sign-in, share) and top navigation; any sandbox would break it. */}
      <iframe
        key={startedAt}
        title={title}
        src={src}
        allow="fullscreen; geolocation; microphone; camera; payment"
        onLoad={() => setLoaded(true)}
        className="h-full w-full flex-1"
      />
      {!loaded && (
        <div className="bg-surface absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <Spinner aria-label="Loading the sheet" />
          <p className="text-muted text-sm">
            {slow ? "Google is taking a while…" : "Loading the sheet…"}
          </p>
          {slow && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  setSlow(false);
                  setStartedAt(Date.now());
                }}>
                Retry
              </Button>
              <a
                href={openHref}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({size: "sm", variant: "ghost"})}>
                Open in a new tab
                <ExternalLinkIcon />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
