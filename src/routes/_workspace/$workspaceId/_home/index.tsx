import {createFileRoute, Link} from "@tanstack/react-router";
import {useLocalStorage} from "@uidotdev/usehooks";
import {sha256} from "js-sha256";
import {
  CheckIcon,
  ChevronRightIcon,
  EllipsisIcon,
  FunnelIcon,
  InfoIcon,
  PuzzleIcon,
  SearchIcon,
  SignalHighIcon,
  SignalIcon,
  SignalLowIcon,
  SignalMediumIcon,
  SignalZeroIcon,
  TagIcon,
} from "lucide-react";
import {useRef, useState} from "react";
import {toast} from "sonner";

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
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";
import {ScrollArea} from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {useWorkspace} from "@/components/use-workspace";
import {gravatarUrl, UserHoverCard} from "@/components/user-hover-card";
import {
  getBgColorClassNamesForPuzzleStatus,
  getPuzzleStatusGroups,
  getPuzzleStatusOptions,
} from "@/lib/puzzleStatuses";
import {cn} from "@/lib/utils";
import {RouterOutputs} from "@/server/router";
import {useAppSelector} from "@/store";

export const Route = createFileRoute("/_workspace/$workspaceId/_home/")({
  component: RouteComponent,
});

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

function RouteComponent() {
  const {workspaceId} = Route.useParams();
  const workspace = useWorkspace({workspaceId});
  const [isAddNewRoundDialogOpen, setIsAddNewRoundDialogOpen] = useState(false);
  const [hideSolved, setHideSolved] = useLocalStorage("hideSolved", false);
  const [hideObsolete, setHideObsolete] = useLocalStorage("hideObsolete", false);
  const [hideSolvedMetas, setHideSolvedMetas] = useLocalStorage("hideSolvedMetas", false);
  const [search, setSearch] = useState("");
  const [tags, setTags] = useLocalStorage<(string | null)[]>("tags", []);
  const [importances, setImportances] = useLocalStorage<(string | null)[]>("importances", []);

  const rounds = workspace.get.data.rounds.map(r => ({
    ...r,
    puzzles: r.puzzles
      .map((p, puzzleIndex) => ({...p, puzzleIndex: puzzleIndex + 1}))
      .filter(
        p =>
          p.name.toLowerCase().includes(search.toLowerCase()) &&
          (tags.length === 0 ||
            tags.some(tag => (tag === null ? p.tags.length === 0 : p.tags.includes(tag)))) &&
          (importances.length === 0 || importances.includes(p.importance)) &&
          (!hideObsolete || p.importance !== "obsolete") &&
          (!hideSolved || (p.status !== "solved" && p.status !== "backsolved"))
      ),
    metaPuzzles: r.metaPuzzles
      .map(m => ({
        ...m,
        childPuzzles: m.childPuzzles
          .map((p, puzzleIndex) => ({...p, puzzleIndex}))
          .filter(
            p =>
              p.name.toLowerCase().includes(search.toLowerCase()) &&
              (tags.length === 0 ||
                tags.some(tag => (tag === null ? p.tags.length === 0 : p.tags.includes(tag)))) &&
              (importances.length === 0 || importances.includes(p.importance)) &&
              (!hideObsolete || p.importance !== "obsolete") &&
              (!hideSolved || (p.status !== "solved" && p.status !== "backsolved"))
          ),
      }))
      .filter(
        m =>
          (m.childPuzzles.length > 0 ||
            (m.name.toLowerCase().includes(search.toLowerCase()) &&
              (tags.length === 0 ||
                tags.some(tag => (tag === null ? m.tags.length === 0 : m.tags.includes(tag)))) &&
              (importances.length === 0 || importances.includes(m.importance)) &&
              (!hideObsolete || m.importance !== "obsolete") &&
              (!hideSolved || (m.status !== "solved" && m.status !== "backsolved")))) &&
          (!hideSolvedMetas || m.status !== "solved")
      ),
    unassignedPuzzles: r.unassignedPuzzles.filter(
      p =>
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        (tags.length === 0 ||
          tags.some(tag => (tag === null ? p.tags.length === 0 : p.tags.includes(tag)))) &&
        (importances.length === 0 || importances.includes(p.importance)) &&
        (!hideObsolete || p.importance !== "obsolete") &&
        (!hideSolved || (p.status !== "solved" && p.status !== "backsolved"))
    ),
  }));

  let filterCount = 0;
  if (tags.length > 0) filterCount += 1;
  if (hideSolved) filterCount += 1;
  if (hideObsolete) filterCount += 1;
  if (hideSolvedMetas) filterCount += 1;
  if (importances.length > 0) filterCount += 1;

  return (
    <div className="flex flex-1">
      <div className="relative flex-1">
        <div className="absolute inset-0 overflow-auto">
          <div className="flex flex-col divide-y flex-1">
            <div className="p-2 flex gap-2">
              <InputGroup className="flex-1">
                <InputGroupInput value={search} onChange={e => setSearch(e.target.value)} />
                <InputGroupAddon>
                  <SearchIcon className="text-muted-foreground" />
                </InputGroupAddon>
                {search.length > 0 && (
                  <InputGroupAddon align="inline-end">
                    <Button variant="link" onClick={() => setSearch("")}>
                      Clear
                    </Button>
                  </InputGroupAddon>
                )}
              </InputGroup>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline">
                      <FunnelIcon />
                      Filter
                      {filterCount > 0 && (
                        <Badge variant="outline" className="rounded-full ml-1">
                          {filterCount}
                        </Badge>
                      )}
                    </Button>
                  }
                />
                <DropdownMenuContent className="w-fit">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <TagIcon />
                      Tags
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {(workspace.get.data.tags as string[] | undefined)?.map(tag => (
                        <DropdownMenuCheckboxItem
                          key={tag}
                          checked={tags.includes(tag)}
                          onClick={() => {
                            setTags(prevTags =>
                              prevTags.includes(tag)
                                ? prevTags.filter(t => t !== tag)
                                : [...prevTags, tag]
                            );
                          }}>
                          {tag}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuCheckboxItem
                        checked={tags.includes(null)}
                        onClick={() => {
                          setTags(prevTags =>
                            prevTags.includes(null)
                              ? prevTags.filter(t => t !== null)
                              : [...prevTags, null]
                          );
                        }}>
                        (Untagged)
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        closeOnClick={false}
                        onClick={() =>
                          setTags([
                            ...((workspace.get.data.tags as string[] | undefined) ?? []),
                            null,
                          ])
                        }>
                        Select all
                      </DropdownMenuItem>
                      <DropdownMenuItem closeOnClick={false} onClick={() => setTags([])}>
                        Reset filter
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <SignalIcon />
                      Importance
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {[
                        {
                          value: "veryhigh",
                          label: (
                            <>
                              <SignalIcon /> Very High
                            </>
                          ),
                        },
                        {
                          value: "high",
                          label: (
                            <>
                              <SignalHighIcon /> High
                            </>
                          ),
                        },
                        {
                          value: "medium",
                          label: (
                            <>
                              <SignalMediumIcon /> Medium
                            </>
                          ),
                        },
                        {
                          value: "low",
                          label: (
                            <>
                              <SignalLowIcon /> Low
                            </>
                          ),
                        },
                        {
                          value: "obsolete",
                          label: (
                            <>
                              <SignalZeroIcon /> Obsolete
                            </>
                          ),
                        },
                        {
                          value: null,
                          label: (
                            <>
                              <SignalMediumIcon className="text-muted-foreground" />
                              None
                            </>
                          ),
                        },
                      ].map(importance => (
                        <DropdownMenuCheckboxItem
                          checked={importances.includes(importance.value)}
                          onClick={() => {
                            setImportances(prevImportances =>
                              prevImportances.includes(importance.value)
                                ? prevImportances.filter(t => t !== importance.value)
                                : [...prevImportances, importance.value]
                            );
                          }}>
                          {importance.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        closeOnClick={false}
                        onClick={() =>
                          setImportances(["veryhigh", "high", "medium", "low", "obsolete", null])
                        }>
                        Select all
                      </DropdownMenuItem>
                      <DropdownMenuItem closeOnClick={false} onClick={() => setImportances([])}>
                        Reset filter
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuCheckboxItem checked={hideSolved} onCheckedChange={setHideSolved}>
                    Hide solved puzzles
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={hideObsolete}
                    onCheckedChange={setHideObsolete}>
                    Hide obsolete puzzles
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={hideSolvedMetas}
                    onCheckedChange={setHideSolvedMetas}>
                    Hide solved meta puzzles
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <ScrollArea className="flex-1">
              <div className="overflow-hidden">
                <Table className="h-fit">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="p-0 w-8" colSpan={1} />
                      <TableHead className="p-0 w-8" colSpan={1} />
                      <TableHead>Name</TableHead>
                      <TableHead>Solution</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Importance</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Working on this</TableHead>
                      <TableHead className="w-0">
                        <div className="-my-1 flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" className="-my-3">
                                  <EllipsisIcon />
                                  <span className="sr-only">Toggle menu</span>
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-fit">
                              <DropdownMenuItem onClick={() => setIsAddNewRoundDialogOpen(true)}>
                                Add new round
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <AddNewRoundDialog
                            workspaceId={workspaceId!}
                            open={isAddNewRoundDialogOpen}
                            setOpen={setIsAddNewRoundDialogOpen}
                          />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rounds.map(round => (
                      <BlackboardRound key={round.id} workspaceId={workspaceId!} round={round} />
                    ))}
                    {/* Gets rid of the scroll bar when the last row is hidden. */}
                    <TableRow>
                      <TableCell colSpan={7} className="py-0" />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
      <AppSidebar workspaceId={workspaceId} rounds={rounds} />
    </div>
  );
}

function BlackboardRound({
  workspaceId,
  round,
}: {
  workspaceId: string;
  round: RouterOutputs["workspaces"]["get"]["rounds"][0];
}) {
  const workspace = useWorkspace({workspaceId});
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
    if (round.status !== value) {
      toast.promise(workspace.rounds.update.mutateAsync({id: round.id, status: value}), {
        loading: "Updating round status...",
        success: "Success! Round status updated.",
        error: "Oops! Something went wrong.",
      });
    }
  }

  return (
    <>
      <TableRow
        className={cn(
          "text-secondary-foreground group",
          round.status === "solved" ? "bg-green-100 dark:bg-green-950" : "bg-secondary"
        )}>
        <TableCell className="-p-2 relative">
          <div
            className={cn(
              "absolute flex-col items-center justify-center inset-0 group-hover:flex h-full",
              round.status === "solved" ? "hidden" : "flex"
            )}>
            <Button
              variant="ghost"
              size="icon"
              className="relative scroll-mt-20 select-none"
              onClick={() => {
                setIsCollapsed(!isCollapsed);
              }}>
              <ChevronRightIcon className={cn("transition", !isCollapsed && "rotate-90")} />
            </Button>
          </div>
          {round.status === "solved" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center h-full group-hover:hidden">
              <CheckIcon className="size-3.5 text-green-500" />
            </div>
          )}
        </TableCell>
        <TableCell colSpan={3} className="font-semibold text-muted-foreground">
          {round.name}
        </TableCell>
        <TableCell>
          <Select
            onValueChange={onStatusChange}
            value={round.status}
            items={[
              {value: null, label: "None"},
              {value: "solved", label: "Solved"},
            ]}>
            <SelectTrigger className="-my-2 h-auto rounded-none border-0 p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950 focus:outline-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None</SelectItem>
              <SelectItem value="solved" className={getBgColorClassNamesForPuzzleStatus("solved")}>
                Solved
              </SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell colSpan={3} />
        <TableCell>
          <div className="-my-3 flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button disabled={round.id === ""} variant="ghost" size="icon">
                    <EllipsisIcon />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-fit">
                <DropdownMenuItem onClick={() => setIsAddNewMetaPuzzleDialogOpen(true)}>
                  Add new meta puzzle
                </DropdownMenuItem>
                {round.metaPuzzles.length > 0 ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <DropdownMenuItem className="opacity-50" closeOnClick={false}>
                          Add new unassigned puzzle
                          <DropdownMenuShortcut>
                            <InfoIcon />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                      }
                    />
                    <TooltipContent side="left">
                      You can only add unassigned puzzles when there are no meta puzzles in the
                      round.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <DropdownMenuItem onClick={() => setIsAddNewUnassignedPuzzleDialogOpen(true)}>
                    Add new unassigned puzzle
                    <DropdownMenuShortcut>
                      <InfoIcon />
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setIsEditRoundDialogOpen(true)}>
                  Edit round
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsDeleteRoundDialogOpen(true)}>
                  Delete round
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <AddNewMetaPuzzleDialog
            workspaceId={workspaceId!}
            roundId={round.id}
            open={isAddNewMetaPuzzleDialogOpen}
            setOpen={setIsAddNewMetaPuzzleDialogOpen}
          />
          <AddNewPuzzleDialog
            workspaceId={workspaceId!}
            roundId={round.id}
            open={isAddNewUnassignedPuzzleDialogOpen}
            setOpen={setIsAddNewUnassignedPuzzleDialogOpen}
          />
          <EditRoundDialog
            workspaceId={workspaceId}
            round={round}
            open={isEditRoundDialogOpen}
            setOpen={setIsEditRoundDialogOpen}
          />
          <DeleteRoundDialog
            workspaceId={workspaceId}
            roundId={round.id}
            open={isDeleteRoundDialogOpen}
            setOpen={setIsDeleteRoundDialogOpen}
          />
        </TableCell>
      </TableRow>
      {round.metaPuzzles.map(metaPuzzle => (
        <BlackboardMetaPuzzle
          key={metaPuzzle.id}
          workspaceId={workspaceId}
          metaPuzzle={metaPuzzle}
          isParentCollapsed={isCollapsed}
        />
      ))}
      {round.unassignedPuzzles.length > 0 && (
        <>
          <TableRow className={cn("group", isCollapsed ? "collapse" : "")}>
            <TableCell className="p-0" />
            <TableCell className="p-0 relative">
              <div
                className={cn(
                  "absolute flex-col items-center justify-center inset-0 group-hover:flex h-full",
                  !isUnassignedCollapsed ? "hidden" : "flex"
                )}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative scroll-mt-20 select-none"
                  style={{color: "grey"}}
                  onClick={_e => {
                    setIsUnassignedCollapsed(v => !v);
                  }}>
                  <ChevronRightIcon
                    className={cn("transition", !isUnassignedCollapsed && "rotate-90")}
                  />
                </Button>
              </div>
              {!isUnassignedCollapsed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center h-full group-hover:hidden">
                  <div className={cn("flex-1", isUnassignedCollapsed && "hidden")} />
                  <div
                    style={{
                      backgroundColor: isUnassignedCollapsed ? "transparent" : "grey",
                      borderColor: "grey",
                    }}
                    className="rounded-full size-2 border"></div>
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
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button disabled={round.id === ""} variant="ghost" size="icon">
                        <EllipsisIcon />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-fit">
                    <DropdownMenuItem onClick={() => setIsAssignUnassignedPuzzlesDialogOpen(true)}>
                      Assign all unassigned puzzles
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <AssignUnassignedPuzzlesDialog
                workspaceId={workspaceId}
                roundId={round.id}
                open={isAssignedUnassignedPuzzlesDialogOpen}
                setOpen={setIsAssignUnassignedPuzzlesDialogOpen}
              />
            </TableCell>
          </TableRow>
          {round.unassignedPuzzles.map(puzzle => (
            <BlackboardPuzzle
              color="grey"
              key={puzzle.id}
              workspaceId={workspaceId}
              puzzle={puzzle}
              isCollapsed={isCollapsed || isUnassignedCollapsed}
              isLast={puzzle === round.unassignedPuzzles[round.unassignedPuzzles.length - 1]}
            />
          ))}
        </>
      )}
    </>
  );
}

function BlackboardMetaPuzzle({
  workspaceId,
  metaPuzzle,
  isParentCollapsed,
}: {
  workspaceId: string;
  metaPuzzle: RouterOutputs["rounds"]["list"][0]["metaPuzzles"][0];
  isParentCollapsed: boolean;
}) {
  const workspace = useWorkspace({workspaceId});
  const [isAddNewPuzzleFeedingThisMetaDialogOpen, setIsAddNewPuzzleFeedingThisMetaDialogOpen] =
    useState(false);
  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);
  const [isDeletePuzzleDialogOpen, setIsDeletePuzzleDialogOpen] = useState(false);
  const [isTagsEditing, setIsTagsEditing] = useState(false);

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

  const form = useAppForm({
    defaultValues: {
      answer: metaPuzzle.answer ?? "",
      status: metaPuzzle.status,
      importance: metaPuzzle.importance,
      tags: metaPuzzle.tags,
    },
    onSubmit: ({value}) => {
      toast.promise(workspace.puzzles.update.mutateAsync({id: metaPuzzle.id, ...value}), {
        loading: "Updating meta puzzle...",
        success: "Success! Meta puzzle updated.",
        error: "Oops! Something went wrong.",
      });
    },
    listeners: {
      onChange: async ({formApi}) => {
        if (formApi.state.isValid) {
          await formApi.handleSubmit();
        }
      },
      onChangeDebounceMs: 500,
    },
  });
  const presences = useAppSelector(state => state.presences.value)[metaPuzzle.id] ?? [];
  const tagsRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <TableRow
        className={cn(
          "group",
          getBgColorClassNamesForPuzzleStatus(metaPuzzle.status),
          metaPuzzle.id === "" && "pointer-events-none cursor-wait",
          isParentCollapsed ? "collapse" : ""
        )}>
        <TableCell className="p-0">
          {metaPuzzle.link && (
            <Button
              variant="ghost"
              size="icon"
              nativeButton={false}
              render={
                <a href={metaPuzzle.link} target="_blank" rel="noopener noreferrer">
                  <PuzzleIcon className="text-blue-600" />
                </a>
              }
            />
          )}
        </TableCell>
        <TableCell className="p-0 relative">
          <div
            className={cn(
              "absolute flex-col items-center justify-center inset-0 group-hover:flex h-full",
              !isCollapsed ? "hidden" : "flex"
            )}>
            <Button
              variant="ghost"
              size="icon"
              id={metaPuzzle.id}
              className="relative scroll-mt-20 select-none"
              style={{color}}
              onClick={() => {
                setIsCollapsed(v => !v);
              }}>
              <ChevronRightIcon className={cn("transition", !isCollapsed && "rotate-90")} />
            </Button>
          </div>
          {!isCollapsed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center h-full group-hover:hidden">
              <div className={cn("flex-1", isCollapsed && "hidden")} />
              <div
                style={{backgroundColor: isCollapsed ? "transparent" : color, borderColor: color}}
                className="rounded-full size-2 border"></div>
              <div
                style={{backgroundColor: color}}
                className={cn("w-px flex-1", isCollapsed && "hidden")}></div>
            </div>
          )}
        </TableCell>
        <TableCell className="font-semibold">
          {metaPuzzle.googleSpreadsheetId || metaPuzzle.googleDrawingId ? (
            <Link
              to="/$workspaceId/puzzles/$puzzleId"
              params={{workspaceId, puzzleId: metaPuzzle.id}}
              className="-m-2 block p-2 hover:underline">
              {metaPuzzle.name}
            </Link>
          ) : (
            metaPuzzle.name
          )}
        </TableCell>
        <TableCell className="relative">
          <form.AppField name="answer">
            {field => (
              <input
                className="uppercase px-2 absolute inset-0 items-center whitespace-normal break-all font-mono hover:bg-amber-100 focus-visible:bg-amber-100 dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950 focus-visible:outline-none"
                onBlur={e => {
                  field.handleChange(e.target.value.toUpperCase());
                  field.handleBlur();
                }}
                onChange={e => field.handleChange(e.target.value)}
                value={field.state.value}
              />
            )}
          </form.AppField>
        </TableCell>
        <TableCell>
          <form.AppField name="status">
            {field => (
              <Select
                onValueChange={field.handleChange}
                value={field.state.value}
                items={getPuzzleStatusOptions()}>
                <SelectTrigger className="-my-2 h-auto rounded-none border-0 p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950 focus:outline-none">
                  <SelectValue onBlur={field.handleBlur} />
                </SelectTrigger>
                <SelectContent>
                  {getPuzzleStatusGroups().map(group => (
                    <SelectGroup key={group.groupLabel} className={group.bgColorNoHover}>
                      {group.values.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </form.AppField>
        </TableCell>
        <TableCell>
          <form.AppField name="importance">
            {field => (
              <Select
                onValueChange={field.handleChange}
                value={field.state.value}
                items={[
                  {value: null, label: <SignalMediumIcon />},
                  {value: "high", label: <SignalHighIcon />},
                  {value: "veryhigh", label: <SignalIcon />},
                  {value: "medium", label: <SignalMediumIcon />},
                  {value: "low", label: <SignalLowIcon />},
                  {value: "obsolete", label: <SignalZeroIcon />},
                ]}>
                <SelectTrigger
                  showTrigger={false}
                  className="-my-2 h-auto rounded-none border-0 p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950 focus:outline-none">
                  <SelectValue onBlur={field.handleBlur} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veryhigh">
                    <SignalIcon />
                    Very High
                  </SelectItem>
                  <SelectItem value="high">
                    <SignalHighIcon />
                    High
                  </SelectItem>
                  <SelectItem value="medium">
                    <SignalMediumIcon />
                    Medium
                  </SelectItem>
                  <SelectItem value="low">
                    <SignalLowIcon />
                    Low
                  </SelectItem>
                  <SelectItem value="obsolete">
                    <SignalZeroIcon />
                    Obsolete
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </form.AppField>
        </TableCell>
        <TableCell className="p-0">
          {!isTagsEditing ? (
            <button
              onClick={() => {
                setIsTagsEditing(true);
                setTimeout(() => tagsRef.current?.focus(), 0);
              }}
              className="h-full w-full flex gap-1 flex-wrap items-center hover:bg-amber-100 dark:hover:bg-amber-950 p-1 cursor-text">
              {metaPuzzle.tags.map(tag => (
                <Badge key={tag} className={getTagColor(tag)}>
                  {tag}
                </Badge>
              ))}
            </button>
          ) : (
            <form.AppField
              name="tags"
              listeners={{
                onBlur: () => {
                  setIsTagsEditing(false);
                },
              }}
              children={field => (
                <field.ComboboxMultipleField
                  defaultOpen
                  ref={tagsRef}
                  className="bg-amber-100 dark:bg-amber-950 border-0"
                  items={(workspace.get.data.tags as string[] | null) ?? []}
                />
              )}
            />
          )}
        </TableCell>
        <TableCell className="py-1">
          <div className="flex flex-row flex-wrap gap-1">
            {presences.map(user => (
              <UserHoverCard key={user.id} user={user}>
                <span className="inline-flex cursor-default items-center gap-x-0.5 rounded-full bg-green-200 dark:bg-green-800 dark:text-green-100 px-1 py-0.5 text-[10px] font-medium text-green-900">
                  <img
                    src={user.image ?? gravatarUrl(user.email ?? "", {size: 96, d: "identicon"})}
                    className="size-3 rounded-full"
                  />
                  {user.displayUsername}
                </span>
              </UserHoverCard>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <div className="-my-3 flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon">
                    <EllipsisIcon />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-fit">
                <DropdownMenuItem onClick={() => setIsAddNewPuzzleFeedingThisMetaDialogOpen(true)}>
                  Add new puzzle feeding this meta puzzle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEditPuzzleDialogOpen(true)}>
                  Edit this meta puzzle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsDeletePuzzleDialogOpen(true)}>
                  Delete this meta puzzle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <AddNewPuzzleDialog
            workspaceId={workspaceId!}
            roundId={metaPuzzle.roundId}
            parentPuzzleId={metaPuzzle.id}
            open={isAddNewPuzzleFeedingThisMetaDialogOpen}
            setOpen={setIsAddNewPuzzleFeedingThisMetaDialogOpen}
          />
          <EditPuzzleDialog
            workspaceId={workspaceId!}
            puzzle={metaPuzzle}
            open={isEditPuzzleDialogOpen}
            setOpen={setIsEditPuzzleDialogOpen}
          />
          <DeletePuzzleDialog
            workspaceId={workspaceId!}
            puzzleId={metaPuzzle.id}
            open={isDeletePuzzleDialogOpen}
            setOpen={setIsDeletePuzzleDialogOpen}
          />
        </TableCell>
      </TableRow>
      {metaPuzzle.childPuzzles.map((puzzle, idx) => (
        <BlackboardPuzzle
          key={idx}
          workspaceId={workspaceId}
          color={color}
          puzzle={puzzle}
          isCollapsed={isParentCollapsed || isCollapsed}
          isLast={idx === metaPuzzle.childPuzzles.length - 1}
        />
      ))}
      {metaPuzzle.childPuzzles.length === 0 && !isParentCollapsed && !isCollapsed && (
        <TableRow>
          <TableCell colSpan={1} />
          <TableCell className="p-0">
            <div className="flex flex-col h-full">
              <div className="flex-1 flex items-stretch">
                <div className="flex-1" />
                <div className="w-px" style={{backgroundColor: color, borderColor: color}} />
                <div className="flex-1" />
              </div>
              <div className="flex items-center">
                <div className="flex-1" />
                <div className="h-px w-px" style={{backgroundColor: color, borderColor: color}} />
                <div className="flex-1 h-px" style={{backgroundColor: color}} />
              </div>
              <div className="flex-1 flex items-stretch"></div>
            </div>
            <span className="relative scroll-mt-20" />
          </TableCell>
          <TableCell colSpan={6} className="text-muted-foreground italic text-xs">
            There are no visible puzzles feeding this meta puzzle.
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function BlackboardPuzzle({
  workspaceId,
  puzzle,
  color,
  isCollapsed,
  isLast,
}: {
  workspaceId: string;
  puzzle: RouterOutputs["rounds"]["list"][0]["puzzles"][0]["childPuzzles"][0];
  color?: string;
  isCollapsed?: boolean;
  isLast?: boolean;
}) {
  const workspace = useWorkspace({workspaceId});
  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);
  const [isDeletePuzzleDialogOpen, setIsDeletePuzzleDialogOpen] = useState(false);
  const [isTagsEditing, setIsTagsEditing] = useState(false);
  const form = useAppForm({
    defaultValues: {
      answer: puzzle.answer ?? "",
      status: puzzle.status,
      importance: puzzle.importance,
      tags: puzzle.tags,
    },
    onSubmit: ({value}) => {
      toast.promise(workspace.puzzles.update.mutateAsync({id: puzzle.id, ...value}), {
        loading: "Updating puzzle...",
        success: "Success! Puzzle updated.",
        error: "Oops! Something went wrong.",
      });
    },
    listeners: {
      onChange: async ({formApi}) => {
        if (formApi.state.isValid) {
          await formApi.handleSubmit();
        }
      },
      onChangeDebounceMs: 500,
    },
  });
  const presences = useAppSelector(state => state.presences.value[puzzle.id] ?? []);
  const tagsRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <TableRow
        className={cn(
          getBgColorClassNamesForPuzzleStatus(puzzle.status),
          puzzle.id === "" && "pointer-events-none cursor-wait",
          isCollapsed ? "collapse" : ""
        )}>
        <TableCell className="p-0">
          {puzzle.link && (
            <Button
              variant="ghost"
              size="icon"
              render={
                <a
                  title="Hunt Link to this puzzle"
                  href={puzzle.link}
                  target="_blank"
                  rel="noopener noreferrer">
                  <PuzzleIcon className="text-blue-600" />
                </a>
              }
            />
          )}
        </TableCell>
        <TableCell className="p-0">
          <div className="flex flex-col h-full">
            <div className="flex-1 flex items-stretch">
              <div className="flex-1" />
              <div className="w-px" style={{backgroundColor: color, borderColor: color}} />
              <div className="flex-1" />
            </div>
            <div className="flex items-center">
              <div className="flex-1" />
              <div className="h-px w-px" style={{backgroundColor: color, borderColor: color}} />
              <div className="flex-1 h-px" style={{backgroundColor: color}} />
            </div>
            <div className="flex-1 flex items-stretch">
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
          {puzzle.googleSpreadsheetId || puzzle.googleDrawingId ? (
            <Link
              to="/$workspaceId/puzzles/$puzzleId"
              params={{workspaceId, puzzleId: puzzle.id}}
              className="-m-2 block p-2 hover:underline">
              {puzzle.name}
            </Link>
          ) : (
            puzzle.name
          )}
        </TableCell>
        <TableCell className="relative">
          <form.AppField name="answer">
            {field => (
              <input
                className="px-2 uppercase absolute inset-0 items-center whitespace-normal break-all font-mono hover:bg-amber-100 focus-visible:bg-amber-100 dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950 focus-visible:outline-none"
                onBlur={e => {
                  field.handleChange(e.target.value.toUpperCase());
                  field.handleBlur();
                }}
                onChange={e => field.handleChange(e.target.value)}
                value={field.state.value}
              />
            )}
          </form.AppField>
        </TableCell>
        <TableCell>
          <form.AppField name="status">
            {field => (
              <Select
                onValueChange={field.handleChange}
                value={field.state.value}
                items={getPuzzleStatusOptions()}>
                <SelectTrigger className="-my-2 h-auto rounded-none border-0 p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 dark:hover:bg-amber-950 dark:focus:bg-amber-950 focus:outline-none">
                  <SelectValue onBlur={field.handleBlur} />
                </SelectTrigger>
                <SelectContent>
                  {getPuzzleStatusGroups().map(group => (
                    <SelectGroup key={group.groupLabel} className={group.bgColorNoHover}>
                      {group.values.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </form.AppField>
        </TableCell>
        <TableCell>
          <form.AppField name="importance">
            {field => (
              <Select
                onValueChange={field.handleChange}
                value={field.state.value}
                items={[
                  {value: null, label: <SignalMediumIcon />},
                  {value: "high", label: <SignalHighIcon />},
                  {value: "veryhigh", label: <SignalIcon />},
                  {value: "medium", label: <SignalMediumIcon />},
                  {value: "low", label: <SignalLowIcon />},
                  {value: "obsolete", label: <SignalZeroIcon />},
                ]}>
                <SelectTrigger
                  showTrigger={false}
                  className="-my-2 h-auto rounded-none border-0 p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 dark:hover:bg-amber-950 dark:focus:bg-amber-950 focus:outline-none">
                  <SelectValue onBlur={field.handleBlur} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veryhigh">
                    <SignalIcon />
                    Very High
                  </SelectItem>
                  <SelectItem value="high">
                    <SignalHighIcon />
                    High
                  </SelectItem>
                  <SelectItem value="medium">
                    <SignalMediumIcon />
                    Medium
                  </SelectItem>
                  <SelectItem value="low">
                    <SignalLowIcon />
                    Low
                  </SelectItem>
                  <SelectItem value="obsolete">
                    <SignalZeroIcon />
                    Obsolete
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </form.AppField>
        </TableCell>
        <TableCell className="p-0">
          {!isTagsEditing ? (
            <button
              onClick={() => {
                setIsTagsEditing(true);
                setTimeout(() => tagsRef.current?.focus(), 0);
              }}
              className="h-full w-full flex gap-1 flex-wrap items-center hover:bg-amber-100 dark:hover:bg-amber-950 p-1 cursor-text">
              {puzzle.tags.map(tag => (
                <Badge key={tag} className={getTagColor(tag)}>
                  {tag}
                </Badge>
              ))}
            </button>
          ) : (
            <form.AppField
              name="tags"
              listeners={{
                onBlur: () => {
                  setIsTagsEditing(false);
                },
              }}
              children={field => (
                <field.ComboboxMultipleField
                  defaultOpen
                  ref={tagsRef}
                  className="bg-amber-100 dark:bg-amber-950 border-0"
                  items={(workspace.get.data.tags as string[] | null) ?? []}
                />
              )}
            />
          )}
        </TableCell>
        <TableCell className="py-1">
          <div className="flex flex-row flex-wrap gap-2">
            {presences.map(user => (
              <UserHoverCard key={user.id} user={user}>
                <span className="inline-flex cursor-default items-center gap-x-0.5 rounded-full bg-green-200 dark:bg-green-800 dark:text-green-100 px-1 py-0.5 text-[10px] font-medium text-green-900">
                  <img
                    src={user.image ?? gravatarUrl(user.email ?? "", {size: 96, d: "identicon"})}
                    className="size-3 rounded-full"
                  />
                  {user.displayUsername}
                </span>
              </UserHoverCard>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <div className="-my-3 flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon">
                    <EllipsisIcon />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-fit">
                <DropdownMenuItem onClick={() => setIsEditPuzzleDialogOpen(true)}>
                  Edit this puzzle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsDeletePuzzleDialogOpen(true)}>
                  Delete this puzzle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <EditPuzzleDialog
            workspaceId={workspaceId!}
            puzzle={puzzle}
            open={isEditPuzzleDialogOpen}
            setOpen={setIsEditPuzzleDialogOpen}
          />
          <DeletePuzzleDialog
            workspaceId={workspaceId!}
            puzzleId={puzzle.id}
            open={isDeletePuzzleDialogOpen}
            setOpen={setIsDeletePuzzleDialogOpen}
          />
        </TableCell>
      </TableRow>
    </>
  );
}
