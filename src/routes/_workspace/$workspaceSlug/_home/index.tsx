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
  tableVariants,
  ToggleButton,
  Tooltip,
  type Key,
  type Selection,
} from "@heroui/react";
import {useIsMutating, useMutation, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {sha256} from "js-sha256";
import {
  CheckIcon,
  ChevronRightIcon,
  EllipsisIcon,
  FunnelIcon,
  InfoIcon,
  PuzzleIcon,
  SignalHighIcon,
  SignalIcon,
  StarIcon,
  TagIcon,
} from "lucide-react";
import * as React from "react";
import {memo, useEffect, useRef, useState} from "react";
import {cn} from "tailwind-variants";
import {useLocalStorage} from "usehooks-ts";

import {AddNewMetaPuzzleDialog} from "@/components/add-new-meta-puzzle-dialog";
import {AddNewPuzzleDialog} from "@/components/add-new-puzzle-dialog";
import {AddNewRoundDialog} from "@/components/add-new-round-dialog";
import {AppSidebar} from "@/components/app-sidebar";
import {AssignUnassignedPuzzlesDialog} from "@/components/assign-unassigned-puzzles-dialog";
import {DeletePuzzleDialog} from "@/components/delete-puzzle-dialog";
import {DeleteRoundDialog} from "@/components/delete-round-dialog";
import {EditPuzzleDialog} from "@/components/edit-puzzle-dialog";
import {EditRoundDialog} from "@/components/edit-round-dialog";
import {useAppForm} from "@/components/form";
import {SolveSpark} from "@/components/solve-spark";
import {UserPresenceAvatars} from "@/components/user-hover-card";
import {NO_PRESENCES} from "@/features/presences/presences";
import {VoiceRoomBadge} from "@/features/voice/voice-ui";
import {useWorkspace} from "@/hooks/use-workspace";
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
import type {RouterInputs, RouterOutputs} from "@/server/router";
import {useAppSelector} from "@/store";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/")({
  component: RouteComponent,
});

// Native table elements styled with HeroUI's table classes (`tableVariants`). The blackboard
// relies on row components returning fragments of <tr>s, colSpan, and interactive cells, which
// fight React Aria's collection API (and a grid's keyboard handling would get in the way of the
// inline editors), so HeroUI's `Table` component isn't used. The "secondary" variant keeps cells
// transparent so the row status colors show through; cells are denser than HeroUI's default.
const tableSlots = tableVariants({variant: "secondary"});

function Table({className, ...props}: React.ComponentProps<"table">) {
  return (
    <div className={tableSlots.base()}>
      {/* The board's scroll box is the scroll container; an inner overflow box would stop the
          sticky header from sticking. */}
      <div className={tableSlots.scrollContainer({className: "overflow-visible"})}>
        <table className={tableSlots.content({className: cn("text-xs", className)})} {...props} />
      </div>
    </div>
  );
}

function TableHeader({className, ...props}: React.ComponentProps<"thead">) {
  return <thead className={tableSlots.header({className})} {...props} />;
}

function TableBody({className, ...props}: React.ComponentProps<"tbody">) {
  return <tbody className={tableSlots.body({className})} {...props} />;
}

function TableRow({className, ...props}: React.ComponentProps<"tr">) {
  return <tr className={tableSlots.row({className})} {...props} />;
}

function TableHead({className, ...props}: React.ComponentProps<"th">) {
  return (
    <th
      className={tableSlots.column({className: cn("px-2 whitespace-nowrap", className)})}
      {...props}
    />
  );
}

