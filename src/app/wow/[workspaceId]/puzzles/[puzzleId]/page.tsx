import { PuzzlePieceIcon, TableCellsIcon } from "@heroicons/react/24/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { Pencil2Icon } from "@radix-ui/react-icons";
import { BrushIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { Chat } from "@/components/chat";
import { CommentBox } from "@/components/comment-box";
import { EditPuzzleDialog } from "@/components/edit-puzzle-dialog";
import { PresencesWebSocket } from "@/components/presences-websocket";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { usePuzzle } from "@/lib/usePuzzle";
import { usePuzzlesUpdateMutation } from "@/lib/usePuzzlesUpdateMutation";
import { cn, getBgColorClassNamesForPuzzleStatus } from "@/lib/utils";
import { useAppSelector } from "@/store";

export default function Page() {
  const { workspaceId, puzzleId } = useParams<{
    workspaceId: string;
    puzzleId: string;
  }>();
  const puzzle = usePuzzle({ workspaceId: workspaceId!, puzzleId: puzzleId! });

  const { getIdToken } = useKindeAuth();
  const [token, setToken] = useState<string | undefined>();
  useEffect(() => {
    getIdToken?.().then((token) => setToken(token));
  }, [getIdToken]);

  if (!puzzle.data || !puzzleId || !token) {
    return <></>;
  }

  return (
    <PresencesWebSocket workspaceId={workspaceId!} puzzleId={puzzleId!}>
      <div className="-m-4 flex flex-1 md:-m-[2.5rem]">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={80}>
            <iframe
              src={
                puzzle.data.googleSpreadsheetId
                  ? `https://docs.google.com/spreadsheets/d/${puzzle.data.googleSpreadsheetId}/edit?widget=true&chrome=false&rm=embedded`
                  : `https://docs.google.com/drawings/d/${puzzle.data.googleDrawingId}/edit?widget=true&chrome=false&rm=embedded`
              }
              allow="fullscreen; geolocation; microphone; camera; payment"
              className="min-h-[calc(100dvh-theme(spacing.16))] w-full bg-white flex-1"
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={20}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={50} className="flex items-stretch">
                <PuzzleInfoPanel
                  workspaceId={workspaceId!}
                  puzzle={puzzle.data}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} className="flex flex-col p-4">
                <Chat puzzleId={puzzleId} token={token} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </PresencesWebSocket>
  );
}

function PuzzleInfoPanel({
  workspaceId,
  puzzle,
}: {
  workspaceId: string;
  puzzle: {
    comment: string;
    id: string;
    parentPuzzleId: string | null;
    name: string;
    link: string | null;
    googleSpreadsheetId: string | null;
    googleDrawingId: string | null;
    answer: string | null;
    status: string | null;
    childPuzzles: {
      answer: string | null;
      name: string;
    }[];
  };
}) {
  const formSchema = z.object({
    answer: z.string(),
    status: z.string(),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      answer: puzzle.answer ?? "",
      status: puzzle.status ?? "none",
    },
  });
  const mutation = usePuzzlesUpdateMutation({ workspaceId });
  function onSubmit(data: z.infer<typeof formSchema>) {
    const answer = data.answer.length === 0 ? null : data.answer.toUpperCase();
    if (answer !== puzzle.answer || data.status !== puzzle.status) {
      toast.promise(
        mutation.mutateAsync({
          id: puzzle.id,
          answer,
          status: data.status,
        }),
        {
          loading: "Updating puzzle...",
          success: "Success! Puzzle updated.",
          error: "Oops! Something went wrong.",
        },
      );
    }
  }

  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);

  const presences =
    useAppSelector((state) => state.presences.value)[puzzle.id] ?? [];

  return (
    <Card
      className={cn(
        "flex-1 overflow-auto border-0 shadow-none rounded-none md:rounded-none",
        getBgColorClassNamesForPuzzleStatus(puzzle.status),
      )}
    >
      <CardHeader className="bg-muted/50 flex flex-row flex-wrap items-center gap-2 p-4">
        <CardTitle className="text-md group flex items-center gap-2">
          {puzzle.name}
        </CardTitle>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {puzzle.googleSpreadsheetId && (
            <Button size="sm" variant="outline" asChild>
              <a
                href={`https://docs.google.com/spreadsheets/d/${puzzle.googleSpreadsheetId}/edit?gid=0#gid=0`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <TableCellsIcon className="size-4" />
              </a>
            </Button>
          )}
          {puzzle.googleDrawingId && (
            <Button size="sm" variant="outline" asChild>
              <a
                href={`https://docs.google.com/drawings/d/${puzzle.googleDrawingId}/edit?gid=0#gid=0`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <BrushIcon className="size-4" />
              </a>
            </Button>
          )}
          {puzzle.link && (
            <Button size="sm" variant="outline" asChild>
              <a href={puzzle.link} target="_blank" rel="noopener noreferrer">
                <PuzzlePieceIcon className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          <EditPuzzleDialog
            workspaceId={workspaceId}
            puzzle={puzzle}
            open={isEditPuzzleDialogOpen}
            setOpen={setIsEditPuzzleDialogOpen}
          >
            <Button size="sm" variant="outline">
              <Pencil2Icon className="h-3.5 w-3.5" />
            </Button>
          </EditPuzzleDialog>
        </div>
      </CardHeader>
      <CardContent className="p-4 text-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="answer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Answer</FormLabel>
                  <FormControl>
                    <Input
                      className="bg-background whitespace-pre font-mono"
                      {...field}
                      onBlur={() => {
                        field.onBlur();
                        form.handleSubmit(onSubmit)();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={(...event) => {
                      field.onChange(...event);
                      form.handleSubmit(onSubmit)();
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />
            {puzzle.childPuzzles.length > 0 && (
              <div className="space-y-2">
                <Accordion type="single" collapsible>
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Feeder Puzzle Answers</AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableBody>
                          {puzzle.childPuzzles.map((childPuzzle) => (
                            <TableRow key={childPuzzle.name}>
                              <TableCell>{childPuzzle.name}</TableCell>
                              <TableCell className="font-mono">
                                {childPuzzle.answer}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
            <div className="space-y-2">
              <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Hunters Present
              </span>
              <div className="flex flex-row flex-wrap gap-2">
                {presences.map((name, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-x-1.5 rounded-full bg-green-200 px-1.5 py-0.5 text-xs font-medium text-green-900"
                  >
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
            </div>
            <div>
              <CommentBox comment={puzzle.comment} puzzleId={puzzle.id} />
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
