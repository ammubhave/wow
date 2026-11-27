import {EmptyState} from "@heroui-pro/react";
import {
  Button,
  buttonVariants,
  Chip,
  Dropdown,
  IconChevronDown,
  Kbd,
  Label,
  ListBox,
  ProgressBar,
  SearchField,
  Select,
  selectVariants,
  Separator,
  Table,
  TableLayout,
  ToggleButton,
  Tooltip,
  Virtualizer,
  type Key,
  type Selection,
} from "@heroui/react";
import NumberFlow from "@number-flow/react";
import {useIsMutating, useMutation, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {sha256} from "js-sha256";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleCheckBigIcon,
  CircleCheckIcon,
  EllipsisIcon,
  GripVerticalIcon,
  MoveIcon,
  ListPlusIcon,
  PlusIcon,
  PuzzleIcon,
  SearchXIcon,
  SignalHighIcon,
  SignalIcon,
  SignalMediumIcon,
  StarIcon,
  TagIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import {createContext, memo, useContext, useEffect, useMemo, useRef, useState} from "react";
import {DropIndicator, type DropTarget, useDragAndDrop} from "react-aria-components";
import {cn} from "tailwind-variants";
import {useLocalStorage, useMediaQuery} from "usehooks-ts";

import {AddNewMetaPuzzleDialog} from "@/components/add-new-meta-puzzle-dialog";
import {AddNewPuzzleDialog} from "@/components/add-new-puzzle-dialog";
import {AddNewRoundDialog} from "@/components/add-new-round-dialog";
import {AppSidebar, SidebarDrawerButton, TeamChatDrawerButton} from "@/components/app-sidebar";
import {AssignUnassignedPuzzlesDialog} from "@/components/assign-unassigned-puzzles-dialog";
import {DeletePuzzleDialog} from "@/components/delete-puzzle-dialog";
import {DeleteRoundDialog} from "@/components/delete-round-dialog";
import {EditPuzzleDialog} from "@/components/edit-puzzle-dialog";
import {EditRoundDialog} from "@/components/edit-round-dialog";
import {useAppForm} from "@/components/form";
import {IconButton, IconTooltip, NativeTooltip} from "@/components/icon-button";
import {MovePuzzleDialog} from "@/components/move-puzzle-dialog";
import {BoardSkeleton} from "@/components/page-skeletons";
import {SolveSpark} from "@/components/solve-spark";
import {TeammateChangeFlash} from "@/components/teammate-change-flash";
import {UserPresenceAvatars} from "@/components/user-hover-card";
import {NO_PRESENCES} from "@/features/presences/presences";
import {VoiceRoomBadge} from "@/features/voice/voice-ui";
import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {useWorkspace} from "@/hooks/use-workspace";
import {formatAnswers, parseTypedAnswers, solvedByAnswer, splitAnswers} from "@/lib/answers";
import {isWithin as feedsInto} from "@/lib/board-order";
import {orpc} from "@/lib/orpc";
import {
  getColorClassNamesForPuzzleImportances,
  getPuzzleImportances,
} from "@/lib/puzzleImportances";
import {
  getBgColorClassNamesForPuzzleStatus,
  getPuzzleStatusGroups,
  getPuzzleStatusOptions,
} from "@/lib/puzzleStatuses";
import {setFavoritesMutationOptions, workspaceMutations} from "@/lib/workspace-mutations";
import {WorkspaceRoomState} from "@/server/do/workspace";
import type {RouterInputs} from "@/server/router";
import {useAppSelector} from "@/store";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/")({
  component: RouteComponent,
  // Its data comes with the workspace (the layout's loader); this covers its code loading.
  pendingComponent: BoardSkeleton,
});

// The board is HeroUI's Table (React Aria's): rounds, their metas and feeders form a tree, so rows
// indent, expand and collapse natively, and the same collection supports drag and drop. Cells are
// denser than HeroUI's default; the "secondary" variant keeps them transparent so the row status
// colors show through.

// The table is virtualized, so React Aria lays it out: columns have set widths (a hidden column
// gets 0) and rows a set height.
const ROW_HEIGHT = 37;
const HEADING_HEIGHT = 40;
/** The row buttons: up to three (a meta's favorite, + and ⋯); phones show only the ⋯. */
const ACTIONS_WIDTH = 124;
const PHONE_ACTIONS_WIDTH = 52;
const columnWidth = (width: number) => ({width, minWidth: width, maxWidth: width});

/** Board width below which "Working on this" is dropped, so the row menus stay on screen. */
const NARROW_BOARD = 860;
/** Hidden while the board is narrow (the table root then has `data-narrow`). */
const NARROW_HIDDEN = "in-data-narrow:hidden";

// Columns that only fit on wider screens: on phones the board is name, answer and status (their
// columns are 0 wide there).
const DESKTOP_ONLY = "max-md:hidden";
/** Phones: the Answer column (0 wide there; phones show the answer under the name instead). */
const PHONE_COLLAPSED = "max-md:p-0 max-md:*:hidden";
/** Narrower than the md breakpoint (the board's phone layout). */
const useIsPhone = () => !useMediaQuery("(min-width: 768px)");
// Cells are divs (the table is virtualized), so they center their content themselves.
const CELL = "flex items-center p-2 text-xs whitespace-nowrap";
const COLUMN = "flex h-full items-center px-2 whitespace-nowrap";

/** The rows under a round: its metas, then (if any) its unassigned puzzles as a group. */
type UnassignedGroup = {
  id: string;
  kind: "unassigned";
  roundId: string;
  puzzles: WorkspaceRoomState["rounds"][0]["unassignedPuzzles"];
};
type RoundChild = WorkspaceRoomState["rounds"][0]["topLevelMetaPuzzles"][0] | UnassignedGroup;
const unassignedGroupId = (roundId: string) => `unassigned-${roundId}`;

/** Expand/collapse chevron for a tree row (React Aria toggles the row via `slot="chevron"`). */
function RowChevron({
  label,
  isExpanded,
  color,
}: {
  label: string;
  isExpanded: boolean;
  color?: string;
}) {
  return (
    <IconButton
      slot="chevron"
      variant="ghost"
      size="sm"
      label={label}
      className="-my-2 -ms-1 size-6 min-w-6 shrink-0 select-none"
      style={color ? {color} : undefined}>
      <ChevronRightIcon className={cn("size-3.5 transition", isExpanded && "rotate-90")} />
    </IconButton>
  );
}

/**
 * The tree column: a narrow column of its own for the chevrons and the lines linking feeders to
 * their meta, so every name starts in the same place whatever its depth. (HeroUI indents a tree
 * column by depth; this one stays put.)
 */
const TREE_CELL = "relative flex items-center justify-center p-0 ps-0!";

/**
 * One meta's line through a row, in the meta's colour: across to the name of a row it feeds
 * (`branch`, or `last` for its last feeder, where the line ends), or straight down past a row
 * deeper in its tree (`pass`).
 */
type TreeLineKind = "pass" | "branch" | "last";
function TreeLine({color, kind}: {color: string; kind: TreeLineKind}) {
  return (
    <span aria-hidden className="absolute inset-0">
      <span
        className={cn("absolute left-1/2 w-px", kind === "last" ? "top-0 h-1/2" : "inset-y-0")}
        style={{backgroundColor: color}}
      />
      {kind !== "pass" && (
        <span className="absolute top-1/2 right-0 left-1/2 h-px" style={{backgroundColor: color}} />
      )}
    </span>
  );
}

/**
 * A row's place in a meta inside a meta: the lines of the metas above its own, outermost first.
 * Each is a meta id (its line carries on down past this row) or `-` (that meta's feeders ended
 * above). A string, so it's cheap to compare when rows are memoized.
 */
type OuterLines = string;
function outerLineKinds(outer: OuterLines) {
  return outer === ""
    ? []
    : outer
        .split(" ")
        .map(id => (id === "-" ? null : {color: metaColor(id), kind: "pass" as const}));
}

/**
 * The tree, drawn across two places: the tree column has the outermost meta's line, and each
 * deeper meta's line gets a slot in front of the name, so a meta inside a meta and its feeders sit
 * one step in from the meta they feed.
 */
function NameIndent({lines}: {lines: ({color: string; kind: TreeLineKind} | null)[]}) {
  return lines.map((line, i) => (
    // oxlint-disable-next-line react/no-array-index-key -- a slot per depth; position is the identity.
    <span key={i} className="relative -my-2 me-1 w-6 shrink-0 self-stretch">
      {line && <TreeLine {...line} />}
    </span>
  ));
}