function TableCell({className, ...props}: React.ComponentProps<"td">) {
  return (
    <td
      className={tableSlots.cell({className: cn("p-2 text-xs whitespace-nowrap", className)})}
      {...props}
    />
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
  "-my-2 h-auto rounded-none border-0 bg-transparent p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 focus:outline-none dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950";
const PUZZLE_STATUS_TRIGGER_CLASS =
  "-my-2 h-auto rounded-none border-0 bg-transparent p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 focus:outline-none dark:hover:bg-amber-950 dark:focus:bg-amber-950";
const IMPORTANCE_TRIGGER_CLASS =
  "-my-2 h-auto w-auto rounded-none border-0 bg-transparent p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950 focus:outline-none";

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
  "absolute inset-0 items-center px-2 font-mono break-all whitespace-normal uppercase hover:bg-amber-100 focus-visible:bg-amber-100 focus-visible:outline-none dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950";

/**
 * Shows the (optimistic) answer; while focused it edits a local draft, committed on blur or Enter
 * (Escape discards it). Committing per keystroke would log half-typed answers to the activity feed.
 */
function AnswerInput({
  puzzleName,
  value,
  onCommit,
}: {
  puzzleName: string;
  value: string | null;
  onCommit: (answer: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const answer = draft.toUpperCase();
    if (answer !== (value ?? "")) onCommit(answer);
  };
  return (
    <input
      aria-label={`Answer for ${puzzleName}`}
      className={ANSWER_INPUT_CLASS}
      value={draft ?? value ?? ""}
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
  const [isEditing, setIsEditing] = useState(false);
  const form = useAppForm({defaultValues: {tags: value}});
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
        className="flex h-full w-full cursor-text flex-wrap items-center gap-1 p-1 hover:bg-amber-100 dark:hover:bg-amber-950">
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
          className="border-0 bg-amber-100 dark:bg-amber-950"
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
  const [activation, setActivation] = useState<{autoFocus: boolean} | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  if (activation) {
    return children({autoFocus: activation.autoFocus, isOpen, onOpenChange: setIsOpen});
  }
  const activateAndOpen = () => {
    setActivation({autoFocus: true});
    // Open on the next frame, once the real trigger has mounted and taken focus, so the popover
    // records it as the element to return focus to on close.
    requestAnimationFrame(() => setIsOpen(true));
  };
  const slots = selectVariants();
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
const FAVORITE_HIDDEN_CLASS =
  "opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100";

const isSolvedStatus = (status: string | null) => status === "solved" || status === "backsolved";

/**
 * Row color by status. Solved rows stay quiet (muted text, no fill) so the puzzles that still need
 * work stand out; only states that call for attention (needs eyes, extraction, stuck, …) get color.
 */
function getRowClassNamesForStatus(status: string | null) {
  return isSolvedStatus(status) ? "text-muted" : getBgColorClassNamesForPuzzleStatus(status);
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

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  const [isAddNewRoundDialogOpen, setIsAddNewRoundDialogOpen] = useState(false);
  const [hideSolved, setHideSolved] = useLocalStorage("hideSolved", false);
  const [hideObsolete, setHideObsolete] = useLocalStorage("hideObsolete", false);
  const [hideSolvedMetas, setHideSolvedMetas] = useLocalStorage("hideSolvedMetas", false);
  const [onlyShowFavorites, setOnlyShowFavorites] = useLocalStorage("onlyShowFavorites", false);
  const [search, setSearch] = useState("");
  // "/" focuses the search box (unless you're already typing somewhere).
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const isTyping =
        target !== null &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (e.key === "/" && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  const [tags, setTags] = useLocalStorage<(string | null)[]>("tags", []);
  const [importances, setImportances] = useLocalStorage<(string | null)[]>("importances", []);

  // Read once here and handed to rows as booleans: a per-row subscription would re-render every
  // row whenever any favorite changes. (Suspends like the rows used to, so stars never flash.)
  const favoritePuzzleIds = toStringArray(
    useSuspenseQuery(orpc.workspaces.members.get.queryOptions({input: {workspaceSlug}})).data
      .favoritePuzzleIds
  );
  const favoriteSet = new Set(favoritePuzzleIds);
  // From the unfiltered rounds, so "Hide solved" doesn't change a round's progress.
  const roundProgress = new Map(
    workspace.rounds.map(r => [
      r.id,
      {solved: r.puzzles.filter(p => isSolvedStatus(p.status)).length, total: r.puzzles.length},
    ])
  );

  type Filterable = {
    id: string;
    name: string;
    tags: string[];
    importance: string | null;
    status: string | null;
  };
  const query = search.toLowerCase();
  const matches = (p: Filterable) =>
    p.name.toLowerCase().includes(query) &&
    (tags.length === 0 ||
      tags.some(tag => (tag === null ? p.tags.length === 0 : p.tags.includes(tag)))) &&
    (importances.length === 0 || importances.includes(p.importance)) &&
    (!hideObsolete || p.importance !== "obsolete") &&
    (!hideSolved || (p.status !== "solved" && p.status !== "backsolved")) &&
    (!onlyShowFavorites || favoriteSet.has(p.id));
  const rounds = workspace.rounds.map(r => {
    const puzzles = filtered(r.puzzles, matches);
    const metaPuzzles = filtered(
      r.metaPuzzles.map(m => {
        const childPuzzles = filtered(m.childPuzzles, matches);
        return childPuzzles === m.childPuzzles ? m : {...m, childPuzzles};
      }),
      m => (m.childPuzzles.length > 0 || matches(m)) && (!hideSolvedMetas || m.status !== "solved")
    );
    const unassignedPuzzles = filtered(r.unassignedPuzzles, matches);
    return puzzles === r.puzzles &&
      unassignedPuzzles === r.unassignedPuzzles &&
      metaPuzzles.length === r.metaPuzzles.length &&
      metaPuzzles.every((m, i) => m === r.metaPuzzles[i])
      ? r
      : {...r, puzzles, metaPuzzles, unassignedPuzzles};
  });

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
            <div className="flex shrink-0 gap-2 p-2">
              <SearchField
                aria-label="Search puzzles"
                className="flex-1"
                fullWidth
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
              <Dropdown>
                <Button variant="outline">
                  <FunnelIcon />
                  Filter
                  {filterCount > 0 && (
                    <Chip className="ml-1 rounded-full" size="sm" variant="secondary">
                      {filterCount}
                    </Chip>
                  )}
                </Button>
                <Dropdown.Popover className="w-fit">
                  <Dropdown.Menu>
                    <Dropdown.SubmenuTrigger>
                      <Dropdown.Item id="tags-submenu" textValue="Tags">
                        <TagIcon />
                        <Label>Tags</Label>
                        <Dropdown.SubmenuIndicator />
                      </Dropdown.Item>
                      <Dropdown.Popover>
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
                    </Dropdown.SubmenuTrigger>
                    <Dropdown.SubmenuTrigger>
                      <Dropdown.Item id="importance-submenu" textValue="Importance">
                        <SignalIcon />
                        <Label>Importance</Label>
                        <Dropdown.SubmenuIndicator />
                      </Dropdown.Item>
                      <Dropdown.Popover>
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
                    </Dropdown.SubmenuTrigger>
                    <Dropdown.Section
                      selectionMode="multiple"
                      selectedKeys={
                        new Set<Key>(
                          [
                            hideSolved && "hideSolved",
                            hideObsolete && "hideObsolete",
                            hideSolvedMetas && "hideSolvedMetas",
                            onlyShowFavorites && "onlyShowFavorites",
                          ].filter(key => key !== false)
                        )
                      }
                      onSelectionChange={keys => {
                        const set = keys === "all" ? null : keys;
                        const has = (k: string) => (set === null ? true : set.has(k));
                        setHideSolved(has("hideSolved"));
                        setHideObsolete(has("hideObsolete"));
                        setHideSolvedMetas(has("hideSolvedMetas"));
                        setOnlyShowFavorites(has("onlyShowFavorites"));
                      }}>
                      <Dropdown.Item id="hideSolved" textValue="Hide solved puzzles">
                        <Dropdown.ItemIndicator />
                        <Label>Hide solved puzzles</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="hideObsolete" textValue="Hide obsolete puzzles">
                        <Dropdown.ItemIndicator />
                        <Label>Hide obsolete puzzles</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="hideSolvedMetas" textValue="Hide solved meta puzzles">
                        <Dropdown.ItemIndicator />
                        <Label>Hide solved meta puzzles</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="onlyShowFavorites" textValue="Only show favorites">
                        <Dropdown.ItemIndicator />
                        <Label>Only show favorites</Label>
                      </Dropdown.Item>
                    </Dropdown.Section>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="min-w-0">
                <Table className="h-fit">
                  <TableHeader className="bg-background sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-8 p-0" colSpan={1} />
                      <TableHead className="w-8 p-0" colSpan={1} />
                      <TableHead>Name</TableHead>
                      <TableHead className="min-w-[150px]">Solution</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-0 px-2">
                        <Tooltip delay={300}>
                          <Tooltip.Trigger>
                            {/* Icon-only header keeps the column as narrow as its icons. */}
                            <Button isIconOnly size="sm" variant="ghost" aria-label="Importance">
                              <SignalIcon />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Content>Importance</Tooltip.Content>
                        </Tooltip>
                      </TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Working on this</TableHead>
                      <TableHead className="w-0">
                        <div className="-my-1 flex items-center justify-end">
                          <Dropdown>
                            <Button variant="ghost" isIconOnly className="-my-3">
                              <EllipsisIcon />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                            <Dropdown.Popover className="w-fit" placement="bottom end">
                              <Dropdown.Menu>
                                <Dropdown.Item
                                  id="add-new-round"
                                  textValue="Add new round"
                                  onAction={() => setIsAddNewRoundDialogOpen(true)}>
                                  <Label>Add new round</Label>
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                          {/* Mounted only while open: rows would otherwise each keep several idle dialogs. */}
                          {isAddNewRoundDialogOpen && (
                            <AddNewRoundDialog
                              workspaceSlug={workspaceSlug}
                              open={isAddNewRoundDialogOpen}
                              setOpen={setIsAddNewRoundDialogOpen}
                            />
                          )}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rounds.map(round => (
                      <BlackboardRound
                        key={round.id}
                        workspaceSlug={workspaceSlug}
                        round={round}
                        solvedCount={roundProgress.get(round.id)?.solved ?? 0}
                        puzzleCount={roundProgress.get(round.id)?.total ?? 0}
                        tags={workspace.tags}
                        favoritePuzzleIds={favoriteSet}
                      />
                    ))}
                    {/* Gets rid of the scroll bar when the last row is hidden. */}
                    <TableRow>
                      <TableCell colSpan={9} className="py-0" />
                    </TableRow>
                  </TableBody>
                </Table>
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
  solvedCount,
  puzzleCount,
  tags,
  favoritePuzzleIds,
}: {
  workspaceSlug: string;
  round: WorkspaceRoomState["rounds"][0];
  /** Progress across the whole round, regardless of the active filters. */
  solvedCount: number;
  puzzleCount: number;
  tags: string[];
  favoritePuzzleIds: ReadonlySet<string>;
}) {
  const {mutate: updateRound} = useMutation(workspaceMutations.rounds.update());
  const isBeingCreated = useIsBeingCreated(round.id, orpc.rounds.create.mutationKey());
  const [isAddNewMetaPuzzleDialogOpen, setIsAddNewMetaPuzzleDialogOpen] = useState(false);
  const [isAddNewUnassignedPuzzleDialogOpen, setIsAddNewUnassignedPuzzleDialogOpen] =
    useState(false);
  const [isEditRoundDialogOpen, setIsEditRoundDialogOpen] = useState(false);
  const [isDeleteRoundDialogOpen, setIsDeleteRoundDialogOpen] = useState(false);
  const [isAssignedUnassignedPuzzlesDialogOpen, setIsAssignUnassignedPuzzlesDialogOpen] =
    useState(false);

  const [isCollapsed, setIsCollapsed] = useLocalStorage(`isCollapsed-${round.id}`, false);
  const [isUnassignedCollapsed, setIsUnassignedCollapsed] = useLocalStorage(
    `isUnassignedCollapsed-${round.id}`,
    false
  );

  function onStatusChange(value: string | null) {
    if (round.status !== value) updateRound({workspaceSlug, id: round.id, status: value});
  }

  return (
    <>
      <TableRow
        // Target of the sidebar's round links.
        id={round.id}
        className="bg-surface-secondary text-foreground group scroll-mt-20">
        <TableCell className="-p-2 relative">
          <div
            className={cn(
              "absolute flex-col items-center justify-center inset-0 group-hover:flex h-full",
              round.status === "solved" ? "hidden" : "flex"
            )}>
            <Button
              variant="ghost"
              isIconOnly
              aria-label={`Toggle round ${round.name}`}
              aria-expanded={!isCollapsed}
              className="relative scroll-mt-20 select-none"
              onPress={() => {
                setIsCollapsed(!isCollapsed);
              }}>
              <ChevronRightIcon className={cn("transition", !isCollapsed && "rotate-90")} />
            </Button>
          </div>
          {round.status === "solved" && (
            <div className="absolute inset-0 flex h-full flex-col items-center justify-center group-hover:hidden">
              <CheckIcon className="size-3.5 text-green-500" />
            </div>
          )}
        </TableCell>
        <TableCell colSpan={3}>
          <div className="flex items-center gap-3">
            <span className="text-foreground truncate text-sm font-semibold">{round.name}</span>
            {puzzleCount > 0 && (
              <div className="flex shrink-0 items-center gap-2">
                <ProgressBar
                  aria-label={`${round.name}: ${solvedCount} of ${puzzleCount} puzzles solved`}
                  value={(solvedCount / puzzleCount) * 100}
                  size="sm"
                  color={solvedCount === puzzleCount ? "success" : "accent"}
                  className="w-20 gap-0">
                  <ProgressBar.Track className="w-full">
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
                <span className="text-muted text-xs tabular-nums" aria-hidden="true">
                  {solvedCount}/{puzzleCount}
                </span>
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <DeferredSelect
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
        </TableCell>
        <TableCell colSpan={3} />
        <TableCell>
          <div className="-my-3 flex items-center justify-end">
            <Dropdown>
              <Button isDisabled={isBeingCreated} variant="ghost" isIconOnly>
                <EllipsisIcon />
                <span className="sr-only">Toggle menu</span>
              </Button>
              <Dropdown.Popover className="w-fit" placement="bottom end">
                <Dropdown.Menu>
                  <Dropdown.Item
                    id="add-meta"
                    textValue="Add new meta puzzle"
                    onAction={() => setIsAddNewMetaPuzzleDialogOpen(true)}>
                    <Label>Add new meta puzzle</Label>
                  </Dropdown.Item>
                  {round.metaPuzzles.length > 0 ? (
                    <Dropdown.Item
                      id="add-unassigned-disabled"
                      textValue="Add new unassigned puzzle"
                      isDisabled
                      // Disabled menu items get `pointer-events: none`; re-enable them so the
                      // explanatory tooltip can still be hovered.
                      className="pointer-events-auto!">
                      <Label>Add new unassigned puzzle</Label>
                      <Tooltip>
                        <Tooltip.Trigger>
                          <InfoIcon className="ms-auto" />
                        </Tooltip.Trigger>
                        <Tooltip.Content placement="left">
                          You can only add unassigned puzzles when there are no meta puzzles in the
                          round.
                        </Tooltip.Content>
                      </Tooltip>
                    </Dropdown.Item>
                  ) : (
                    <Dropdown.Item
                      id="add-unassigned"
                      textValue="Add new unassigned puzzle"
                      onAction={() => setIsAddNewUnassignedPuzzleDialogOpen(true)}>
                      <Label>Add new unassigned puzzle</Label>
                    </Dropdown.Item>
                  )}
                  <Dropdown.Item
                    id="edit-round"
                    textValue="Edit round"
                    onAction={() => setIsEditRoundDialogOpen(true)}>
                    <Label>Edit round</Label>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="delete-round"
                    textValue="Delete round"
                    onAction={() => setIsDeleteRoundDialogOpen(true)}>
                    <Label>Delete round</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
          {isAddNewMetaPuzzleDialogOpen && (
            <AddNewMetaPuzzleDialog
              workspaceSlug={workspaceSlug}
              roundId={round.id}
              open={isAddNewMetaPuzzleDialogOpen}
              setOpen={setIsAddNewMetaPuzzleDialogOpen}
            />
          )}
          {isAddNewUnassignedPuzzleDialogOpen && (
            <AddNewPuzzleDialog
              workspaceSlug={workspaceSlug}
              roundId={round.id}
              open={isAddNewUnassignedPuzzleDialogOpen}
              setOpen={setIsAddNewUnassignedPuzzleDialogOpen}
            />
          )}
          {isEditRoundDialogOpen && (
            <EditRoundDialog
              workspaceSlug={workspaceSlug}
              round={round}
              open={isEditRoundDialogOpen}
              setOpen={setIsEditRoundDialogOpen}
            />
          )}
          {isDeleteRoundDialogOpen && (
            <DeleteRoundDialog
              workspaceSlug={workspaceSlug}
              roundId={round.id}
              open={isDeleteRoundDialogOpen}
              setOpen={setIsDeleteRoundDialogOpen}
            />
          )}
        </TableCell>
      </TableRow>
      {round.metaPuzzles.map(metaPuzzle => (
        <BlackboardMetaPuzzle
          key={metaPuzzle.id}
          workspaceSlug={workspaceSlug}
          metaPuzzle={metaPuzzle}
          isParentCollapsed={isCollapsed}
          tags={tags}
          favoritePuzzleIds={favoritePuzzleIds}
        />
      ))}
      {round.unassignedPuzzles.length > 0 && (
        <>
          <TableRow className={cn("group", isCollapsed ? "collapse" : "")}>
            <TableCell className="p-0" />
            <TableCell className="relative p-0">
              <div
                className={cn(
                  "absolute flex-col items-center justify-center inset-0 group-hover:flex h-full",
                  !isUnassignedCollapsed ? "hidden" : "flex"
                )}>
                <Button
                  variant="ghost"
                  isIconOnly
                  aria-label="Toggle unassigned puzzles"
                  aria-expanded={!isUnassignedCollapsed}
                  className="relative scroll-mt-20 select-none"
                  style={{color: "grey"}}
                  onPress={() => {
                    setIsUnassignedCollapsed(v => !v);
                  }}>
                  <ChevronRightIcon
                    className={cn("transition", !isUnassignedCollapsed && "rotate-90")}
                  />
                </Button>
              </div>
              {!isUnassignedCollapsed && (
                <div className="absolute inset-0 flex h-full flex-col items-center justify-center group-hover:hidden">
                  <div className={cn("flex-1", isUnassignedCollapsed && "hidden")} />
                  <div
                    style={{
                      backgroundColor: isUnassignedCollapsed ? "transparent" : "grey",
                      borderColor: "grey",
                    }}
                    className="size-2 rounded-full border"></div>
                  <div
                    style={{backgroundColor: "grey"}}
                    className={cn("w-px flex-1", isUnassignedCollapsed && "hidden")}></div>
                </div>
              )}
            </TableCell>
            <TableCell className="font-semibold italic" colSpan={6}>
              Unassigned Puzzles
            </TableCell>
            <TableCell>
              <div className="-my-3 flex items-center justify-end">
                <Dropdown>
                  <Button isDisabled={isBeingCreated} variant="ghost" isIconOnly>
                    <EllipsisIcon />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                  <Dropdown.Popover className="w-fit" placement="bottom end">
                    <Dropdown.Menu>
                      <Dropdown.Item
                        id="assign-all"
                        textValue="Assign all unassigned puzzles"
                        onAction={() => setIsAssignUnassignedPuzzlesDialogOpen(true)}>
                        <Label>Assign all unassigned puzzles</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>
              {isAssignedUnassignedPuzzlesDialogOpen && (
                <AssignUnassignedPuzzlesDialog
                  workspaceSlug={workspaceSlug}
                  roundId={round.id}
                  open={isAssignedUnassignedPuzzlesDialogOpen}
                  setOpen={setIsAssignUnassignedPuzzlesDialogOpen}
                />
              )}
            </TableCell>
          </TableRow>
          {round.unassignedPuzzles.map(puzzle => (
            <BlackboardPuzzle
              color="grey"
              key={puzzle.id}
              workspaceSlug={workspaceSlug}
              puzzle={puzzle}
              isCollapsed={isCollapsed || isUnassignedCollapsed}
              isLast={puzzle === round.unassignedPuzzles[round.unassignedPuzzles.length - 1]}
              tags={tags}
              isFavorite={favoritePuzzleIds.has(puzzle.id)}
            />
          ))}
        </>
      )}
    </>
  );
});

const BlackboardMetaPuzzle = memo(function BlackboardMetaPuzzle({
  workspaceSlug,
  metaPuzzle,
  isParentCollapsed,
  tags,
  favoritePuzzleIds,
}: {
  workspaceSlug: string;
  metaPuzzle: RouterOutputs["rounds"]["list"][0]["metaPuzzles"][0];
  isParentCollapsed: boolean;
  tags: string[];
  favoritePuzzleIds: ReadonlySet<string>;
}) {
  const {mutate: updatePuzzle} = useMutation(workspaceMutations.puzzles.update());
  const update = (patch: Omit<RouterInputs["puzzles"]["update"], "workspaceSlug" | "id">) =>
    updatePuzzle({workspaceSlug, id: metaPuzzle.id, ...patch});
  const isBeingCreated = useIsBeingCreated(metaPuzzle.id);
  const [isAddNewPuzzleFeedingThisMetaDialogOpen, setIsAddNewPuzzleFeedingThisMetaDialogOpen] =
    useState(false);
  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);
  const [isDeletePuzzleDialogOpen, setIsDeletePuzzleDialogOpen] = useState(false);
  const isFavorite = favoritePuzzleIds.has(metaPuzzle.id);
  const toggleFavorite = useToggleFavorite(workspaceSlug);

  const [isCollapsed, setIsCollapsed] = useLocalStorage(`isCollapsed-${metaPuzzle.id}`, false);
  const color = ((id: string) => {
    const hash = sha256(id);
    let hue = parseInt(hash.substring(0, 4), 16) % (360 - 150);
    if (hue > 30) {
      hue += 150;
    }
    let saturation, lightness;
    saturation = (parseInt(hash.substring(4, 6), 16) / 255.0) ** 0.5 * 80 + 50;
    lightness = (parseInt(hash.substring(6, 8), 16) / 255.0) ** 0.5 * 70;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  })(metaPuzzle.id);

  const presences = useAppSelector(state => state.presences.value[metaPuzzle.id]) ?? NO_PRESENCES;

  return (
    <>
      <TableRow
        // Target of the sidebar's puzzle links. (Not on the toggle button: that's display:none
        // while the meta is expanded, and a hidden element can't be scrolled to.)
        id={metaPuzzle.id}
        className={cn(
          "group group/row scroll-mt-20",
          getRowClassNamesForStatus(metaPuzzle.status),
          getRowClassNamesForImportance(metaPuzzle.importance, metaPuzzle.status),
          isBeingCreated && "pointer-events-none cursor-wait opacity-70",
          isParentCollapsed ? "collapse" : ""
        )}>
        <TableCell className="p-0">
          {metaPuzzle.link && (
            <a
              className={buttonVariants({variant: "ghost", isIconOnly: true})}
              aria-label={`Hunt link to ${metaPuzzle.name}`}
              href={metaPuzzle.link}
              target="_blank"
              rel="noopener noreferrer">
              <PuzzleIcon className="text-muted group-hover/row:text-accent group-focus-within/row:text-accent transition-colors" />
            </a>
          )}
        </TableCell>
        <TableCell className="relative p-0">
          <div
            className={cn(
              "absolute flex-col items-center justify-center inset-0 group-hover:flex h-full",
              !isCollapsed ? "hidden" : "flex"
            )}>
            <Button
              variant="ghost"
              isIconOnly
              aria-label={`Toggle meta puzzle ${metaPuzzle.name}`}
              aria-expanded={!isCollapsed}
              className="relative scroll-mt-20 select-none"
              style={{color}}
              onPress={() => {
                setIsCollapsed(v => !v);
              }}>
              <ChevronRightIcon className={cn("transition", !isCollapsed && "rotate-90")} />
            </Button>
          </div>
          {!isCollapsed && (
            <div className="absolute inset-0 flex h-full flex-col items-center justify-center group-hover:hidden">
              <div className={cn("flex-1", isCollapsed && "hidden")} />
              <div
                style={{backgroundColor: isCollapsed ? "transparent" : color, borderColor: color}}
                className="size-2 rounded-full border"></div>
              <div
                style={{backgroundColor: color}}
                className={cn("w-px flex-1", isCollapsed && "hidden")}></div>
            </div>
          )}
        </TableCell>
        <TableCell className="font-semibold">
          <Link
            to="/$workspaceSlug/puzzles/$puzzleId"
            params={{workspaceSlug, puzzleId: metaPuzzle.id}}
            className="-m-2 block p-2 hover:underline">
            <SolvedMark status={metaPuzzle.status} />
            {metaPuzzle.name}
          </Link>
        </TableCell>
        <TableCell className="relative">
          <AnswerInput
            puzzleName={metaPuzzle.name}
            value={metaPuzzle.answer}
            onCommit={answer => update({answer})}
          />
        </TableCell>
        <TableCell>
          <PuzzleStatusSelect
            value={metaPuzzle.status}
            onChange={status => {
              if (status !== metaPuzzle.status) update({status});
            }}
            triggerClassName={SELECT_TRIGGER_CLASS}
          />
        </TableCell>
        <TableCell>
          <PuzzleImportanceSelect
            value={metaPuzzle.importance}
            onChange={importance => {
              if (importance !== metaPuzzle.importance) update({importance});
            }}
            triggerClassName={cn(
              IMPORTANCE_TRIGGER_CLASS,
              getImportanceCellClassNames(metaPuzzle.importance, metaPuzzle.status)
            )}
          />
        </TableCell>
        <TableCell className="p-0">
          <TagsCell
            puzzleName={metaPuzzle.name}
            value={metaPuzzle.tags}
            tags={tags}
            onCommit={next => update({tags: next})}
          />
        </TableCell>
        <TableCell className="py-1">
          <UserPresenceAvatars users={presences} />
        </TableCell>
        <TableCell>
          <div className="-my-3 flex items-center justify-end">
            <ToggleButton
              variant="ghost"
              isIconOnly
              aria-label="Favorite"
              isSelected={isFavorite}
              onChange={value => toggleFavorite(metaPuzzle.id, value)}
              className={cn("group/toggle", !isFavorite && FAVORITE_HIDDEN_CLASS)}>
              <StarIcon className="stroke-muted group-data-selected/toggle:fill-accent group-data-selected/toggle:stroke-accent" />
            </ToggleButton>
            <Dropdown>
              <Button variant="ghost" isIconOnly>
                <EllipsisIcon />
                <span className="sr-only">Toggle menu</span>
              </Button>
              <Dropdown.Popover className="w-fit" placement="bottom end">
                <Dropdown.Menu>
                  <Dropdown.Item
                    id="add-feeding"
                    textValue="Add new puzzle feeding this meta puzzle"
                    onAction={() => setIsAddNewPuzzleFeedingThisMetaDialogOpen(true)}>
                    <Label>Add new puzzle feeding this meta puzzle</Label>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="edit-meta"
                    textValue="Edit this meta puzzle"
                    onAction={() => setIsEditPuzzleDialogOpen(true)}>
                    <Label>Edit this meta puzzle</Label>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="delete-meta"
                    textValue="Delete this meta puzzle"
                    onAction={() => setIsDeletePuzzleDialogOpen(true)}>
                    <Label>Delete this meta puzzle</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
          {isAddNewPuzzleFeedingThisMetaDialogOpen && (
            <AddNewPuzzleDialog
              workspaceSlug={workspaceSlug}
              roundId={metaPuzzle.roundId}
              parentPuzzleId={metaPuzzle.id}
              open={isAddNewPuzzleFeedingThisMetaDialogOpen}
              setOpen={setIsAddNewPuzzleFeedingThisMetaDialogOpen}
            />
          )}
          {isEditPuzzleDialogOpen && (
            <EditPuzzleDialog
              workspaceSlug={workspaceSlug}
              puzzle={metaPuzzle}
              open={isEditPuzzleDialogOpen}
              setOpen={setIsEditPuzzleDialogOpen}
            />
          )}
          {isDeletePuzzleDialogOpen && (
            <DeletePuzzleDialog
              workspaceSlug={workspaceSlug}
              puzzleId={metaPuzzle.id}
              open={isDeletePuzzleDialogOpen}
              setOpen={setIsDeletePuzzleDialogOpen}
            />
          )}
        </TableCell>
      </TableRow>
      {metaPuzzle.childPuzzles.map((puzzle, idx) => (
        <BlackboardPuzzle
          key={puzzle.id}
          workspaceSlug={workspaceSlug}
          color={color}
          puzzle={puzzle}
          isCollapsed={isParentCollapsed || isCollapsed}
          isLast={idx === metaPuzzle.childPuzzles.length - 1}
          tags={tags}
          isFavorite={favoritePuzzleIds.has(puzzle.id)}
        />
      ))}
      {metaPuzzle.childPuzzles.length === 0 && !isParentCollapsed && !isCollapsed && (
        <TableRow>
          <TableCell colSpan={1} />
          <TableCell className="p-0">
            <div className="flex h-full flex-col">
              <div className="flex flex-1 items-stretch">
                <div className="flex-1" />
                <div className="w-px" style={{backgroundColor: color, borderColor: color}} />
                <div className="flex-1" />
              </div>
              <div className="flex items-center">
                <div className="flex-1" />
                <div className="h-px w-px" style={{backgroundColor: color, borderColor: color}} />
                <div className="h-px flex-1" style={{backgroundColor: color}} />
              </div>
              <div className="flex flex-1 items-stretch"></div>
            </div>
            <span className="relative scroll-mt-20" />
          </TableCell>
          <TableCell colSpan={6} className="text-muted text-xs italic">
            There are no visible puzzles feeding this meta puzzle.
          </TableCell>
        </TableRow>
      )}
    </>
  );
});

const BlackboardPuzzle = memo(function BlackboardPuzzle({
  workspaceSlug,
  puzzle,
  color,
  isCollapsed,
  isLast,
  tags,
  isFavorite,
}: {
  workspaceSlug: string;
  puzzle: RouterOutputs["rounds"]["list"][0]["puzzles"][0]["childPuzzles"][0];
  color?: string;
  isCollapsed?: boolean;
  isLast?: boolean;
  tags: string[];
  isFavorite: boolean;
}) {
  const {mutate: updatePuzzle} = useMutation(workspaceMutations.puzzles.update());
  const update = (patch: Omit<RouterInputs["puzzles"]["update"], "workspaceSlug" | "id">) =>
    updatePuzzle({workspaceSlug, id: puzzle.id, ...patch});
  const isBeingCreated = useIsBeingCreated(puzzle.id);
  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);
  const [isDeletePuzzleDialogOpen, setIsDeletePuzzleDialogOpen] = useState(false);
  const toggleFavorite = useToggleFavorite(workspaceSlug);
  const presences = useAppSelector(state => state.presences.value[puzzle.id]) ?? NO_PRESENCES;

  return (
    <>
      <TableRow
        className={cn(
          "group/row",
          getRowClassNamesForStatus(puzzle.status),
          getRowClassNamesForImportance(puzzle.importance, puzzle.status),
          isBeingCreated && "pointer-events-none cursor-wait opacity-70",
          isCollapsed ? "collapse" : ""
        )}>
        <TableCell className="p-0">
          {puzzle.link && (
            <a
              className={buttonVariants({variant: "ghost", isIconOnly: true})}
              title="Hunt Link to this puzzle"
              aria-label={`Hunt link to ${puzzle.name}`}
              href={puzzle.link}
              target="_blank"
              rel="noopener noreferrer">
              <PuzzleIcon className="text-muted group-hover/row:text-accent group-focus-within/row:text-accent transition-colors" />
            </a>
          )}
        </TableCell>
        <TableCell className="p-0">
          <div className="flex h-full flex-col">
            <div className="flex flex-1 items-stretch">
              <div className="flex-1" />
              <div className="w-px" style={{backgroundColor: color, borderColor: color}} />
              <div className="flex-1" />
            </div>
            <div className="flex items-center">
              <div className="flex-1" />
              <div className="h-px w-px" style={{backgroundColor: color, borderColor: color}} />
              <div className="h-px flex-1" style={{backgroundColor: color}} />
            </div>
            <div className="flex flex-1 items-stretch">
              <div className="flex-1" />
              <div
                className={cn("w-px", isLast && "hidden")}
                style={{backgroundColor: color, borderColor: color}}
              />
              <div className="flex-1" />
            </div>
          </div>
          <span id={puzzle.id} className="relative scroll-mt-20" />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Link
              to="/$workspaceSlug/puzzles/$puzzleId"
              params={{workspaceSlug, puzzleId: puzzle.id}}
              className="-m-2 block min-w-0 flex-1 p-2 hover:underline">
              <SolvedMark status={puzzle.status} />
              {puzzle.name}
            </Link>
            <VoiceRoomBadge room={puzzle.id} />
          </div>
        </TableCell>
        <TableCell className="relative">
          <AnswerInput
            puzzleName={puzzle.name}
            value={puzzle.answer}
            onCommit={answer => update({answer})}
          />
        </TableCell>
        <TableCell>
          <PuzzleStatusSelect
            value={puzzle.status}
            onChange={status => {
              if (status !== puzzle.status) update({status});
            }}
            triggerClassName={PUZZLE_STATUS_TRIGGER_CLASS}
          />
        </TableCell>
        <TableCell>
          <PuzzleImportanceSelect
            value={puzzle.importance}
            onChange={importance => {
              if (importance !== puzzle.importance) update({importance});
            }}
            triggerClassName={cn(
              IMPORTANCE_TRIGGER_CLASS,
              getImportanceCellClassNames(puzzle.importance, puzzle.status)
            )}
          />
        </TableCell>
        <TableCell className="p-0">
          <TagsCell
            puzzleName={puzzle.name}
            value={puzzle.tags}
            tags={tags}
            onCommit={next => update({tags: next})}
          />
        </TableCell>
        <TableCell className="py-1">
          <UserPresenceAvatars users={presences} />
        </TableCell>
        <TableCell>
          <div className="-my-3 flex items-center justify-end">
            <ToggleButton
              variant="ghost"
              isIconOnly
              aria-label="Favorite"
              isSelected={isFavorite}
              onChange={value => toggleFavorite(puzzle.id, value)}
              className={cn("group/toggle", !isFavorite && FAVORITE_HIDDEN_CLASS)}>
              <StarIcon className="stroke-muted group-data-selected/toggle:fill-accent group-data-selected/toggle:stroke-accent" />
            </ToggleButton>
            <Dropdown>
              <Button variant="ghost" isIconOnly>
                <EllipsisIcon />
                <span className="sr-only">Toggle menu</span>
              </Button>
              <Dropdown.Popover className="w-fit" placement="bottom end">
                <Dropdown.Menu>
                  <Dropdown.Item
                    id="edit-puzzle"
                    textValue="Edit this puzzle"
                    onAction={() => setIsEditPuzzleDialogOpen(true)}>
                    <Label>Edit this puzzle</Label>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="delete-puzzle"
                    textValue="Delete this puzzle"
                    onAction={() => setIsDeletePuzzleDialogOpen(true)}>
                    <Label>Delete this puzzle</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
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
              open={isDeletePuzzleDialogOpen}
              setOpen={setIsDeletePuzzleDialogOpen}
            />
          )}
        </TableCell>
      </TableRow>
    </>
  );
});
