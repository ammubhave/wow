import {
  Button,
  buttonVariants,
  Chip,
  Dropdown,
  InputGroup,
  Label,
  ListBox,
  Tooltip,
} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {Link} from "@tanstack/react-router";
import {
  ChevronRightIcon,
  CopyIcon,
  EditIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  LinkIcon,
  TableIcon,
  TrashIcon,
} from "lucide-react";
import {type ReactNode, useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {CommentBox} from "@/components/comment-box";
import {DeletePuzzleDialog} from "@/components/delete-puzzle-dialog";
import {EditPuzzleDialog} from "@/components/edit-puzzle-dialog";
import {useAppForm} from "@/components/form";
import {PuzzleGuesses} from "@/components/guess-queue";
import {IconButton} from "@/components/icon-button";
import {PuzzleName} from "@/components/page-transition";
import {HelpedToggle, PuzzleContributorAvatars} from "@/components/puzzle-contributors";
import {SolveSpark} from "@/components/solve-spark";
import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {useWorkspace} from "@/hooks/use-workspace";
import {track} from "@/lib/analytics";
import {formatAnswers, joinAnswers, solvedByAnswer, splitAnswers} from "@/lib/answers";
import {
  getColorClassNamesForPuzzleImportances,
  getPuzzleImportances,
} from "@/lib/puzzleImportances";
import {
  getBgColorClassNamesForPuzzleStatusNoHover,
  getPuzzleStatusGroups,
  getPuzzleStatusOptions,
} from "@/lib/puzzleStatuses";
import {workspaceMutations} from "@/lib/workspace-mutations";

/**
 * A puzzle's details beside its sheet: answer, status, importance, tags, who helped, guesses, notes,
 * and where it sits (round, meta, feeders), each editable in place. On the puzzle page, and in the
 * Chrome extension's sidebar on the hunt's own page for it.
 */
export function PuzzleInfoPanel({
  workspaceSlug,
  puzzle,
  shareUrl,
  onDeleted,
  primaryLink,
  headerEnd,
}: {
  workspaceSlug: string;
  /** The puzzle's page in WOW, for "Copy link". */
  shareUrl: string;
  /** After the puzzle is deleted from here. */
  onDeleted: () => void;
  /**
   * The header's labelled link. By default "Open puzzle" (the hunt's page); the Chrome extension,
   * shown on that page, links to the puzzle in WOW instead.
   */
  primaryLink?: ReactNode;
  /** More header controls, at its end (the extension's collapse button). */
  headerEnd?: ReactNode;
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
          <PuzzleName puzzleId={puzzle.id} name={puzzle.name} />
        </h2>
        {/* Reading the puzzle is what people come here for, so it's a labelled button. */}
        {primaryLink !== undefined
          ? primaryLink
          : puzzle.link && (
              <a
                data-tour="open-puzzle"
                className={buttonVariants({
                  variant: "secondary",
                  size: "sm",
                  className: "shrink-0",
                })}
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
        <Dropdown>
          <IconButton size="sm" variant="ghost" label="Puzzle actions">
            <EllipsisIcon />
          </IconButton>
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
                  void navigator.clipboard.writeText(shareUrl).then(
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
            onDeleted={onDeleted}
          />
        )}
        {headerEnd}
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
                  // The trigger carries the status colour, as rows do on the blackboard ("None": muted).
                  className={cn(
                    getBgColorClassNamesForPuzzleStatusNoHover(field.state.value || null),
                    !field.state.value && "text-muted"
                  )}
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
                  // Quiet unless it needs attention: only "Important" carries a colour.
                  className={
                    field.state.value === "important"
                      ? getColorClassNamesForPuzzleImportances(field.state.value)
                      : "text-muted"
                  }
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
      <div className="p-3">
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
    <section className="flex flex-col gap-1.5 p-3" aria-label={title}>
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

/** An icon-only link in the panel header, labelled by a tooltip. */
export function PanelLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
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
