import { PuzzlePieceIcon } from "@heroicons/react/24/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRightIcon, DotsHorizontalIcon } from "@radix-ui/react-icons";
import { sha256 } from "js-sha256";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { AddNewMetaPuzzleDialog } from "@/components/add-new-meta-puzzle-dialog";
import { AddNewPuzzleDialog } from "@/components/add-new-puzzle-dialog";
import { AddNewRoundDialog } from "@/components/add-new-round-dialog";
import { DeletePuzzleDialog } from "@/components/delete-puzzle-dialog";
import { DeleteRoundDialog } from "@/components/delete-round-dialog";
import { EditPuzzleDialog } from "@/components/edit-puzzle-dialog";
import { EditRoundDialog } from "@/components/edit-round-dialog";
import { PresencesWebSocket } from "@/components/presences-websocket";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setIsCollapsedState } from "@/features/settings/is-collapsed";
import { RouterOutputs, trpc } from "@/lib/trpc";
import { usePuzzlesUpdateMutation } from "@/lib/usePuzzlesUpdateMutation";
import { cn, getBgColorClassNamesForPuzzleStatus } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store";

export default function Page() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <PresencesWebSocket workspaceId={workspaceId!}>
      <div className="flex flex-1 divide-x items-stretch -m-4 mb-0 md:-m-[2.5rem]">
        <Blackboard workspaceId={workspaceId!} />
        <Sidebar workspaceId={workspaceId!} />
      </div>
    </PresencesWebSocket>
  );
}

