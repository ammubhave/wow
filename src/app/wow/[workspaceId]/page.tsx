import { PuzzlePieceIcon } from "@heroicons/react/24/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { sha256 } from "js-sha256";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { RouterOutputs, trpc } from "@/lib/trpc";
import { usePuzzlesUpdateMutation } from "@/lib/usePuzzlesUpdateMutation";
import { cn, getBgColorClassNamesForPuzzleStatus } from "@/lib/utils";
import { useAppSelector } from "@/store";

export default function Page() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [isAddNewRoundDialogOpen, setIsAddNewRoundDialogOpen] = useState(false);
  const rounds = trpc.rounds.list.useQuery({ workspaceId: workspaceId! });

  return (
    <PresencesWebSocket workspaceId={workspaceId!}>
      <Card>
        <CardHeader className="px-7">
          <CardTitle className="flex items-center justify-between">
            Blackboard
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
              </DropdownMenuContent>
            </DropdownMenu>
            <AddNewRoundDialog
              workspaceId={workspaceId!}
              open={isAddNewRoundDialogOpen}
              setOpen={setIsAddNewRoundDialogOpen}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 md:px-6">
          <div className="md:rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-0 w-[2px]" />
                  <TableHead>Name</TableHead>
                  <TableHead>Solution</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Working on this
                  </TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.isLoading &&
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell />
                      <TableCell>
                        <Skeleton className="h-6 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-40" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
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
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PresencesWebSocket>
  );
}

function BlackboardRound({
  workspaceId,
  round,
}: {
  workspaceId: string;
  round: RouterOutputs["rounds"]["list"][0];
}) {
  const [isAddNewMetaPuzzleDialogOpen, setIsAddNewMetaPuzzleDialogOpen] =
    useState(false);
  const [
    isAddNewUnassignedPuzzleDialogOpen,
    setIsAddNewUnassignedPuzzleDialogOpen,
  ] = useState(false);
  const [isEditRoundDialogOpen, setIsEditRoundDialogOpen] = useState(false);
  const [isDeleteRoundDialogOpen, setIsDeleteRoundDialogOpen] = useState(false);
  return (
    <>
      <TableRow>
        <TableCell colSpan={6} className="py-6 bg-muted/50" />
      </TableRow>
      <TableRow className="bg-secondary text-secondary-foreground">
        <TableCell className="p-0" />
        <TableCell className="text-xl font-semibold">{round.name}</TableCell>
        <TableCell colSpan={2} />
        <TableCell className="hidden sm:table-cell" />
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
      {round.metaPuzzles.map((metaPuzzle) => (
        <BlackboardMetaPuzzle
          key={metaPuzzle.id}
          workspaceId={workspaceId}
          metaPuzzle={metaPuzzle}
        />
      ))}
      {round.unassignedPuzzles.length > 0 && (
        <>
          <TableRow className="bg-muted/50">
            <TableCell colSpan={6} className="py-2" />
          </TableRow>
          <TableRow
            className="border-l-4 bg-muted/50"
            style={{
              borderLeftColor: "grey",
            }}
          >
            <TableCell
              style={{
                backgroundColor: "grey",
              }}
              className="p-0"
            />
            <TableCell className="text-lg font-semibold" colSpan={5}>
              Unassigned Puzzles
            </TableCell>
          </TableRow>
          {round.unassignedPuzzles.map((puzzle) => (
            <BlackboardPuzzle
              color="grey"
              key={puzzle.id}
              workspaceId={workspaceId}
              puzzle={puzzle}
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
}: {
  workspaceId: string;
  metaPuzzle: RouterOutputs["rounds"]["list"][0]["metaPuzzles"][0];
}) {
  const [
    isAddNewPuzzleFeedingThisMetaDialogOpen,
    setIsAddNewPuzzleFeedingThisMetaDialogOpen,
  ] = useState(false);
  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);
  const [isDeletePuzzleDialogOpen, setIsDeletePuzzleDialogOpen] =
    useState(false);

  const color = ((id: string) => {
    const hash = sha256(id);
    let hue = parseInt(hash.substring(0, 4), 16) % (360 - 150);
    if (hue > 30) {
      hue += 150;
    }
    const saturation =
      (parseInt(hash.substring(4, 6), 16) / 255.0) ** 0.5 * 80 + 50;
    const lightness = (parseInt(hash.substring(6, 8), 16) / 255.0) ** 0.5 * 70;
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

  const presences =
    useAppSelector((state) => state.presences.value)[metaPuzzle.id] ?? [];

  return (
    <>
      <TableRow className="bg-muted/50">
        <TableCell colSpan={6} className="py-2" />
      </TableRow>
      <TableRow
        className={cn(
          getBgColorClassNamesForPuzzleStatus(metaPuzzle.status),
          metaPuzzle.id === "" && "pointer-events-none cursor-wait",
          "border-l-4",
        )}
        style={{
          borderLeftColor: color,
        }}
      >
        <TableCell
          style={{
            backgroundColor: color,
          }}
          className="p-0"
        />
        <TableCell className="text-lg font-semibold uppercase">
          {metaPuzzle.googleSpreadsheetId ? (
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
              <SelectItem value="obsolete">Obsolete</SelectItem>
              <SelectItem value="needs_eyes">Needs Eyes</SelectItem>
              <SelectItem value="extraction">Extraction</SelectItem>
              <SelectItem value="stuck">Stuck</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="very_stuck">Very Stuck</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="hidden sm:table-cell">
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
            metaPuzzleId={metaPuzzle.id}
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
            roundId={metaPuzzle.roundId}
            puzzleId={metaPuzzle.id}
            open={isDeletePuzzleDialogOpen}
            setOpen={setIsDeletePuzzleDialogOpen}
          />
        </TableCell>
      </TableRow>
      {metaPuzzle.metaPuzzles.map((puzzle, idx) => (
        <BlackboardPuzzle
          key={idx}
          workspaceId={workspaceId}
          color={color}
          puzzle={puzzle}
        />
      ))}
      {metaPuzzle.puzzles.map((puzzle, idx) => (
        <BlackboardPuzzle
          key={idx}
          workspaceId={workspaceId}
          color={color}
          puzzle={puzzle}
        />
      ))}
    </>
  );
}

function BlackboardPuzzle({
  workspaceId,
  puzzle,
  color,
}: {
  workspaceId: string;
  puzzle: RouterOutputs["rounds"]["list"][0]["metaPuzzles"][0]["puzzles"][0];
  color?: string;
}) {
  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);
  const [isDeletePuzzleDialogOpen, setIsDeletePuzzleDialogOpen] =
    useState(false);

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

  const presences = useAppSelector(
    (state) => state.presences.value[puzzle.id] ?? [],
  );

  return (
    <>
      <TableRow
        className={cn(
          getBgColorClassNamesForPuzzleStatus(puzzle.status),
          puzzle.id === "" && "pointer-events-none cursor-wait",
        )}
      >
        <TableCell
          style={{
            backgroundColor: color,
          }}
          className="p-0"
        />
        <TableCell>
          {puzzle.googleSpreadsheetId ? (
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
        <TableCell className="hidden sm:table-cell">
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            metaPuzzleId={puzzle.metaPuzzleId as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            roundId={puzzle.roundId as any}
            puzzleId={puzzle.id}
            open={isDeletePuzzleDialogOpen}
            setOpen={setIsDeletePuzzleDialogOpen}
          />
        </TableCell>
      </TableRow>
    </>
  );
}