/** A meta's colour, shared by the meta's dot and its feeders' bars. */
function metaColor(id: string) {
  const hash = sha256(id);
  let hue = parseInt(hash.substring(0, 4), 16) % (360 - 150);
  if (hue > 30) hue += 150;
  const saturation = (parseInt(hash.substring(4, 6), 16) / 255.0) ** 0.5 * 80 + 50;
  // 45–65%: dark enough on the light theme, light enough to see on the dark one.
  const lightness = (parseInt(hash.substring(6, 8), 16) / 255.0) * 20 + 45;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** True while the board is in Arrange mode (rows can be dragged). */
const ArrangingContext = createContext(false);

/**
 * True when the workspace is read-only (archived): cells show their values without editors and the
 * menus leave out what would change things. A context (not each row reading the workspace) so rows
 * stay memoized.
 */
const ReadOnlyContext = createContext(false);
/** Each round's solved and total puzzle counts, by round id. */
const RoundProgressContext = createContext<ReadonlyMap<string, {solved: number; total: number}>>(
  new Map()
);

type BoardPuzzle = React.ComponentProps<typeof EditPuzzleDialog>["puzzle"];

/** The board's dialogs, opened from the toolbar, the header row and the rows' + buttons and menus. */
type BoardDialog =
  | {kind: "add-round"}
  | {kind: "add-meta"; roundId: string}
  | {kind: "add-puzzle"; roundId?: string; parentPuzzleId?: string}
  | {kind: "edit-round"; round: {id: string; name: string}}
  | {kind: "delete-round"; roundId: string; roundName: string; puzzleCount: number}
  | {kind: "assign-unassigned"; roundId: string}
  | {kind: "edit-puzzle" | "move-puzzle" | "delete-puzzle"; puzzle: BoardPuzzle};

const OpenBoardDialogContext = createContext<(dialog: BoardDialog) => void>(() => {});

/**
 * The puzzle as it is now, not as it was when its dialog opened: a teammate may have changed it
 * since (the dialogs show and act on it), or deleted it (which closes the dialog).
 */
function LivePuzzle({
  id,
  onGone,
  children,
}: {
  id: string;
  onGone: () => void;
  children: (puzzle: BoardPuzzle) => React.ReactNode;
}) {
  const workspace = useWorkspace();
  const puzzle = workspace.rounds.flatMap(round => round.puzzles).find(p => p.id === id);
  useEffect(() => {
    if (!puzzle) onGone();
  }, [puzzle, onGone]);
  return puzzle ? children(puzzle) : null;
}

// Opening a dialog only re-renders this: `children` is the same element, so the board (and React
// Aria's table, which rebuilds when any row changes) stays as it is. Keeping the open state on the
// page or in a row made opening one take a noticeable moment on a big board.
function BoardDialogs({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const [dialog, setDialog] = useState<BoardDialog | null>(null);
  const setOpen = (open: boolean) => {
    if (!open) setDialog(null);
  };
  return (
    <OpenBoardDialogContext.Provider value={setDialog}>
      {children}
      {dialog?.kind === "add-round" && (
        <AddNewRoundDialog workspaceSlug={workspaceSlug} open setOpen={setOpen} />
      )}
      {dialog?.kind === "add-meta" && (
        <AddNewMetaPuzzleDialog
          workspaceSlug={workspaceSlug}
          roundId={dialog.roundId}
          open
          setOpen={setOpen}
        />
      )}
      {dialog?.kind === "add-puzzle" && (
        <AddNewPuzzleDialog
          workspaceSlug={workspaceSlug}
          roundId={dialog.roundId}
          parentPuzzleId={dialog.parentPuzzleId}
          open
          setOpen={setOpen}
        />
      )}
      {dialog?.kind === "edit-round" && (
        <EditRoundDialog
          workspaceSlug={workspaceSlug}
          round={dialog.round}
          open
          setOpen={setOpen}
        />
      )}
      {dialog?.kind === "delete-round" && (
        <DeleteRoundDialog
          workspaceSlug={workspaceSlug}
          roundId={dialog.roundId}
          roundName={dialog.roundName}
          puzzleCount={dialog.puzzleCount}
          open
          setOpen={setOpen}
        />
      )}
      {dialog?.kind === "assign-unassigned" && (
        <AssignUnassignedPuzzlesDialog
          workspaceSlug={workspaceSlug}
          roundId={dialog.roundId}
          open
          setOpen={setOpen}
        />
      )}
      {(dialog?.kind === "edit-puzzle" ||
        dialog?.kind === "move-puzzle" ||
        dialog?.kind === "delete-puzzle") && (
        <LivePuzzle id={dialog.puzzle.id} onGone={() => setDialog(null)}>
          {puzzle =>
            dialog.kind === "edit-puzzle" ? (
              <EditPuzzleDialog
                workspaceSlug={workspaceSlug}
                puzzle={puzzle}
                open
                setOpen={setOpen}
              />
            ) : dialog.kind === "move-puzzle" ? (
              <MovePuzzleDialog
                workspaceSlug={workspaceSlug}
                puzzle={puzzle}
                open
                setOpen={setOpen}
              />
            ) : (
              <DeletePuzzleDialog
                workspaceSlug={workspaceSlug}
                puzzleId={puzzle.id}
                puzzleName={puzzle.name}
                isMetaPuzzle={puzzle.isMetaPuzzle}
                open
                setOpen={setOpen}
              />
            )
          }
        </LivePuzzle>
      )}
    </OpenBoardDialogContext.Provider>
  );
}

/**
 * Smooths a collapse or expand: call it just before the rows change. Rows that stay slide from
 * where they were, rows that appear under an expanded row fade in, and rows that scroll in from
 * below as one collapses slide up with the rest.
 */
function animateRowMoves(scroller: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rows = () => scroller.querySelectorAll<HTMLElement>("[role=row][data-key]");
  // Where each row is now, without the slide of a toggle that's still animating.
  for (const row of rows()) for (const animation of row.getAnimations()) animation.cancel();
  const before = new Map(
    [...rows()].map(row => [row.dataset.key, row.getBoundingClientRect().top])
  );
  // Runs after React has rendered the change but before it's painted.
  requestAnimationFrame(() => {
    let lastKept: {top: number; delta: number} | null = null;
    const appeared: HTMLElement[] = [];
    for (const row of rows()) {
      const top = row.getBoundingClientRect().top;
      const old = before.get(row.dataset.key);
      if (old === undefined) {
        appeared.push(row);
      } else {
        if (!lastKept || top > lastKept.top) lastKept = {top, delta: old - top};
        if (old !== top) {
          row.animate([{transform: `translateY(${old - top}px)`}, {transform: "none"}], {
            duration: 200,
            easing: "ease-out",
          });
        }
      }
    }
    for (const row of appeared) {
      const top = row.getBoundingClientRect().top;
      if (lastKept && top > lastKept.top && lastKept.delta > 0) {
        row.animate([{transform: `translateY(${lastKept.delta}px)`}, {transform: "none"}], {
          duration: 200,
          easing: "ease-out",
        });
      } else {
        row.animate(
          [
            {opacity: 0, transform: "translateY(-6px)"},
            {opacity: 1, transform: "none"},
          ],
          {duration: 200, easing: "ease-out"}
        );
      }
    }
  });
}

/** The drag handle shown in Arrange mode (React Aria starts a drag from `slot="drag"`). */
function DragHandle({label}: {label: string}) {
  return (
    <IconButton
      slot="drag"
      variant="ghost"
      size="sm"
      label={`Drag ${label}`}
      // `!`: HeroUI's button sets its own cursor, which would otherwise win.
      className="text-muted !cursor-grab active:!cursor-grabbing">
      <GripVerticalIcon className="size-4" />
    </IconButton>
  );
}

const TAG_COLORS = [
  "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
];

function hashTag(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getTagColor(tag: string): string {
  const index = hashTag(tag) % TAG_COLORS.length;
  return TAG_COLORS[index]!;
}

// Trigger classes for the in-cell Selects (shared by each stand-in and its real Select).
const SELECT_TRIGGER_CLASS =
  "-my-2 h-auto rounded-none border-0 bg-transparent p-2 shadow-none hover:bg-accent-soft focus:bg-accent-soft focus:outline-none";
const PUZZLE_STATUS_TRIGGER_CLASS =
  "-my-2 h-auto rounded-none border-0 bg-transparent p-2 shadow-none hover:bg-accent-soft focus:bg-accent-soft focus:outline-none";
const IMPORTANCE_TRIGGER_CLASS =
  "-my-2 h-auto w-auto rounded-none border-0 bg-transparent p-2 shadow-none hover:bg-accent-soft focus:bg-accent-soft focus:outline-none";

// Sentinel id used by HeroUI ListBox/Select for the `null` status option, since
// React Aria collection item ids cannot be null.
const NONE_KEY = "__none__";

// Maps a collection key back to its value, translating the `NONE_KEY` sentinel to `null`.
function fromKey(key: Key | null): string | null {
  return key === null || key === NONE_KEY ? null : String(key);
}

// `favoritePuzzleIds` is an untyped JSON column, so narrow it to the string ids we store.
function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// Filters return the original array when nothing was removed, so rows whose data didn't change
// receive identical props and are skipped by memoization.
function filtered<T>(items: T[], keep: (item: T) => boolean) {
  const result = items.filter(keep);
  return result.length === items.length ? items : result;
}

/**
 * Toggles one puzzle in the member's favorites. The current list is read from the query cache at
 * press time (not captured at render), so toggling two rows in quick succession can't drop the
 * first change, and rows don't need to subscribe to the favorites query just to build the list.
 */
function useToggleFavorite(workspaceSlug: string) {
  const queryClient = useQueryClient();
  const {mutate} = useMutation(setFavoritesMutationOptions());
  return (puzzleId: string, isFavorite: boolean) => {
    const queryKey = orpc.workspaces.members.get.queryKey({input: {workspaceSlug}});
    const others = toStringArray(queryClient.getQueryData(queryKey)?.favoritePuzzleIds).filter(
      id => id !== puzzleId
    );
    mutate({workspaceSlug, favoritePuzzleIds: isFavorite ? [...others, puzzleId] : others});
  };
}

/** True while this row's optimistic create hasn't been confirmed (it can't be edited yet). */
function useIsBeingCreated(
  id: string,
  mutationKey: readonly unknown[] = orpc.puzzles.create.mutationKey()
) {
  return (
    useIsMutating({
      mutationKey,
      predicate: ({state: {variables}}) =>
        typeof variables === "object" &&
        variables !== null &&
        "id" in variables &&
        variables.id === id,
    }) > 0
  );
}

const ANSWER_INPUT_CLASS =
  "absolute inset-0 items-center px-2 font-mono break-all whitespace-normal uppercase hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:outline-none";

/**
 * Shows the (optimistic) answer; while focused it edits a local draft, committed on blur or Enter
 * (Escape discards it). Committing per keystroke would log half-typed answers to the activity feed.
 * A puzzle with several answers shows them as "FOO · BAR" and edits them as "FOO; BAR".
 */
function AnswerInput({
  puzzleName,
  value,
  count,
  onCommit,
}: {
  puzzleName: string;
  value: string | null;
  /** How many answers the puzzle has. */
  count: number;
  onCommit: (answer: string) => void;
}) {
  const isReadOnly = useContext(ReadOnlyContext);
  const [draft, setDraft] = useState<string | null>(null);
  const isMulti = count > 1;
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const answer = isMulti ? (parseTypedAnswers(draft) ?? "") : draft.toUpperCase();
    if (answer !== (value ?? "")) onCommit(answer);
  };
  const found = splitAnswers(value).length;
  if (isReadOnly) {
    return (
      <span className="absolute inset-0 flex items-center px-2 font-mono break-all whitespace-normal uppercase">
        {isMulti ? formatAnswers(value) : value}
      </span>
    );
  }
  return (
    <input
      aria-label={`Answer for ${puzzleName}`}
      className={ANSWER_INPUT_CLASS}
      placeholder={isMulti ? `${found}/${count} answers` : undefined}
      title={isMulti ? `${found} of ${count} answers; separate them with ;` : undefined}
      value={draft ?? (isMulti ? formatAnswers(value) : (value ?? ""))}
      onFocus={() => {
        if (isMulti) setDraft(splitAnswers(value).join("; "));
      }}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") setDraft(null);
      }}
    />
  );
}

/** The tag chips; pressing them opens an editor that saves each added/removed tag immediately. */
function TagsCell({
  puzzleName,
  value,
  tags,
  onCommit,
}: {
  puzzleName: string;
  value: string[];
  tags: string[];
  onCommit: (tags: string[]) => void;
}) {
  const isReadOnly = useContext(ReadOnlyContext);
  const [isEditing, setIsEditing] = useState(false);
  const form = useAppForm({defaultValues: {tags: value}});
  if (isReadOnly) {
    return (
      <div className="flex h-full w-full items-center gap-1 overflow-hidden p-1">
        {value.map(tag => (
          <Chip key={tag} size="sm" className={getTagColor(tag)}>
            {tag}
          </Chip>
        ))}
      </div>
    );
  }
  if (!isEditing) {
    return (
      <button
        type="button"
        // Named explicitly: with no tags the button would otherwise have no accessible name.
        aria-label={`Edit tags for ${puzzleName}${value.length > 0 ? `: ${value.join(", ")}` : ""}`}
        onClick={() => {
          // Start from the latest tags, which may have changed since the last edit.
          form.reset({tags: value});
          setIsEditing(true);
        }}
        className="hover:bg-accent-soft flex h-full w-full cursor-text items-center gap-1 overflow-hidden p-1">
        {value.map(tag => (
          <Chip key={tag} size="sm" className={getTagColor(tag)}>
            {tag}
          </Chip>
        ))}
      </button>
    );
  }
  return (
    <form.AppField
      name="tags"
      listeners={{onChange: ({value: next}) => onCommit(next), onBlur: () => setIsEditing(false)}}
      children={field => (
        <field.ComboboxMultipleField
          defaultOpen
          onOpenChange={isOpen => {
            if (!isOpen) setIsEditing(false);
          }}
          className="bg-accent-soft border-0"
          items={tags}
        />
      )}
    />
  );
}