function Blackboard({ workspaceId }: { workspaceId: string }) {
  const rounds = trpc.rounds.list.useQuery({ workspaceId: workspaceId! });
  const [isAddNewRoundDialogOpen, setIsAddNewRoundDialogOpen] = useState(false);
  const [hideSolved, setHideSolved] = useState(false);

  return (
    <div className="flex flex-col divide-y h-[calc(100dvh-theme(spacing.16))] flex-1">
      <div>
        <div className="p-4 flex items-center justify-between font-semibold leading-none tracking-tight">
          Blackboard
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="-my-3">
                  <DotsHorizontalIcon className="size-4" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setIsAddNewRoundDialogOpen(true)}
                >
                  Add new round
                </DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={hideSolved}
                  onCheckedChange={setHideSolved}
                >
                  Hide solved puzzles
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AddNewRoundDialog
              workspaceId={workspaceId!}
              open={isAddNewRoundDialogOpen}
              setOpen={setIsAddNewRoundDialogOpen}
            />
          </div>
        </div>
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
                <TableHead>Working on this</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.isLoading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={2} />
                    <TableCell>
                      <Skeleton className="h-6 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-6" />
                    </TableCell>
                  </TableRow>
                ))}
              {rounds.data?.map((round) => (
                <BlackboardRound
                  key={round.id}
                  workspaceId={workspaceId!}
                  round={round}
                  hideSolved={hideSolved}
                />
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
  );
}

function BlackboardRound({
  workspaceId,
  round,
  hideSolved,
}: {
  workspaceId: string;
  round: RouterOutputs["rounds"]["list"][0];
  hideSolved: boolean;
}) {
  const [isAddNewMetaPuzzleDialogOpen, setIsAddNewMetaPuzzleDialogOpen] =
    useState(false);
  const [
    isAddNewUnassignedPuzzleDialogOpen,
    setIsAddNewUnassignedPuzzleDialogOpen,
  ] = useState(false);
  const [isEditRoundDialogOpen, setIsEditRoundDialogOpen] = useState(false);
  const [isDeleteRoundDialogOpen, setIsDeleteRoundDialogOpen] = useState(false);

  const dispatch = useAppDispatch();
  const isCollapsedState = !!useAppSelector(
    (state) => state.isCollapsed.map[round.id],
  );
  const [isCollapsed, setIsCollapsed] = useState(isCollapsedState);
  useEffect(() => setIsCollapsed(isCollapsedState), [isCollapsedState]);
  const isUnassignedCollapsedState = !!useAppSelector(
    (state) => state.isCollapsed.map["unassigned-" + round.id],
  );
  const [isUnassignedCollapsed, setIsUnassignedCollapsed] = useState(
    isUnassignedCollapsedState,
  );
  useEffect(
    () => setIsUnassignedCollapsed(isUnassignedCollapsedState),
    [isUnassignedCollapsedState],
  );

  const metaPuzzles = round.metaPuzzles.filter(
    (metaPuzzle) =>
      !hideSolved ||
      (metaPuzzle.status !== "solved" && metaPuzzle.status !== "backsolved") ||
      metaPuzzle.childPuzzles.some(
        (puzzle) =>
          puzzle.status !== "solved" && puzzle.status !== "backsolved",
      ),
  );
  const unassignedPuzzles = round.unassignedPuzzles.filter(
    (puzzle) =>
      !hideSolved ||
      (puzzle.status !== "solved" && puzzle.status !== "backsolved"),
  );

  return (
    <>
      <TableRow className="bg-secondary text-secondary-foreground">
        <TableCell className="-p-2">
          <Button
            id={round.id}
            variant="ghost"
            size="icon"
            className="relative scroll-mt-20 select-none"
            onClick={() => {
              dispatch(
                setIsCollapsedState({
                  id: round.id,
                  isCollapsed: !isCollapsed,
                }),
              );
              setIsCollapsed(!isCollapsed);
            }}
          >
            <ChevronRightIcon
              className={cn("transition", !isCollapsed && "rotate-90")}
            />
          </Button>
        </TableCell>
        <TableCell colSpan={5} className="font-semibold text-muted-foreground">
          {round.name}
        </TableCell>
        <TableCell />
        <TableCell>
          <div className="-my-3 flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={round.id === ""} variant="ghost" size="icon">
                  <DotsHorizontalIcon className="size-4" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setIsAddNewMetaPuzzleDialogOpen(true)}
                >
                  Add new meta puzzle
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsAddNewUnassignedPuzzleDialogOpen(true)}
                >
                  Add new unassigned puzzle
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsEditRoundDialogOpen(true)}
                >
                  Edit round
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsDeleteRoundDialogOpen(true)}
                >
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
            workspaceId={workspaceId!}
            round={round}
            open={isEditRoundDialogOpen}
            setOpen={setIsEditRoundDialogOpen}
          />
          <DeleteRoundDialog
            workspaceId={workspaceId!}
            roundId={round.id}
            open={isDeleteRoundDialogOpen}
            setOpen={setIsDeleteRoundDialogOpen}
          />
        </TableCell>
      </TableRow>
      {metaPuzzles.map((metaPuzzle) => (
        <BlackboardMetaPuzzle
          key={metaPuzzle.id}
          workspaceId={workspaceId}
          metaPuzzle={metaPuzzle}
          isAllCollapsed={isCollapsed}
          hideSolved={hideSolved}
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
                  !isUnassignedCollapsed ? "hidden" : "flex",
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative scroll-mt-20 select-none"
                  style={{
                    color: "grey",
                  }}
                  onClick={(_e) => {
                    dispatch(
                      setIsCollapsedState({
                        id: "unassigned-" + round.id,
                        isCollapsed: !isUnassignedCollapsed,
                      }),
                    );
                    setIsUnassignedCollapsed(!isUnassignedCollapsed);
                  }}
                >
                  <ChevronRightIcon
                    className={cn(
                      "transition",
                      !isUnassignedCollapsed && "rotate-90",
                    )}
                  />
                </Button>
              </div>
              {!isUnassignedCollapsed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center h-full group-hover:hidden">
                  <div
                    className={cn("flex-1", isUnassignedCollapsed && "hidden")}
                  />
                  <div
                    style={{
                      backgroundColor: isUnassignedCollapsed
                        ? "transparent"
                        : "grey",
                      borderColor: "grey",
                    }}
                    className="rounded-full size-2 border"
                  ></div>
                  <div
                    style={{
                      backgroundColor: "grey",
                    }}
                    className={cn(
                      "w-[1px] flex-1",
                      isUnassignedCollapsed && "hidden",
                    )}
                  ></div>
                </div>
              )}
            </TableCell>
            <TableCell className="font-semibold italic" colSpan={6}>
              Unassigned Puzzles
            </TableCell>
          </TableRow>
          {unassignedPuzzles.map((puzzle) => (
            <BlackboardPuzzle
              color="grey"
              key={puzzle.id}
              workspaceId={workspaceId}
              puzzle={puzzle}
              isCollapsed={isCollapsed || isUnassignedCollapsed}
              isLast={
                puzzle === unassignedPuzzles[unassignedPuzzles.length - 1]
              }
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
  isAllCollapsed,
  hideSolved,
}: {
  workspaceId: string;
  metaPuzzle: RouterOutputs["rounds"]["list"][0]["metaPuzzles"][0];
  isAllCollapsed: boolean;
  hideSolved: boolean;
}) {
  const [
    isAddNewPuzzleFeedingThisMetaDialogOpen,
    setIsAddNewPuzzleFeedingThisMetaDialogOpen,
  ] = useState(false);
  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);
  const [isDeletePuzzleDialogOpen, setIsDeletePuzzleDialogOpen] =
    useState(false);

  const dispatch = useAppDispatch();
  const isCollapsedState = !!useAppSelector(
    (state) => state.isCollapsed.map[metaPuzzle.id],
  );
  const [isCollapsed, setIsCollapsed] = useState(isCollapsedState);
  useEffect(() => setIsCollapsed(isCollapsedState), [isCollapsedState]);
  const [isParentCollapsed, setIsParentCollapsed] = useState(isAllCollapsed);
  useEffect(() => setIsParentCollapsed(isAllCollapsed), [isAllCollapsed]);

  const { isDarkModeEnabled } = useAppSelector(
    (state) => state.isDarkModeEnabled,
  );
  const color = ((id: string) => {
    const hash = sha256(id);
    let hue = parseInt(hash.substring(0, 4), 16) % (360 - 150);
    if (hue > 30) {
      hue += 150;
    }
    let saturation, lightness;
    if (isDarkModeEnabled) {
      saturation =
        (parseInt(hash.substring(4, 6), 16) / 255.0) ** 0.5 * 60 + 40;
      lightness = (parseInt(hash.substring(6, 8), 16) / 255.0) ** 0.3 * 50 + 50;
    } else {
      saturation =
        (parseInt(hash.substring(4, 6), 16) / 255.0) ** 0.5 * 80 + 50;
      lightness = (parseInt(hash.substring(6, 8), 16) / 255.0) ** 0.5 * 70;
    }

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  })(metaPuzzle.id);

  const formSchema = z.object({
    answer: z.string(),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      answer: metaPuzzle.answer ?? "",
    },
  });
  const mutation = usePuzzlesUpdateMutation({ workspaceId });

  function onAnswerChange(data: z.infer<typeof formSchema>) {
    const answer = data.answer.length === 0 ? null : data.answer.toUpperCase();
    if (answer !== metaPuzzle.answer) {
      toast.promise(
        mutation.mutateAsync({
          id: metaPuzzle.id,
          answer,
        }),
        {
          loading: "Updating meta puzzle answer...",
          success: "Success! Meta puzzle answer updated.",
          error: "Oops! Something went wrong.",
        },
      );
    }
  }
  function onStatusChange(value: string) {
    const newValue = value === "none" ? null : value;
    if (metaPuzzle.status !== newValue) {
      toast.promise(
        mutation.mutateAsync({
          id: metaPuzzle.id,
          status: newValue,
        }),
        {
          loading: "Updating meta puzzle status...",
          success: "Success! Meta puzzle status updated.",
          error: "Oops! Something went wrong.",
        },
      );
    }
  }
  function onImportanceChange(value: string) {
    const newValue = value === "none" ? null : value;
    if (metaPuzzle.importance !== newValue) {
      toast.promise(
        mutation.mutateAsync({
          id: metaPuzzle.id,
          importance: newValue,
        }),
        {
          loading: "Updating meta puzzle importance...",
          success: "Success! Meta puzzle importance updated.",
          error: "Oops! Something went wrong.",
        },
      );
    }
  }

  const presences =
    useAppSelector((state) => state.presences.value)[metaPuzzle.id] ?? [];

  const childPuzzles = metaPuzzle.childPuzzles.filter(
    (puzzle) =>
      !hideSolved ||
      (puzzle.status !== "solved" && puzzle.status !== "backsolved"),
  );

  return (
    <>
      <TableRow
        className={cn(
          "group",
          getBgColorClassNamesForPuzzleStatus(metaPuzzle.status),
          metaPuzzle.id === "" && "pointer-events-none cursor-wait",
          isParentCollapsed ? "collapse" : "",
        )}
      >
        <TableCell className="p-0">
          {metaPuzzle.link && (
            <Button variant="ghost" size="icon" asChild>
              <a
                href={metaPuzzle.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <PuzzlePieceIcon className="size-4 text-blue-600" />
              </a>
            </Button>
          )}
        </TableCell>
        <TableCell className="p-0 relative">
          <div
            className={cn(
              "absolute flex-col items-center justify-center inset-0 group-hover:flex h-full",
              !isCollapsed ? "hidden" : "flex",
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              id={metaPuzzle.id}
              className="relative scroll-mt-20 select-none"
              style={{
                color,
              }}
              onClick={(_e) => {
                dispatch(
                  setIsCollapsedState({
                    id: metaPuzzle.id,
                    isCollapsed: !isCollapsed,
                  }),
                );
                setIsCollapsed(!isCollapsed);
              }}
            >
              <ChevronRightIcon
                className={cn("transition", !isCollapsed && "rotate-90")}
              />
            </Button>
          </div>
          {!isCollapsed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center h-full group-hover:hidden">
              <div className={cn("flex-1", isCollapsed && "hidden")} />
              <div
                style={{
                  backgroundColor: isCollapsed ? "transparent" : color,
                  borderColor: color,
                }}
                className="rounded-full size-2 border"
              ></div>
              <div
                style={{
                  backgroundColor: color,
                }}
                className={cn("w-[1px] flex-1", isCollapsed && "hidden")}
              ></div>
            </div>
          )}
        </TableCell>
        <TableCell className="font-semibold">
          {metaPuzzle.googleSpreadsheetId || metaPuzzle.googleDrawingId ? (
            <Link
              to={`puzzles/${metaPuzzle.id}`}
              className="-m-2 block p-2 hover:underline"
            >
              {metaPuzzle.name}
            </Link>
          ) : (
            metaPuzzle.name
          )}
        </TableCell>
        <TableCell
          className="items-center whitespace-normal break-all font-mono hover:bg-amber-100 focus-visible:bg-amber-100 dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950 focus-visible:outline-none"
          contentEditable={metaPuzzle.id !== ""}
          suppressContentEditableWarning={true}
          onInput={(e) => {
            form.setValue("answer", e.currentTarget.innerText);
          }}
          onBlur={form.handleSubmit(onAnswerChange)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        >
          {form.getValues("answer")}
        </TableCell>
        <TableCell>
          <Select
            onValueChange={onStatusChange}
            value={metaPuzzle.status ?? "none"}
          >
            <SelectTrigger className="-my-2 h-auto rounded-none border-0 p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950 focus:outline-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="solved">Solved</SelectItem>
              <SelectItem value="backsolved">Backsolved</SelectItem>
              <SelectItem value="needs_eyes">Needs Eyes</SelectItem>
              <SelectItem value="extraction">Extraction</SelectItem>
              <SelectItem value="stuck">Stuck</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="very_stuck">Very Stuck</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select
            onValueChange={onImportanceChange}
            value={metaPuzzle.importance ?? "none"}
          >
            <SelectTrigger className="-my-2 h-auto rounded-none border-0 p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950 focus:outline-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="important">Important</SelectItem>
              <SelectItem value="obsolete">Obsolete</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <div className="flex flex-row flex-wrap gap-2">
            {presences.map((name) => (
              <span className="inline-flex items-center gap-x-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                <svg
                  viewBox="0 0 6 6"
                  aria-hidden="true"
                  className="h-1.5 w-1.5 fill-green-500"
                >
                  <circle r={3} cx={3} cy={3} />
                </svg>
                {name}
              </span>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <div className="-my-3 flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <DotsHorizontalIcon className="size-4" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    setIsAddNewPuzzleFeedingThisMetaDialogOpen(true)
                  }
                >
                  Add new puzzle feeding this meta puzzle
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsEditPuzzleDialogOpen(true)}
                >
                  Edit this meta puzzle
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsDeletePuzzleDialogOpen(true)}
                >
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
      {childPuzzles.map((puzzle, idx) => (
        <BlackboardPuzzle
          key={idx}
          workspaceId={workspaceId}
          color={color}
          puzzle={puzzle}
          isCollapsed={isParentCollapsed || isCollapsed}
          isLast={idx === childPuzzles.length - 1}
        />
      ))}
      {childPuzzles.length === 0 && !isParentCollapsed && !isCollapsed && (
        <TableRow>
          <TableCell colSpan={1} />
          <TableCell className="p-0">
            <div className="flex flex-col h-full">
              <div className="flex-1 flex items-stretch">
                <div className="flex-1" />
                <div
                  className="w-[1px]"
                  style={{
                    backgroundColor: color,
                    borderColor: color,
                  }}
                />
                <div className="flex-1" />
              </div>
              <div className="flex items-center">
                <div className="flex-1" />
                <div
                  className="h-[1px] w-[1px]"
                  style={{
                    backgroundColor: color,
                    borderColor: color,
                  }}
                />
                <div
                  className="flex-1 h-[1px]"
                  style={{
                    backgroundColor: color,
                  }}
                />
              </div>
              <div className="flex-1 flex items-stretch"></div>
            </div>
            <span className="relative scroll-mt-20" />
          </TableCell>
          <TableCell
            colSpan={6}
            className="text-muted-foreground italic text-xs"
          >
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
  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);
  const [isDeletePuzzleDialogOpen, setIsDeletePuzzleDialogOpen] =
    useState(false);
  const [isPuzzleCollapsed, setIsPuzzleCollapsed] = useState(isCollapsed);
  useEffect(() => setIsPuzzleCollapsed(isCollapsed), [isCollapsed]);

  const formSchema = z.object({
    answer: z.string(),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      answer: puzzle.answer ?? "",
    },
  });
  const mutation = usePuzzlesUpdateMutation({ workspaceId });

  function onAnswerChange(data: z.infer<typeof formSchema>) {
    const answer = data.answer.length === 0 ? null : data.answer.toUpperCase();
    if (answer !== puzzle.answer) {
      toast.promise(
        mutation.mutateAsync({
          id: puzzle.id,
          answer,
        }),
        {
          loading: "Updating puzzle answer...",
          success: "Success! Puzzle answer updated.",
          error: "Oops! Something went wrong.",
        },
      );
    }
  }
  function onStatusChange(value: string) {
    const newValue = value === "none" ? null : value;
    if (puzzle.status !== newValue) {
      toast.promise(
        mutation.mutateAsync({
          id: puzzle.id,
          status: newValue,
        }),
        {
          loading: "Updating puzzle status...",
          success: "Success! Puzzle status updated.",
          error: "Oops! Something went wrong.",
        },
      );
    }
  }
  function onImportanceChange(value: string) {
    const newValue = value === "none" ? null : value;
    if (puzzle.importance !== newValue) {
      toast.promise(
        mutation.mutateAsync({
          id: puzzle.id,
          importance: newValue,
        }),
      );
    }
  }

  const presences = useAppSelector(
    (state) => state.presences.value[puzzle.id] ?? [],
  );

  return (
    <>
      <TableRow
        className={cn(
          getBgColorClassNamesForPuzzleStatus(puzzle.status),
          puzzle.id === "" && "pointer-events-none cursor-wait",
          isPuzzleCollapsed ? "collapse" : "",
        )}
      >
        <TableCell className="p-0">
          {puzzle.link && (
            <Button variant="ghost" size="icon" asChild>
              <a
                title="Hunt Link to this puzzle"
                href={puzzle.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <PuzzlePieceIcon className="size-4 text-blue-600" />
              </a>
            </Button>
          )}
        </TableCell>
        <TableCell className="p-0">
          <div className="flex flex-col h-full">
            <div className="flex-1 flex items-stretch">
              <div className="flex-1" />
              <div
                className="w-[1px]"
                style={{
                  backgroundColor: color,
                  borderColor: color,
                }}
              />
              <div className="flex-1" />
            </div>
            <div className="flex items-center">
              <div className="flex-1" />
              <div
                className="h-[1px] w-[1px]"
                style={{
                  backgroundColor: color,
                  borderColor: color,
                }}
              />
              <div
                className="flex-1 h-[1px]"
                style={{
                  backgroundColor: color,
                }}
              />
            </div>
            <div className="flex-1 flex items-stretch">
              <div className="flex-1" />
              <div
                className={cn("w-[1px]", isLast && "hidden")}
                style={{
                  backgroundColor: color,
                  borderColor: color,
                }}
              />
              <div className="flex-1" />
            </div>
          </div>
          <span id={puzzle.id} className="relative scroll-mt-20" />
        </TableCell>
        <TableCell>
          {puzzle.googleSpreadsheetId || puzzle.googleDrawingId ? (
            <Link
              to={`puzzles/${puzzle.id}`}
              className="-m-2 block p-2 hover:underline"
            >
              {puzzle.name}
            </Link>
          ) : (
            puzzle.name
          )}
        </TableCell>
        <TableCell
          className="items-center whitespace-normal break-all font-mono hover:bg-amber-100 focus-visible:bg-amber-100 dark:hover:bg-amber-950 dark:focus-visible:bg-amber-950 focus-visible:outline-none"
          contentEditable={puzzle.id !== ""}
          suppressContentEditableWarning={true}
          onInput={(e) => {
            form.setValue("answer", e.currentTarget.innerText);
          }}
          onBlur={form.handleSubmit(onAnswerChange)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        >
          {form.getValues("answer")}
        </TableCell>
        <TableCell>
          <Select
            onValueChange={onStatusChange}
            value={puzzle.status ?? "none"}
          >
            <SelectTrigger className="-my-2 h-auto rounded-none border-0 p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 dark:hover:bg-amber-950 dark:focus:bg-amber-950 focus:outline-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>

              <SelectItem value="solved">Solved</SelectItem>
              <SelectItem value="backsolved">Backsolved</SelectItem>
              <SelectItem value="obsolete">Obsolete</SelectItem>

              <SelectItem value="needs_eyes">Needs Eyes</SelectItem>
              <SelectItem value="extraction">Extraction</SelectItem>

              <SelectItem value="stuck">Stuck</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="very_stuck">Very Stuck</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select
            onValueChange={onImportanceChange}
            value={puzzle.importance ?? "none"}
          >
            <SelectTrigger className="-my-2 h-auto rounded-none border-0 p-2 shadow-none hover:bg-amber-100 focus:bg-amber-100 dark:hover:bg-amber-950 dark:focus:bg-amber-950 focus:outline-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="important">Important</SelectItem>
              <SelectItem value="obsolete">Obsolete</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <div className="flex flex-row flex-wrap gap-2">
            {presences.map((name) => (
              <span className="inline-flex items-center gap-x-1.5 rounded-full bg-green-200 px-1.5 py-0.5 text-xs font-medium text-green-900">
                <svg
                  viewBox="0 0 6 6"
                  aria-hidden="true"
                  className="h-1.5 w-1.5 fill-green-500"
                >
                  <circle r={3} cx={3} cy={3} />
                </svg>
                {name}
              </span>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <div className="-my-3 flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <DotsHorizontalIcon className="size-4" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setIsEditPuzzleDialogOpen(true)}
                >
                  Edit this puzzle
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsDeletePuzzleDialogOpen(true)}
                >
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