type DeferredSelectProps = {
  autoFocus: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

/**
 * Every board row has a status and an importance Select, and a react-aria Select builds its whole
 * option collection even while closed, which dominates the board's initial mount. Until the user
 * first reaches for one, this renders a plain button with the same markup and classes as the HeroUI
 * Select (so it looks, and Ctrl+F-searches, identically), then swaps in the real Select:
 * - mouse hover mounts it silently, so the click itself lands on the real trigger;
 * - keyboard focus mounts it focused;
 * - a click, tap, or screen-reader activation mounts it focused, then opens it.
 * Once mounted it stays mounted.
 */
function DeferredSelect({
  "aria-label": ariaLabel,
  valueText,
  triggerClassName,
  value,
  showIndicator = true,
  children,
}: {
  "aria-label": string;
  /** Text of the selected option, for the stand-in's accessible name. */
  valueText: string;
  triggerClassName: string | undefined;
  /** What the real `Select.Value` would render. */
  value: React.ReactNode;
  showIndicator?: boolean;
  children: (props: DeferredSelectProps) => React.ReactNode;
}) {
  const isReadOnly = useContext(ReadOnlyContext);
  const [activation, setActivation] = useState<{autoFocus: boolean} | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const slots = selectVariants();
  if (isReadOnly) {
    // Just the value, looking as it does in the Select, with nothing to press.
    return (
      <div data-slot="select" className={slots.base()}>
        <div
          data-slot="select-trigger"
          className={cn(slots.trigger(), triggerClassName, "pointer-events-none")}>
          <span data-slot="select-value" className={slots.value()}>
            {value}
          </span>
          {typeof value !== "string" && (
            <span className="sr-only">{`${ariaLabel}: ${valueText}`}</span>
          )}
        </div>
      </div>
    );
  }
  if (activation) {
    return children({autoFocus: activation.autoFocus, isOpen, onOpenChange: setIsOpen});
  }
  const activateAndOpen = () => {
    setActivation({autoFocus: true});
    // Open on the next frame, once the real trigger has mounted and taken focus, so the popover
    // records it as the element to return focus to on close.
    requestAnimationFrame(() => setIsOpen(true));
  };
  return (
    <div data-slot="select" className={slots.base()}>
      <button
        type="button"
        data-slot="select-trigger"
        aria-label={valueText ? `${valueText} ${ariaLabel}` : ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={false}
        className={cn(slots.trigger(), triggerClassName)}
        onPointerEnter={e => {
          if (e.pointerType === "mouse") setActivation({autoFocus: false});
        }}
        onPointerDown={e => {
          // Only reached if the click beat the hover-triggered swap.
          if (e.pointerType === "mouse") activateAndOpen();
        }}
        onFocus={e => {
          if (e.currentTarget.matches(":focus-visible")) setActivation({autoFocus: true});
        }}
        onClick={activateAndOpen}>
        <span data-slot="select-value" className={slots.value()}>
          {value}
        </span>
        {showIndicator && (
          <IconChevronDown data-slot="select-default-indicator" className={slots.indicator()} />
        )}
      </button>
    </div>
  );
}

const PUZZLE_STATUS_OPTIONS = getPuzzleStatusOptions();

function PuzzleStatusSelect({
  value,
  onChange,
  triggerClassName,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  triggerClassName: string | undefined;
}) {
  const label = PUZZLE_STATUS_OPTIONS.find(option => option.value === value)?.label ?? "";
  return (
    <SolveSpark isSolved={isSolvedStatus(value)}>
      <DeferredSelect
        aria-label="Status"
        valueText={label}
        value={label}
        triggerClassName={triggerClassName}>
        {deferred => (
          <Select
            {...deferred}
            aria-label="Status"
            value={value ?? NONE_KEY}
            onChange={key => onChange(fromKey(key))}>
            <Select.Trigger className={triggerClassName}>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {getPuzzleStatusGroups().map(group => (
                  <ListBox.Section key={group.groupLabel} className={group.bgColorNoHover}>
                    {group.values.map(option => (
                      <ListBox.Item
                        key={option.value ?? NONE_KEY}
                        id={option.value ?? NONE_KEY}
                        textValue={option.label}>
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox.Section>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        )}
      </DeferredSelect>
    </SolveSpark>
  );
}

// Unfavorited stars only show on row hover (or keyboard focus) to cut clutter; favorites always show.
// Touch screens can't hover, so there the star always shows (faintly), or it couldn't be found.
// On phones an unstarred star is left out, so the pinned row menu stays narrow (star from the puzzle
// page there).
const FAVORITE_HIDDEN_CLASS =
  "opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-50 max-md:hidden";

const isSolvedStatus = (status: string | null) => status === "solved" || status === "backsolved";

/**
 * Row color by status. Solved rows stay quiet (muted text, no fill) so the puzzles that still need
 * work stand out; only states that call for attention (needs eyes, extraction, stuck, …) get color.
 */
function getRowClassNamesForStatus(status: string | null) {
  return isSolvedStatus(status) ? "text-muted" : getBgColorClassNamesForPuzzleStatus(status);
}

/** Phones: the answer, under the puzzle's name (the Answer column is desktop-only). */
function PhoneAnswer({answer}: {answer: string | null}) {
  if (!answer) return null;
  return (
    <span className="text-muted block truncate font-mono text-[11px] font-normal md:hidden">
      {formatAnswers(answer)}
    </span>
  );
}

/** The small check that marks a solved puzzle next to its name. */
function SolvedMark({status}: {status: string | null}) {
  if (!isSolvedStatus(status)) return null;
  return (
    <CheckIcon aria-label="Solved" className="text-success me-1.5 inline size-3.5 align-[-2px]" />
  );
}

/**
 * Importance only matters while a puzzle is unsolved, so it only styles unsolved rows (subtly):
 * obsolete ones recede (until hovered or edited), important ones get a thin accent edge and
 * slightly heavier text. Solved rows look the same whatever their importance.
 */
function getRowClassNamesForImportance(importance: string | null, status: string | null) {
  if (isSolvedStatus(status)) return "";
  if (importance === "obsolete") {
    return "opacity-60 transition-opacity hover:opacity-100 focus-within:opacity-100";
  }
  if (importance === "important") {
    return "font-medium [&>td:first-child]:shadow-[inset_2px_0_0_var(--color-accent)]";
  }
  return "";
}

/** The importance cell's color, likewise only for unsolved puzzles. */
function getImportanceCellClassNames(importance: string | null, status: string | null) {
  return isSolvedStatus(status) ? "" : getColorClassNamesForPuzzleImportances(importance);
}

// Unset importance: a ghost of "Normal" (instead of Select's "Select an item" placeholder).
const UNSET_IMPORTANCE_ICON = <SignalHighIcon aria-hidden="true" className="opacity-25" />;

function PuzzleImportanceSelect({
  value,
  onChange,
  triggerClassName,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  triggerClassName: string | undefined;
}) {
  const selected = getPuzzleImportances().find(importance => importance.value === value);
  return (
    <DeferredSelect
      aria-label="Importance"
      valueText={selected?.label ?? "None"}
      value={selected?.icon ?? UNSET_IMPORTANCE_ICON}
      showIndicator={false}
      triggerClassName={triggerClassName}>
      {deferred => (
        <Select
          {...deferred}
          aria-label="Importance"
          value={value ?? NONE_KEY}
          onChange={key => onChange(fromKey(key))}>
          <Select.Trigger className={triggerClassName}>
            <Select.Value>
              {({state}) =>
                getPuzzleImportances().find(i => i.value === state.selectedKey)?.icon ??
                UNSET_IMPORTANCE_ICON
              }
            </Select.Value>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {getPuzzleImportances().map(importance => (
                <ListBox.Item
                  key={importance.value}
                  id={importance.value}
                  textValue={importance.label}>
                  {importance.icon} {importance.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      )}
    </DeferredSelect>
  );
}

/**
 * Filters that are on: a soft accent tint with a thin accent outline, so you can see at a glance
 * which are on (in light and dark mode) without them pulling focus from the board.
 */
const FILTER_ON =
  "bg-accent-soft text-accent-soft-foreground shadow-[inset_0_0_0_1px_var(--accent)] hover:bg-accent-soft-hover";
// Written out in full (not built from FILTER_ON) so Tailwind sees the class names.
const FILTER_TOGGLE =
  "shrink-0 data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-soft-foreground data-[selected=true]:shadow-[inset_0_0_0_1px_var(--accent)] data-[selected=true]:hover:bg-accent-soft-hover";

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  return (
    <BoardDialogs workspaceSlug={workspaceSlug}>
      <BlackboardPage />
    </BoardDialogs>
  );
}

function BlackboardPage() {
  const {workspaceSlug} = Route.useParams();
  const openDialog = useContext(OpenBoardDialogContext);
  const workspace = useWorkspace();
  const isReadOnly = useIsReadOnly();
  const isPhone = useIsPhone();
  // Ours rather than a class for the Virtualizer to create, so we can ask it where a row is.
  const [boardLayout] = useState(() => new TableLayout());
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const boardBoxRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setIsNarrow(entry !== undefined && entry.contentRect.width < NARROW_BOARD)
    );
    if (boardBoxRef.current) observer.observe(boardBoxRef.current);
    return () => observer.disconnect();
  }, []);
  // The sidebar links to rows by "#id", but a row off screen isn't rendered (the table is
  // virtualized), so scroll the board to it instead.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest("a[href^='#']") : null;
      const id = link?.getAttribute("href")?.slice(1);
      const rect = id ? boardLayout.getLayoutInfo(id)?.rect : null;
      if (!rect || !boardScrollRef.current) return;
      e.preventDefault();
      boardScrollRef.current.scrollTo({top: rect.y - HEADING_HEIGHT});
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [boardLayout]);
  const [isArrangeOn, setIsArranging] = useState(false);
  // Arranging moves rows, so a read-only workspace can't be arranged (even if it was archived while
  // you were arranging).
  const isArranging = isArrangeOn && !isReadOnly;
  // Rows you've collapsed (rounds, metas, unassigned groups), remembered per workspace; everything
  // else is expanded.
  const [collapsed, setCollapsed] = useLocalStorage<string[]>(
    `blackboard-collapsed-${workspaceSlug}`,
    []
  );
  // Filters, remembered per workspace: a tag filter left on in one hunt shouldn't hide the next.
  const [hideSolved, setHideSolved] = useLocalStorage(
    `blackboard-hideSolved-${workspaceSlug}`,
    false
  );
  const [hideObsolete, setHideObsolete] = useLocalStorage(
    `blackboard-hideObsolete-${workspaceSlug}`,
    false
  );
  const [hideSolvedMetas, setHideSolvedMetas] = useLocalStorage(
    `blackboard-hideSolvedMetas-${workspaceSlug}`,
    false
  );
  const [onlyShowFavorites, setOnlyShowFavorites] = useLocalStorage(
    `blackboard-onlyShowFavorites-${workspaceSlug}`,
    false
  );
  const [search, setSearch] = useState("");
  // "/" focuses the search box (unless you're already typing somewhere). So does ⌘F / Ctrl+F: the
  // board only renders the rows in view, so the browser's find would miss the rest. Pressed again
  // in the search box, it's the browser's find after all.
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const isTyping =
        target !== null &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      const isFind =
        e.key.toLowerCase() === "f" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
      if (
        (e.key === "/" && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) ||
        (isFind && target !== searchInputRef.current)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  const [tags, setTags] = useLocalStorage<(string | null)[]>(
    `blackboard-tags-${workspaceSlug}`,
    []
  );
  const [importances, setImportances] = useLocalStorage<(string | null)[]>(
    `blackboard-importances-${workspaceSlug}`,
    []
  );

  // Read once here and handed to rows as booleans: a per-row subscription would re-render every
  // row whenever any favorite changes. (Suspends like the rows used to, so stars never flash.)
  const favoritesData = useSuspenseQuery(
    orpc.workspaces.members.get.queryOptions({input: {workspaceSlug}})
  ).data.favoritePuzzleIds;
  // Memoized by hand (the compiler doesn't here): a new Set on every render made every row
  // re-render whenever the page did, e.g. when collapsing a round.
  const favoriteSet = useMemo(() => new Set(toStringArray(favoritesData)), [favoritesData]);
  // From the unfiltered rounds, so "Hide solved" doesn't change a round's progress.
  const roundProgress = useMemo(
    () =>
      new Map(
        workspace.rounds.map(r => [
          r.id,
          {solved: r.puzzles.filter(p => isSolvedStatus(p.status)).length, total: r.puzzles.length},
        ])
      ),
    [workspace.rounds]
  );

  type Filterable = {
    id: string;
    name: string;
    tags: string[];
    importance: string | null;
    status: string | null;
    answer?: string | null;
    comment?: string | null;
  };
  const query = search.trim().toLowerCase();
  // Search looks at the name, answer, note and tags.
  const matchesSearch = (p: Filterable) =>
    query === "" ||
    p.name.toLowerCase().includes(query) ||
    (p.answer?.toLowerCase().includes(query) ?? false) ||
    (p.comment?.toLowerCase().includes(query) ?? false) ||
    p.tags.some(tag => tag.toLowerCase().includes(query));
  const matches = (p: Filterable) =>
    matchesSearch(p) &&
    (tags.length === 0 ||
      tags.some(tag => (tag === null ? p.tags.length === 0 : p.tags.includes(tag)))) &&
    (importances.length === 0 || importances.includes(p.importance)) &&
    (!hideObsolete || p.importance !== "obsolete") &&
    (!hideSolved || (p.status !== "solved" && p.status !== "backsolved")) &&
    (!onlyShowFavorites || favoriteSet.has(p.id));
  // A meta stays when it or any of its feeders (at any depth) match; its feeders are filtered too.
  type Meta = WorkspaceRoomState["rounds"][0]["topLevelMetaPuzzles"][0];
  const filterMeta = (m: Meta): Meta | null => {
    const childPuzzles = filtered(
      m.childPuzzles.flatMap(c => (c.isMetaPuzzle ? (filterMeta(c) ?? []) : matches(c) ? [c] : [])),
      () => true
    );
    const same =
      childPuzzles.length === m.childPuzzles.length &&
      childPuzzles.every((c, i) => c === m.childPuzzles[i]);
    if (hideSolvedMetas && isSolvedStatus(m.status)) return null;
    if (childPuzzles.length === 0 && !matches(m)) return null;
    return same ? m : {...m, childPuzzles};
  };
  const rounds = workspace.rounds.map(r => {
    const puzzles = filtered(r.puzzles, matches);
    const topLevelMetaPuzzles = r.topLevelMetaPuzzles.flatMap(m => filterMeta(m) ?? []);
    const metaPuzzles = filtered(r.metaPuzzles, m => matches(m) || m.childPuzzles.some(matches));
    const unassignedPuzzles = filtered(r.unassignedPuzzles, matches);
    return puzzles === r.puzzles &&
      unassignedPuzzles === r.unassignedPuzzles &&
      metaPuzzles === r.metaPuzzles &&
      topLevelMetaPuzzles.length === r.topLevelMetaPuzzles.length &&
      topLevelMetaPuzzles.every((m, i) => m === r.topLevelMetaPuzzles[i])
      ? r
      : {...r, puzzles, metaPuzzles, topLevelMetaPuzzles, unassignedPuzzles};
  });

  // The tree's expanded rows: every round, meta and unassigned group you haven't collapsed.
  const expandableIds = workspace.rounds.flatMap(r => [
    r.id,
    unassignedGroupId(r.id),
    ...r.metaPuzzles.map(m => m.id),
  ]);
  const expandableKey = expandableIds.join(",");
  const expandedKeys = useMemo(() => {
    const closed = new Set(collapsed);
    return new Set<Key>(expandableKey.split(",").filter(id => id && !closed.has(id)));
  }, [collapsed, expandableKey]);
  const onExpandedChange = (keys: Selection) => {
    if (boardScrollRef.current) animateRowMoves(boardScrollRef.current);
    setCollapsed(keys === "all" ? [] : expandableIds.filter(id => !keys.has(id)));
  };

  // --- Arrange mode: drag rounds and puzzles. Every row is shown (filters are paused).
  const {mutate: movePuzzle} = useMutation(workspaceMutations.puzzles.move());
  const {mutate: moveRound} = useMutation(workspaceMutations.rounds.move());
  const allPuzzles = new Map(workspace.rounds.flatMap(r => r.puzzles).map(p => [p.id, p] as const));
  const roundIds = new Set(workspace.rounds.map(r => r.id));
  const groupRound = new Map(workspace.rounds.map(r => [unassignedGroupId(r.id), r.id]));
  const draggingKey = useRef<string | null>(null);
  /** Whether `id` is `ancestorId` or feeds it (directly or through other metas). */
  const isWithin = (id: string, ancestorId: string) =>
    feedsInto(pid => allPuzzles.get(pid)?.parentPuzzleId, id, ancestorId);
  /** What dropping `key` on `target` does, or null if it can't go there. */
  const moveFor = (key: string, target: DropTarget) => {
    if (target.type !== "item") return null;
    const targetKey = String(target.key);
    const {dropPosition} = target;
    if (roundIds.has(key)) {
      return roundIds.has(targetKey) && dropPosition !== "on" && targetKey !== key
        ? {
            round: {
              id: key,
              place: dropPosition === "before" ? {before: targetKey} : {after: targetKey},
            },
          }
        : null;
    }
    const puzzle = allPuzzles.get(key);
    if (!puzzle) return null;
    const place = (id: string) => (dropPosition === "before" ? {before: id} : {after: id});
    if (roundIds.has(targetKey)) {
      return dropPosition === "on"
        ? {puzzle: {id: key, to: {roundId: targetKey}, place: {end: true as const}}}
        : null;
    }
    const groupRoundId = groupRound.get(targetKey);
    if (groupRoundId) {
      // On the group: an unassigned puzzle. Just above it: the last of the round's metas.
      if (dropPosition === "on" && !puzzle.isMetaPuzzle) {
        return {puzzle: {id: key, to: {roundId: groupRoundId}, place: {end: true as const}}};
      }
      if (dropPosition === "before" && puzzle.isMetaPuzzle) {
        return {puzzle: {id: key, to: {roundId: groupRoundId}, place: {end: true as const}}};
      }
      return null;
    }
    const over = allPuzzles.get(targetKey);
    if (!over || over.id === key) return null;
    if (dropPosition === "on") {
      return over.isMetaPuzzle && !isWithin(over.id, key)
        ? {puzzle: {id: key, to: {metaId: over.id}, place: {end: true as const}}}
        : null;
    }
    if (over.parentPuzzleId !== null && allPuzzles.has(over.parentPuzzleId)) {
      // Among a meta's feeders (a meta can feed a meta, but not one that feeds it).
      return isWithin(over.parentPuzzleId, key)
        ? null
        : {puzzle: {id: key, to: {metaId: over.parentPuzzleId}, place: place(over.id)}};
    }
    // Among a round's metas, or its unassigned puzzles: only with its own kind.
    return over.isMetaPuzzle === puzzle.isMetaPuzzle
      ? {puzzle: {id: key, to: {roundId: over.roundId}, place: place(over.id)}}
      : null;
  };
  const {dragAndDropHooks} = useDragAndDrop({
    isDisabled: !isArranging,
    getItems: keys => [...keys].map(key => ({"text/plain": String(key)})),
    getAllowedDropOperations: () => ["move"],
    onDragStart: e => {
      draggingKey.current = String([...e.keys][0] ?? "");
    },
    onDragEnd: () => {
      draggingKey.current = null;
    },
    getDropOperation: target =>
      draggingKey.current && moveFor(draggingKey.current, target) ? "move" : "cancel",
    onMove: e => {
      const key = [...e.keys][0];
      const move = key === undefined ? null : moveFor(String(key), e.target);
      if (move?.round) moveRound({workspaceSlug, ...move.round});
      if (move?.puzzle) movePuzzle({workspaceSlug, ...move.puzzle});
    },
    renderDropIndicator: target => (
      <DropIndicator
        target={target}
        className={({isDropTarget}) =>
          isDropTarget ? "bg-accent h-0.5 outline-none" : "h-0.5 bg-transparent outline-none"
        }
      />
    ),
  });
  const boardRounds = isArranging ? workspace.rounds : rounds;

  const clearFilters = () => {
    setHideSolved(false);
    setHideSolvedMetas(false);
    setOnlyShowFavorites(false);
    setHideObsolete(false);
    setTags([]);
    setImportances([]);
  };
  // Search or filters hide every puzzle: say so, rather than showing empty round headers.
  const nothingMatches =
    !isArranging &&
    workspace.rounds.some(r => r.puzzles.length > 0) &&
    rounds.every(r => r.puzzles.length === 0);

  let filterCount = 0;
  if (tags.length > 0) filterCount += 1;
  if (hideSolved) filterCount += 1;
  if (hideObsolete) filterCount += 1;
  if (hideSolvedMetas) filterCount += 1;
  if (importances.length > 0) filterCount += 1;
  if (onlyShowFavorites) filterCount += 1;

  const importanceFilterOptions = [
    ...getPuzzleImportances(),
    {value: null, label: "None", icon: <SignalIcon className="text-muted" />, color: ""},
  ];

  // Tags selection for the filter submenu (multiple-select keeps the menu open).
  const tagSelectionKeys = new Set<Key>(tags.map(tag => (tag === null ? NONE_KEY : tag)));
  const onTagSelectionChange = (keys: Selection) => {
    if (keys === "all") {
      setTags([...workspace.tags, null]);
      return;
    }
    setTags([...keys].map(fromKey));
  };

  const importanceSelectionKeys = new Set<Key>(
    importances.map(value => (value === null ? NONE_KEY : value))
  );
  const onImportanceSelectionChange = (keys: Selection) => {
    if (keys === "all") {
      setImportances([...getPuzzleImportances().map(i => i.value), null]);
      return;
    }
    setImportances([...keys].map(fromKey));
  };

  return (
    <div className="flex flex-1">
      <div className="relative flex-1">
        {/* Only the table scrolls; the search and filter row stays put above it. */}
        <div className="absolute inset-0 flex flex-col">
          <div className="flex min-h-0 flex-1 flex-col divide-y">
            {/* Search on the left; the filters people use most are one click, each showing at a
                glance whether it's on. They take the room left beside the search and scroll
                sideways rather than wrap; on phones they get their own scrolling row. */}
            <div
              data-tour="board-toolbar"
              className="flex shrink-0 flex-wrap items-center gap-2 p-2">
              <SearchField
                aria-label="Search puzzles"
                className="min-w-0 flex-1 sm:w-56 sm:flex-none lg:w-64"
                value={search}
                onChange={setSearch}>
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input ref={searchInputRef} placeholder="Search puzzles…" />
                  <SearchField.ClearButton />
                  {!search && (
                    <Kbd className="me-2 hidden sm:inline-flex" aria-hidden="true">
                      <Kbd.Content>/</Kbd.Content>
                    </Kbd>
                  )}
                </SearchField.Group>
              </SearchField>
              <div
                role="toolbar"
                aria-label="Filters"
                className="order-last -mx-2 flex min-w-0 basis-full [scrollbar-width:none] items-center gap-1.5 overflow-x-auto px-2 sm:order-none sm:mx-0 sm:flex-1 sm:basis-0 sm:px-0">
                <ToggleButton
                  size="sm"
                  className={FILTER_TOGGLE}
                  isSelected={hideSolved}
                  onChange={setHideSolved}>
                  <CircleCheckIcon />
                  Hide solved
                </ToggleButton>
                <ToggleButton
                  size="sm"
                  className={FILTER_TOGGLE}
                  isSelected={hideSolvedMetas}
                  onChange={setHideSolvedMetas}>
                  <CircleCheckBigIcon />
                  Hide solved metas
                </ToggleButton>
                <ToggleButton
                  size="sm"
                  className={FILTER_TOGGLE}
                  isSelected={onlyShowFavorites}
                  onChange={setOnlyShowFavorites}>
                  <StarIcon />
                  Favorites
                </ToggleButton>
                <ToggleButton
                  size="sm"
                  className={FILTER_TOGGLE}
                  isSelected={hideObsolete}
                  onChange={setHideObsolete}>
                  <SignalMediumIcon />
                  Hide obsolete
                </ToggleButton>
                <Dropdown>
                  <Button
                    size="sm"
                    variant="tertiary"
                    className={cn("shrink-0", tags.length > 0 && FILTER_ON)}>
                    <TagIcon />
                    {tags.length > 0 ? `Tags · ${tags.length}` : "Tags"}
                    <ChevronDownIcon />
                  </Button>
                  <Dropdown.Popover className="w-fit">
                    <Dropdown.Menu
                      onAction={key => {
                        if (key === "tags-select-all") setTags([...workspace.tags, null]);
                        else if (key === "tags-reset") setTags([]);
                      }}>
                      <Dropdown.Section
                        selectionMode="multiple"
                        selectedKeys={tagSelectionKeys}
                        onSelectionChange={onTagSelectionChange}>
                        {workspace.tags.map(tag => (
                          <Dropdown.Item key={tag} id={tag} textValue={tag}>
                            <Dropdown.ItemIndicator />
                            <Label>{tag}</Label>
                          </Dropdown.Item>
                        ))}
                        <Dropdown.Item id={NONE_KEY} textValue="(Untagged)">
                          <Dropdown.ItemIndicator />
                          <Label>(Untagged)</Label>
                        </Dropdown.Item>
                      </Dropdown.Section>
                      <Separator />
                      <Dropdown.Item id="tags-select-all" textValue="Select all">
                        <Label>Select all</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="tags-reset" textValue="Reset filter">
                        <Label>Reset filter</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
                <Dropdown>
                  <Button
                    size="sm"
                    variant="tertiary"
                    className={cn("shrink-0", importances.length > 0 && FILTER_ON)}>
                    <SignalIcon />
                    {importances.length > 0 ? `Importance · ${importances.length}` : "Importance"}
                    <ChevronDownIcon />
                  </Button>
                  <Dropdown.Popover className="w-fit">
                    <Dropdown.Menu
                      onAction={key => {
                        if (key === "importance-select-all")
                          setImportances([
                            ...getPuzzleImportances().map(importance => importance.value),
                            null,
                          ]);
                        else if (key === "importance-reset") setImportances([]);
                      }}>
                      <Dropdown.Section
                        selectionMode="multiple"
                        selectedKeys={importanceSelectionKeys}
                        onSelectionChange={onImportanceSelectionChange}>
                        {importanceFilterOptions.map(importance => (
                          <Dropdown.Item
                            key={importance.value ?? NONE_KEY}
                            id={importance.value ?? NONE_KEY}
                            textValue={importance.label}
                            className={importance.color}>
                            <Dropdown.ItemIndicator />
                            {importance.icon}
                            <Label>{importance.label}</Label>
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Section>
                      <Separator />
                      <Dropdown.Item id="importance-select-all" textValue="Select all">
                        <Label>Select all</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="importance-reset" textValue="Reset filter">
                        <Label>Reset filter</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
                {filterCount > 0 && (
                  <IconTooltip label="Clear filters">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      aria-label="Clear filters"
                      onPress={clearFilters}>
                      <XIcon />
                      <span className="hidden xl:inline">Clear</span>
                    </Button>
                  </IconTooltip>
                )}
              </div>
              {/* The most common action, one click away (it asks where the puzzle goes). */}
              {!isReadOnly && workspace.rounds.length > 0 && (
                <Button
                  data-tour="add-puzzle"
                  size="sm"
                  className="shrink-0"
                  aria-label="Add a puzzle"
                  onPress={() => openDialog({kind: "add-puzzle"})}>
                  <PlusIcon />
                  <span className="max-sm:hidden">Add puzzle</span>
                </Button>
              )}
              {!isReadOnly && (
                <ToggleButton
                  data-tour="arrange"
                  size="sm"
                  className={cn(FILTER_TOGGLE, "max-sm:hidden")}
                  isSelected={isArranging}
                  onChange={setIsArranging}>
                  <MoveIcon />
                  Arrange
                </ToggleButton>
              )}
              <SidebarDrawerButton workspaceSlug={workspaceSlug} rounds={rounds} />
              <TeamChatDrawerButton />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="contents">
                {isArranging && (
                  <p className="bg-accent-soft text-accent-soft-foreground px-3 py-2 text-xs">
                    Drag rows by their handles to reorder them. Drop a puzzle on a meta to make it a
                    feeder, or on a round to move it there. Filters are paused while arranging.
                  </p>
                )}
                <ReadOnlyContext.Provider value={isReadOnly}>
                  <RoundProgressContext.Provider value={roundProgress}>
                    <ArrangingContext.Provider value={isArranging}>
                      {/* Virtualized: only the rows in view are rendered, so an update (yours or a
                          teammate's) doesn't redraw the whole board. Scrolling reuses a row's elements
                          for another puzzle, so anything in a row that keeps state or animates a
                          change (answer draft, status spark, progress) is keyed by its puzzle or
                          round, to start fresh instead of carrying over or animating. The table is its own scroll box,
                          so it needs a definite height. */}
                      <div
                        ref={boardBoxRef}
                        className={cn(
                          "relative",
                          workspace.rounds.length === 0
                            ? "h-10 shrink-0"
                            : nothingMatches
                              ? "max-h-1/2 shrink-0"
                              : "min-h-0 flex-1"
                        )}
                        style={
                          nothingMatches
                            ? {height: HEADING_HEIGHT + boardRounds.length * ROW_HEIGHT}
                            : undefined
                        }>
                        <Virtualizer
                          layout={boardLayout}
                          layoutOptions={{rowHeight: ROW_HEIGHT, headingHeight: HEADING_HEIGHT}}>
                          <Table
                            data-tour="board"
                            data-narrow={isNarrow || undefined}
                            variant="secondary"
                            className="absolute inset-0 grid-rows-[minmax(0,1fr)] overflow-visible">
                            <Table.ScrollContainer className="h-full overflow-visible">
                              <Table.Content
                                ref={boardScrollRef}
                                aria-label="Blackboard"
                                className="h-full overflow-auto text-xs"
                                treeColumn="tree"
                                expandedKeys={expandedKeys}
                                onExpandedChange={onExpandedChange}
                                // Always passed (React Aria can't add or drop them later); off outside Arrange.
                                dragAndDropHooks={dragAndDropHooks}>
                                <Table.Header className="bg-background">
                                  <Table.Column
                                    {...columnWidth(isPhone ? 0 : 32)}
                                    className={cn("h-full p-0", DESKTOP_ONLY)}
                                    aria-label="Hunt link">
                                    <span className="sr-only">Hunt link</span>
                                  </Table.Column>
                                  <Table.Column
                                    id="tree"
                                    {...columnWidth(28)}
                                    className="h-full p-0"
                                    aria-label="Expand">
                                    <span className="sr-only">Expand</span>
                                  </Table.Column>
                                  <Table.Column
                                    id="name"
                                    isRowHeader
                                    width={isPhone ? "1fr" : "2fr"}
                                    minWidth={isPhone ? 0 : 140}
                                    className={COLUMN}>
                                    Name
                                  </Table.Column>
                                  <Table.Column
                                    width={isPhone ? 0 : "1fr"}
                                    minWidth={isPhone ? 0 : 100}
                                    maxWidth={isPhone ? 0 : 200}
                                    className={cn(COLUMN, PHONE_COLLAPSED)}>
                                    <span>Answer</span>
                                  </Table.Column>
                                  <Table.Column {...columnWidth(112)} className={COLUMN}>
                                    Status
                                  </Table.Column>
                                  <Table.Column
                                    {...columnWidth(isPhone ? 0 : 44)}
                                    className={cn(COLUMN, DESKTOP_ONLY)}
                                    aria-label="Importance">
                                    <SignalIcon className="size-4" aria-hidden />
                                  </Table.Column>
                                  <Table.Column
                                    width={isPhone ? 0 : "1fr"}
                                    minWidth={isPhone ? 0 : 72}
                                    className={cn(COLUMN, DESKTOP_ONLY)}>
                                    Tags
                                  </Table.Column>
                                  <Table.Column
                                    data-tour="working-on"
                                    {...columnWidth(isPhone || isNarrow ? 0 : 112)}
                                    className={cn(COLUMN, DESKTOP_ONLY, NARROW_HIDDEN)}>
                                    Working on this
                                  </Table.Column>
                                  <Table.Column
                                    {...columnWidth(isPhone ? PHONE_ACTIONS_WIDTH : ACTIONS_WIDTH)}
                                    className={COLUMN}
                                    aria-label="Actions">
                                    <div className="ml-auto flex items-center justify-end">
                                      {!isReadOnly && (
                                        <Tooltip delay={300}>
                                          <Button
                                            data-tour="add-round"
                                            variant="ghost"
                                            isIconOnly
                                            aria-label="Add a round"
                                            onPress={() => openDialog({kind: "add-round"})}>
                                            <PlusIcon />
                                          </Button>
                                          <Tooltip.Content>Add a round</Tooltip.Content>
                                        </Tooltip>
                                      )}
                                      {/* Holds the ⋯ menus' place so this + lines up with the rows' + buttons (phones have none). */}
                                      {!isReadOnly && (
                                        <span
                                          aria-hidden
                                          className={cn(
                                            buttonVariants({variant: "ghost", isIconOnly: true}),
                                            "invisible max-md:hidden"
                                          )}
                                        />
                                      )}
                                    </div>
                                  </Table.Column>
                                </Table.Header>
                                <Table.Body
                                  items={boardRounds}
                                  // Only what the rows are rendered from: a change here re-renders every
                                  // row and cell. Round progress comes by context (only round rows read
                                  // it) and expansion through React Aria, so neither is listed.
                                  dependencies={[
                                    workspace.tags,
                                    favoriteSet,
                                    isArranging,
                                    isReadOnly,
                                  ]}>
                                  {round => (
                                    <BlackboardRound
                                      workspaceSlug={workspaceSlug}
                                      round={round}
                                      tags={workspace.tags}
                                      favoritePuzzleIds={favoriteSet}
                                    />
                                  )}
                                </Table.Body>
                              </Table.Content>
                            </Table.ScrollContainer>
                          </Table>
                        </Virtualizer>
                      </div>
                    </ArrangingContext.Provider>
                  </RoundProgressContext.Provider>
                </ReadOnlyContext.Provider>
                {nothingMatches && (
                  <EmptyState className="py-16">
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <SearchXIcon />
                      </EmptyState.Media>
                      <EmptyState.Title>No puzzles match</EmptyState.Title>
                      <EmptyState.Description>
                        {query && filterCount > 0
                          ? "Nothing matches your search with these filters on."
                          : query
                            ? `Nothing matches “${search.trim()}”.`
                            : "Every puzzle is hidden by the filters."}
                      </EmptyState.Description>
                    </EmptyState.Header>
                    <EmptyState.Content>
                      <Button
                        variant="secondary"
                        onPress={() => {
                          setSearch("");
                          clearFilters();
                        }}>
                        {query && filterCount > 0
                          ? "Clear search and filters"
                          : query
                            ? "Clear search"
                            : "Clear filters"}
                      </Button>
                    </EmptyState.Content>
                  </EmptyState>
                )}
                {workspace.rounds.length === 0 && (
                  // A new workspace: say what goes here, with the first step one click away.
                  <EmptyState className="py-16">
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <ListPlusIcon />
                      </EmptyState.Media>
                      <EmptyState.Title>No rounds yet</EmptyState.Title>
                      {/* How to start, unless nothing can be added. */}
                      {!isReadOnly && (
                        <EmptyState.Description>
                          Puzzles are grouped by round, like on the hunt site. Add a round when it
                          unlocks, then its puzzles with Add puzzle. Everyone sees them here as soon
                          as they're added.
                        </EmptyState.Description>
                      )}
                    </EmptyState.Header>
                    {!isReadOnly && (
                      <EmptyState.Content>
                        <Button
                          data-tour="add-first-round"
                          onPress={() => openDialog({kind: "add-round"})}>
                          <PlusIcon />
                          Add a round
                        </Button>
                      </EmptyState.Content>
                    )}
                  </EmptyState>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <AppSidebar workspaceSlug={workspaceSlug} rounds={rounds} />
    </div>
  );
}

// Rows are memoized and take `tags` as a prop instead of reading the workspace context, so a
// websocket update only re-renders the rows whose data changed.
const BlackboardRound = memo(function BlackboardRound({
  workspaceSlug,
  round,
  tags,
  favoritePuzzleIds,
}: {
  workspaceSlug: string;
  round: WorkspaceRoomState["rounds"][0];
  tags: string[];
  favoritePuzzleIds: ReadonlySet<string>;
}) {
  const {mutate: updateRound} = useMutation(workspaceMutations.rounds.update());
  const isBeingCreated = useIsBeingCreated(round.id, orpc.rounds.create.mutationKey());
  const openDialog = useContext(OpenBoardDialogContext);
  const isArranging = useContext(ArrangingContext);
  const isReadOnly = useContext(ReadOnlyContext);
  // Across the whole round, regardless of the active filters.
  const progress = useContext(RoundProgressContext).get(round.id);
  const solvedCount = progress?.solved ?? 0;
  const puzzleCount = progress?.total ?? 0;

  // Metas, then the unassigned puzzles as one group (kept stable so rows aren't rebuilt).
  const children = useMemo<RoundChild[]>(
    () =>
      round.unassignedPuzzles.length > 0
        ? [
            ...round.topLevelMetaPuzzles,
            {
              id: unassignedGroupId(round.id),
              kind: "unassigned",
              roundId: round.id,
              puzzles: round.unassignedPuzzles,
            },
          ]
        : round.topLevelMetaPuzzles,
    [round.id, round.topLevelMetaPuzzles, round.unassignedPuzzles]
  );

  function onStatusChange(value: string | null) {
    if (round.status !== value) updateRound({workspaceSlug, id: round.id, status: value});
  }

  return (
    <Table.Row
      id={round.id}
      textValue={round.name}
      className="bg-surface-secondary text-foreground group">
      <Table.Cell className={cn("flex items-center p-0", DESKTOP_ONLY)}>
        {isArranging && <DragHandle label={round.name} />}
      </Table.Cell>
      <Table.Cell className={TREE_CELL}>
        {({isExpanded, hasChildItems}) => (
          <span className="flex justify-center">
            {hasChildItems && (
              <RowChevron label={`Toggle round ${round.name}`} isExpanded={isExpanded} />
            )}
          </span>
        )}
      </Table.Cell>
      {/* Over the Answer column too. */}
      <Table.Cell colSpan={2} className={CELL} textValue={round.name}>
        {() => (
          <div className="flex min-w-0 items-center gap-2">
            {round.status === "solved" && <CheckIcon className="text-success size-3.5 shrink-0" />}
            <span className="text-foreground truncate text-sm font-semibold">{round.name}</span>
            {puzzleCount > 0 && (
              <div className="flex shrink-0 items-center gap-2">
                <ProgressBar
                  key={round.id}
                  aria-label={`${round.name}: ${solvedCount} of ${puzzleCount} puzzles solved`}
                  value={(solvedCount / puzzleCount) * 100}
                  size="sm"
                  color={solvedCount === puzzleCount ? "success" : "accent"}
                  // Phones: just the count, to leave the name room.
                  className="w-20 gap-0 max-md:hidden">
                  <ProgressBar.Track className="w-full">
                    {/* Fills smoothly as puzzles are solved. */}
                    <ProgressBar.Fill className="transition-[width] duration-700 ease-out motion-reduce:transition-none" />
                  </ProgressBar.Track>
                </ProgressBar>
                <span className="text-muted text-xs tabular-nums" aria-hidden="true">
                  <NumberFlow key={round.id} value={solvedCount} />/{puzzleCount}
                </span>
              </div>
            )}
          </div>
        )}
      </Table.Cell>
      <Table.Cell className={CELL}>
        <DeferredSelect
          key={round.id}
          aria-label="Round status"
          valueText={round.status === "solved" ? "Solved" : "None"}
          value={round.status === "solved" ? "Solved" : "None"}
          triggerClassName={SELECT_TRIGGER_CLASS}>
          {deferred => (
            <Select
              {...deferred}
              aria-label="Round status"
              value={round.status ?? NONE_KEY}
              onChange={value => onStatusChange(fromKey(value))}>
              <Select.Trigger className={SELECT_TRIGGER_CLASS}>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id={NONE_KEY} textValue="None">
                    None
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item
                    id="solved"
                    textValue="Solved"
                    className={getBgColorClassNamesForPuzzleStatus("solved")}>
                    Solved
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        </DeferredSelect>
      </Table.Cell>
      <Table.Cell colSpan={3} className={cn(CELL, DESKTOP_ONLY)}>
        {null}
      </Table.Cell>
      <Table.Cell className={CELL}>
        <div className="-my-3 ml-auto flex items-center justify-end">
          {!isReadOnly && (
            <Tooltip delay={300}>
              <Button
                variant="ghost"
                isIconOnly
                isDisabled={isBeingCreated}
                aria-label={`Add a puzzle to ${round.name}`}
                // Phones have the toolbar's Add puzzle, and little room in the row.
                className="max-md:hidden"
                onPress={() => openDialog({kind: "add-puzzle", roundId: round.id})}>
                <PlusIcon />
              </Button>
              <Tooltip.Content>Add a puzzle to {round.name}</Tooltip.Content>
            </Tooltip>
          )}
          {/* Everything in it changes the round. */}
          {!isReadOnly && (
            <Dropdown>
              <IconButton
                label={`Actions for ${round.name}`}
                data-tour="round-menu"
                data-tour-id={round.id}
                isDisabled={isBeingCreated}
                variant="ghost">
                <EllipsisIcon />
              </IconButton>
              <Dropdown.Popover className="w-fit" placement="bottom end">
                <Dropdown.Menu>
                  <Dropdown.Item
                    id="add-meta"
                    textValue="Add a meta"
                    onAction={() => openDialog({kind: "add-meta", roundId: round.id})}>
                    <Label>Add a meta</Label>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="add-unassigned"
                    textValue="Add a puzzle (no meta)"
                    onAction={() => openDialog({kind: "add-puzzle", roundId: round.id})}>
                    <Label>Add a puzzle (no meta)</Label>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="edit-round"
                    textValue="Edit round"
                    onAction={() => openDialog({kind: "edit-round", round})}>
                    <Label>Edit round</Label>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="delete-round"
                    textValue="Delete round"
                    onAction={() =>
                      openDialog({
                        kind: "delete-round",
                        roundId: round.id,
                        roundName: round.name,
                        puzzleCount,
                      })
                    }>
                    <Label>Delete round</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        </div>
      </Table.Cell>
      <Table.Collection items={children} dependencies={[tags, favoritePuzzleIds]}>
        {child =>
          "kind" in child ? (
            <BlackboardUnassigned
              workspaceSlug={workspaceSlug}
              group={child}
              tags={tags}
              favoritePuzzleIds={favoritePuzzleIds}
            />
          ) : (
            <BlackboardMetaPuzzle
              workspaceSlug={workspaceSlug}
              metaPuzzle={child}
              tags={tags}
              favoritePuzzleIds={favoritePuzzleIds}
            />
          )
        }
      </Table.Collection>
    </Table.Row>
  );
});

/** A round's unassigned puzzles, as one collapsible group. */
const BlackboardUnassigned = memo(function BlackboardUnassigned({
  workspaceSlug,
  group,
  tags,
  favoritePuzzleIds,
}: {
  workspaceSlug: string;
  group: UnassignedGroup;
  tags: string[];
  favoritePuzzleIds: ReadonlySet<string>;
}) {
  const openDialog = useContext(OpenBoardDialogContext);
  const isReadOnly = useContext(ReadOnlyContext);
  return (
    <Table.Row id={group.id} textValue="Unassigned puzzles" className="group">
      <Table.Cell className={cn("flex items-center p-0", DESKTOP_ONLY)}>{null}</Table.Cell>
      <Table.Cell className={TREE_CELL}>
        {({isExpanded}) => (
          <span className="flex justify-center">
            <RowChevron label="Toggle unassigned puzzles" isExpanded={isExpanded} color="grey" />
          </span>
        )}
      </Table.Cell>
      <Table.Cell colSpan={6} className={CELL} textValue="Unassigned puzzles">
        <span className="font-semibold italic">Unassigned puzzles</span>
      </Table.Cell>
      <Table.Cell className={CELL}>
        <div className="-my-3 ml-auto flex items-center justify-end">
          {/* Its only item moves puzzles. */}
          {!isReadOnly && (
            <Dropdown>
              <IconButton label="Actions for unassigned puzzles" variant="ghost">
                <EllipsisIcon />
              </IconButton>
              <Dropdown.Popover className="w-fit" placement="bottom end">
                <Dropdown.Menu>
                  <Dropdown.Item
                    id="assign-all"
                    textValue="Assign all unassigned puzzles"
                    onAction={() =>
                      openDialog({kind: "assign-unassigned", roundId: group.roundId})
                    }>
                    <Label>Assign all unassigned puzzles</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        </div>
      </Table.Cell>
      <Table.Collection
        items={group.puzzles}
        dependencies={[tags, favoritePuzzleIds, group.puzzles.at(-1)?.id]}>
        {puzzle => (
          <BlackboardPuzzle
            color="grey"
            isLast={puzzle.id === group.puzzles.at(-1)?.id}
            workspaceSlug={workspaceSlug}
            puzzle={puzzle}
            tags={tags}
            isFavorite={favoritePuzzleIds.has(puzzle.id)}
          />
        )}
      </Table.Collection>
    </Table.Row>
  );
});

const BlackboardMetaPuzzle = memo(function BlackboardMetaPuzzle({
  workspaceSlug,
  metaPuzzle,
  tags,
  favoritePuzzleIds,
  parentId,
  outer = "",
  isLast = false,
}: {
  workspaceSlug: string;
  metaPuzzle: WorkspaceRoomState["rounds"][0]["topLevelMetaPuzzles"][0];
  tags: string[];
  favoritePuzzleIds: ReadonlySet<string>;
  /** The meta this one feeds, if it's inside another meta. */
  parentId?: string;
  outer?: OuterLines;
  /** The last of its parent's feeders. */
  isLast?: boolean;
}) {
  const {mutate: updatePuzzle} = useMutation(workspaceMutations.puzzles.update());
  const isPhone = useIsPhone();
  const update = (patch: Omit<RouterInputs["puzzles"]["update"], "workspaceSlug" | "id">) =>
    updatePuzzle({workspaceSlug, id: metaPuzzle.id, ...patch});
  const isBeingCreated = useIsBeingCreated(metaPuzzle.id);
  const openDialog = useContext(OpenBoardDialogContext);
  const isFavorite = favoritePuzzleIds.has(metaPuzzle.id);
  const toggleFavorite = useToggleFavorite(workspaceSlug);
  const color = metaColor(metaPuzzle.id);
  const isArranging = useContext(ArrangingContext);
  const isReadOnly = useContext(ReadOnlyContext);
  const presences = useAppSelector(state => state.presences.value[metaPuzzle.id]) ?? NO_PRESENCES;
  // Inside another meta: its parent's line runs to it, after any lines from further out.
  const lines = parentId
    ? [
        ...outerLineKinds(outer),
        {color: metaColor(parentId), kind: isLast ? ("last" as const) : ("branch" as const)},
      ]
    : [];
  // What its feeders show in front of its own line: its parent's carries on unless it was last.
  const childOuter = parentId ? [outer, isLast ? "-" : parentId].filter(Boolean).join(" ") : "";
  const lastChildId = metaPuzzle.childPuzzles.at(-1)?.id;
  const chevron = ({isExpanded, hasChildItems}: {isExpanded: boolean; hasChildItems: boolean}) =>
    hasChildItems ? (
      <RowChevron
        label={`Toggle meta puzzle ${metaPuzzle.name}`}
        isExpanded={isExpanded}
        color={color}
      />
    ) : (
      <span className="size-2 rounded-full" style={{backgroundColor: color}} />
    );

  return (
    <Table.Row
      id={metaPuzzle.id}
      textValue={metaPuzzle.name}
      className={cn(
        "group group/row",
        getRowClassNamesForStatus(metaPuzzle.status),
        getRowClassNamesForImportance(metaPuzzle.importance, metaPuzzle.status),
        isBeingCreated && "pointer-events-none cursor-wait opacity-70"
      )}>
      {/* Phones: no room for it; the row menu opens the hunt site instead. */}
      <Table.Cell className={cn("flex items-center p-0", DESKTOP_ONLY)}>
        {isArranging ? (
          <DragHandle label={metaPuzzle.name} />
        ) : (
          metaPuzzle.link && (
            <NativeTooltip label={`Hunt link to ${metaPuzzle.name}`}>
              <a
                className={buttonVariants({variant: "ghost", isIconOnly: true})}
                aria-label={`Hunt link to ${metaPuzzle.name}`}
                href={metaPuzzle.link}
                target="_blank"
                rel="noopener noreferrer">
                <PuzzleIcon className="text-muted group-hover/row:text-accent group-focus-within/row:text-accent transition-colors" />
              </a>
            </NativeTooltip>
          )
        )}
      </Table.Cell>
      <Table.Cell className={TREE_CELL}>
        {state =>
          lines.length > 0 ? (
            lines[0] && <TreeLine {...lines[0]} />
          ) : (
            <span className="flex justify-center">{chevron(state)}</span>
          )
        }
      </Table.Cell>
      <Table.Cell className={cn(CELL, "relative font-semibold")} textValue={metaPuzzle.name}>
        {state => (
          <>
            <TeammateChangeFlash key={metaPuzzle.id} puzzleId={metaPuzzle.id} />
            <NameIndent lines={lines.slice(1)} />
            {lines.length > 0 && (
              <span className="me-1 flex w-6 shrink-0 justify-center">{chevron(state)}</span>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <Link
                data-tour="puzzle-link"
                data-tour-id={metaPuzzle.id}
                to="/$workspaceSlug/puzzles/$puzzleId"
                params={{workspaceSlug, puzzleId: metaPuzzle.id}}
                title={metaPuzzle.name}
                className="-m-2 block min-w-0 truncate p-2 hover:underline">
                <SolvedMark status={metaPuzzle.status} />
                {metaPuzzle.name}
                <PhoneAnswer answer={metaPuzzle.answer} />
              </Link>
            </div>
          </>
        )}
      </Table.Cell>
      {/* Phones: shown under the name instead, so Status fits on screen. */}
      <Table.Cell className={cn(CELL, "relative", PHONE_COLLAPSED)}>
        <AnswerInput
          key={metaPuzzle.id}
          puzzleName={metaPuzzle.name}
          value={metaPuzzle.answer}
          count={metaPuzzle.answerCount}
          onCommit={answer => update({answer, ...solvedByAnswer(answer, metaPuzzle)})}
        />
      </Table.Cell>
      <Table.Cell className={CELL}>
        <PuzzleStatusSelect
          key={metaPuzzle.id}
          value={metaPuzzle.status}
          onChange={status => {
            if (status !== metaPuzzle.status) update({status});
          }}
          triggerClassName={SELECT_TRIGGER_CLASS}
        />
      </Table.Cell>
      <Table.Cell className={cn(CELL, DESKTOP_ONLY)}>
        <PuzzleImportanceSelect
          key={metaPuzzle.id}
          value={metaPuzzle.importance}
          onChange={importance => {
            if (importance !== metaPuzzle.importance) update({importance});
          }}
          triggerClassName={cn(
            IMPORTANCE_TRIGGER_CLASS,
            getImportanceCellClassNames(metaPuzzle.importance, metaPuzzle.status)
          )}
        />
      </Table.Cell>
      <Table.Cell className={cn(CELL, "p-0", DESKTOP_ONLY)}>
        <TagsCell
          key={metaPuzzle.id}
          puzzleName={metaPuzzle.name}
          value={metaPuzzle.tags}
          tags={tags}
          onCommit={next => update({tags: next})}
        />
      </Table.Cell>
      <Table.Cell className={cn(CELL, "py-1", DESKTOP_ONLY, NARROW_HIDDEN)}>
        <UserPresenceAvatars users={presences} />
      </Table.Cell>
      <Table.Cell className={CELL}>
        <div className="-my-3 ml-auto flex items-center justify-end">
          <IconTooltip label="Favorite">
            <ToggleButton
              variant="ghost"
              isIconOnly
              aria-label="Favorite"
              isSelected={isFavorite}
              onChange={value => toggleFavorite(metaPuzzle.id, value)}
              className={cn("group/toggle", !isFavorite && FAVORITE_HIDDEN_CLASS)}>
              <StarIcon className="stroke-muted group-data-selected/toggle:fill-accent group-data-selected/toggle:stroke-accent" />
            </ToggleButton>
          </IconTooltip>
          {/* Lines up with the round row's +. */}
          {!isReadOnly && (
            <Tooltip delay={300}>
              <Button
                variant="ghost"
                isIconOnly
                aria-label={`Add a feeder to ${metaPuzzle.name}`}
                // Phones have the toolbar's Add puzzle, and little room in the row.
                className="max-md:hidden"
                onPress={() =>
                  openDialog({
                    kind: "add-puzzle",
                    roundId: metaPuzzle.roundId,
                    parentPuzzleId: metaPuzzle.id,
                  })
                }>
                <PlusIcon />
              </Button>
              <Tooltip.Content>Add a feeder to {metaPuzzle.name}</Tooltip.Content>
            </Tooltip>
          )}
          {/* Read-only, only phones' favorite item is left (or nothing, so no menu). */}
          {(!isReadOnly || isPhone) && (
            <Dropdown>
              <IconButton
                label={`Actions for ${metaPuzzle.name}`}
                data-tour="meta-menu"
                data-tour-id={metaPuzzle.id}
                variant="ghost">
                <EllipsisIcon />
              </IconButton>
              <Dropdown.Popover className="w-fit" placement="bottom end">
                <Dropdown.Menu>
                  {/* Phones: the star isn't shown in the row (to keep it narrow), so it's here. Not
                    rendered at all elsewhere (hidden items would still be reachable by keyboard). */}
                  {isPhone && (
                    <Dropdown.Item
                      id="favorite"
                      textValue={isFavorite ? "Remove from favorites" : "Add to favorites"}
                      onAction={() => toggleFavorite(metaPuzzle.id, !isFavorite)}>
                      <Label>{isFavorite ? "Remove from favorites" : "Add to favorites"}</Label>
                    </Dropdown.Item>
                  )}
                  {isPhone && metaPuzzle.link && (
                    <Dropdown.Item
                      id="open-hunt-site"
                      textValue="Open on the hunt site"
                      href={metaPuzzle.link}
                      target="_blank">
                      <Label>Open on the hunt site</Label>
                    </Dropdown.Item>
                  )}
                  {!isReadOnly && (
                    <Dropdown.Item
                      id="add-feeding"
                      textValue="Add a feeder"
                      onAction={() =>
                        openDialog({
                          kind: "add-puzzle",
                          roundId: metaPuzzle.roundId,
                          parentPuzzleId: metaPuzzle.id,
                        })
                      }>
                      <Label>Add a feeder</Label>
                    </Dropdown.Item>
                  )}
                  {!isReadOnly && (
                    <Dropdown.Item
                      id="edit-meta"
                      textValue="Edit meta"
                      onAction={() => openDialog({kind: "edit-puzzle", puzzle: metaPuzzle})}>
                      <Label>Edit meta</Label>
                    </Dropdown.Item>
                  )}
                  {!isReadOnly && (
                    <Dropdown.Item
                      id="move-meta"
                      textValue="Move to…"
                      onAction={() => openDialog({kind: "move-puzzle", puzzle: metaPuzzle})}>
                      <Label>Move to…</Label>
                    </Dropdown.Item>
                  )}
                  {!isReadOnly && (
                    <Dropdown.Item
                      id="delete-meta"
                      textValue="Delete meta"
                      onAction={() => openDialog({kind: "delete-puzzle", puzzle: metaPuzzle})}>
                      <Label>Delete meta</Label>
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        </div>
      </Table.Cell>
      <Table.Collection
        items={metaPuzzle.childPuzzles}
        dependencies={[tags, favoritePuzzleIds, childOuter, lastChildId]}>
        {puzzle =>
          // A meta can feed another meta: it nests here, with its own feeders.
          puzzle.isMetaPuzzle ? (
            <BlackboardMetaPuzzle
              workspaceSlug={workspaceSlug}
              metaPuzzle={puzzle}
              tags={tags}
              favoritePuzzleIds={favoritePuzzleIds}
              parentId={metaPuzzle.id}
              outer={childOuter}
              isLast={puzzle.id === lastChildId}
            />
          ) : (
            <BlackboardPuzzle
              workspaceSlug={workspaceSlug}
              color={color}
              outer={childOuter}
              isLast={puzzle.id === lastChildId}
              puzzle={puzzle}
              tags={tags}
              isFavorite={favoritePuzzleIds.has(puzzle.id)}
            />
          )
        }
      </Table.Collection>
    </Table.Row>
  );
});

const BlackboardPuzzle = memo(function BlackboardPuzzle({
  workspaceSlug,
  puzzle,
  color,
  outer = "",
  isLast,
  tags,
  isFavorite,
}: {
  workspaceSlug: string;
  puzzle: WorkspaceRoomState["rounds"][0]["puzzles"][0];
  /** The colour of the meta it feeds (grey when unassigned). */
  color: string;
  outer?: OuterLines;
  /** The last of its meta's feeders. */
  isLast: boolean;
  tags: string[];
  isFavorite: boolean;
}) {
  const {mutate: updatePuzzle} = useMutation(workspaceMutations.puzzles.update());
  const isPhone = useIsPhone();
  const update = (patch: Omit<RouterInputs["puzzles"]["update"], "workspaceSlug" | "id">) =>
    updatePuzzle({workspaceSlug, id: puzzle.id, ...patch});
  const isBeingCreated = useIsBeingCreated(puzzle.id);
  const toggleFavorite = useToggleFavorite(workspaceSlug);
  const presences = useAppSelector(state => state.presences.value[puzzle.id]) ?? NO_PRESENCES;
  const isArranging = useContext(ArrangingContext);
  const isReadOnly = useContext(ReadOnlyContext);
  const openDialog = useContext(OpenBoardDialogContext);
  const lines = [
    ...outerLineKinds(outer),
    {color, kind: isLast ? ("last" as const) : ("branch" as const)},
  ];

  return (
    <Table.Row
      id={puzzle.id}
      textValue={puzzle.name}
      className={cn(
        "group/row",
        getRowClassNamesForStatus(puzzle.status),
        getRowClassNamesForImportance(puzzle.importance, puzzle.status),
        isBeingCreated && "pointer-events-none cursor-wait opacity-70"
      )}>
      {/* Phones: no room for it; the row menu opens the hunt site instead. */}
      <Table.Cell className={cn("flex items-center p-0", DESKTOP_ONLY)}>
        {isArranging ? (
          <DragHandle label={puzzle.name} />
        ) : (
          puzzle.link && (
            <NativeTooltip label={`Hunt link to ${puzzle.name}`}>
              <a
                className={buttonVariants({variant: "ghost", isIconOnly: true})}
                aria-label={`Hunt link to ${puzzle.name}`}
                href={puzzle.link}
                target="_blank"
                rel="noopener noreferrer">
                <PuzzleIcon className="text-muted group-hover/row:text-accent group-focus-within/row:text-accent transition-colors" />
              </a>
            </NativeTooltip>
          )
        )}
      </Table.Cell>
      <Table.Cell className={TREE_CELL}>{lines[0] && <TreeLine {...lines[0]} />}</Table.Cell>
      <Table.Cell className={cn(CELL, "relative")} textValue={puzzle.name}>
        <TeammateChangeFlash key={puzzle.id} puzzleId={puzzle.id} />
        <NameIndent lines={lines.slice(1)} />
        <div className="flex min-w-0 items-center gap-2">
          <Link
            data-tour="puzzle-link"
            data-tour-id={puzzle.id}
            to="/$workspaceSlug/puzzles/$puzzleId"
            params={{workspaceSlug, puzzleId: puzzle.id}}
            title={puzzle.name}
            className="-m-2 block min-w-0 flex-1 truncate p-2 hover:underline">
            <SolvedMark status={puzzle.status} />
            {puzzle.name}
            <PhoneAnswer answer={puzzle.answer} />
          </Link>
          <VoiceRoomBadge room={puzzle.id} />
        </div>
      </Table.Cell>
      {/* Phones: shown under the name instead, so Status fits on screen. */}
      <Table.Cell className={cn(CELL, "relative", PHONE_COLLAPSED)}>
        <AnswerInput
          key={puzzle.id}
          puzzleName={puzzle.name}
          value={puzzle.answer}
          count={puzzle.answerCount}
          onCommit={answer => update({answer, ...solvedByAnswer(answer, puzzle)})}
        />
      </Table.Cell>
      <Table.Cell className={CELL}>
        <PuzzleStatusSelect
          key={puzzle.id}
          value={puzzle.status}
          onChange={status => {
            if (status !== puzzle.status) update({status});
          }}
          triggerClassName={PUZZLE_STATUS_TRIGGER_CLASS}
        />
      </Table.Cell>
      <Table.Cell className={cn(CELL, DESKTOP_ONLY)}>
        <PuzzleImportanceSelect
          key={puzzle.id}
          value={puzzle.importance}
          onChange={importance => {
            if (importance !== puzzle.importance) update({importance});
          }}
          triggerClassName={cn(
            IMPORTANCE_TRIGGER_CLASS,
            getImportanceCellClassNames(puzzle.importance, puzzle.status)
          )}
        />
      </Table.Cell>
      <Table.Cell className={cn(CELL, "p-0", DESKTOP_ONLY)}>
        <TagsCell
          key={puzzle.id}
          puzzleName={puzzle.name}
          value={puzzle.tags}
          tags={tags}
          onCommit={next => update({tags: next})}
        />
      </Table.Cell>
      <Table.Cell className={cn(CELL, "py-1", DESKTOP_ONLY, NARROW_HIDDEN)}>
        <UserPresenceAvatars users={presences} />
      </Table.Cell>
      <Table.Cell className={CELL}>
        <div className="-my-3 ml-auto flex items-center justify-end">
          <IconTooltip label="Favorite">
            <ToggleButton
              variant="ghost"
              isIconOnly
              aria-label="Favorite"
              isSelected={isFavorite}
              onChange={value => toggleFavorite(puzzle.id, value)}
              className={cn("group/toggle", !isFavorite && FAVORITE_HIDDEN_CLASS)}>
              <StarIcon className="stroke-muted group-data-selected/toggle:fill-accent group-data-selected/toggle:stroke-accent" />
            </ToggleButton>
          </IconTooltip>
          {/* Read-only, only phones' favorite item is left (or nothing, so no menu). */}
          {(!isReadOnly || isPhone) && (
            <Dropdown>
              <IconButton label={`Actions for ${puzzle.name}`} variant="ghost">
                <EllipsisIcon />
              </IconButton>
              <Dropdown.Popover className="w-fit" placement="bottom end">
                <Dropdown.Menu>
                  {/* Phones: the star isn't shown in the row (to keep it narrow), so it's here. Not
                    rendered at all elsewhere (hidden items would still be reachable by keyboard). */}
                  {isPhone && (
                    <Dropdown.Item
                      id="favorite"
                      textValue={isFavorite ? "Remove from favorites" : "Add to favorites"}
                      onAction={() => toggleFavorite(puzzle.id, !isFavorite)}>
                      <Label>{isFavorite ? "Remove from favorites" : "Add to favorites"}</Label>
                    </Dropdown.Item>
                  )}
                  {isPhone && puzzle.link && (
                    <Dropdown.Item
                      id="open-hunt-site"
                      textValue="Open on the hunt site"
                      href={puzzle.link}
                      target="_blank">
                      <Label>Open on the hunt site</Label>
                    </Dropdown.Item>
                  )}
                  {!isReadOnly && (
                    <Dropdown.Item
                      id="edit-puzzle"
                      textValue="Edit puzzle"
                      onAction={() => openDialog({kind: "edit-puzzle", puzzle})}>
                      <Label>Edit puzzle</Label>
                    </Dropdown.Item>
                  )}
                  {!isReadOnly && (
                    <Dropdown.Item
                      id="move-puzzle"
                      textValue="Move to…"
                      onAction={() => openDialog({kind: "move-puzzle", puzzle})}>
                      <Label>Move to…</Label>
                    </Dropdown.Item>
                  )}
                  {!isReadOnly && (
                    <Dropdown.Item
                      id="delete-puzzle"
                      textValue="Delete puzzle"
                      onAction={() => openDialog({kind: "delete-puzzle", puzzle})}>
                      <Label>Delete puzzle</Label>
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        </div>
      </Table.Cell>
    </Table.Row>
  );
});
