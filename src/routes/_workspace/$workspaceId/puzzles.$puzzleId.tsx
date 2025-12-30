import {createFileRoute} from "@tanstack/react-router";
import {BrushIcon, EditIcon, PuzzleIcon, TableIcon} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";

import {Chat} from "@/components/chat";
import {CommentBox} from "@/components/comment-box";
import {EditPuzzleDialog} from "@/components/edit-puzzle-dialog";
import {useAppForm} from "@/components/form";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {Button} from "@/components/ui/button";
import {FieldGroup, FieldLabel} from "@/components/ui/field";
import {Item, ItemActions, ItemContent, ItemTitle} from "@/components/ui/item";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from "@/components/ui/resizable";
import {SelectGroup, SelectItem} from "@/components/ui/select";
import {SidebarInset} from "@/components/ui/sidebar";
import {Table, TableBody, TableCell, TableRow} from "@/components/ui/table";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {useWorkspace} from "@/components/use-workspace";
import {
  getBgColorClassNamesForPuzzleStatusNoHover,
  getPuzzleStatusGroups,
  getPuzzleStatusOptions,
} from "@/lib/puzzleStatuses";
import {usePuzzle} from "@/lib/usePuzzle";
import {cn} from "@/lib/utils";
import {useAppSelector} from "@/store";

export const Route = createFileRoute("/_workspace/$workspaceId/puzzles/$puzzleId")({
  component: RouteComponent,
});

function RouteComponent() {
  const {workspaceId, puzzleId} = Route.useParams();
  const puzzle = usePuzzle({workspaceId, puzzleId});

  if (!puzzle.data || !puzzleId) {
    return <></>;
  }

  return (
    <SidebarInset>
      <PresencesWebSocket workspaceId={workspaceId!} puzzleId={puzzleId!}>
        <div className="flex flex-1">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={80}>
              <iframe
                src={
                  puzzle.data.googleSpreadsheetId
                    ? `https://docs.google.com/spreadsheets/d/${puzzle.data.googleSpreadsheetId}/edit?widget=true&chrome=false&rm=embedded`
                    : `https://docs.google.com/drawings/d/${puzzle.data.googleDrawingId}/edit?widget=true&chrome=false&rm=embedded`
                }
                allow="fullscreen; geolocation; microphone; camera; payment"
                className="min-h-[calc(100dvh-(--spacing(16)))] w-full bg-white flex-1"
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={20}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={50} className="flex">
                  <PuzzleInfoPanel workspaceId={workspaceId!} puzzle={puzzle.data} />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} className="flex flex-col p-4">
                  <Chat puzzleId={puzzleId} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </PresencesWebSocket>
    </SidebarInset>
  );
}

function PuzzleInfoPanel({
  workspaceId,
  puzzle,
}: {
  workspaceId: string;
  puzzle: {
    comment: string | null;
    commentUpdatedAt: Date | null;
    commentUpdatedBy: string | null;
    id: string;
    parentPuzzleId: string | null;
    name: string;
    link: string | null;
    googleSpreadsheetId: string | null;
    googleDrawingId: string | null;
    answer: string | null;
    status: string | null;
    childPuzzles: {answer: string | null; name: string}[];
    isMetaPuzzle: boolean;
    tags: string[];
  };
}) {
  const workspace = useWorkspace({workspaceId});
  const form = useAppForm({
    defaultValues: {answer: puzzle.answer ?? "", status: puzzle.status},
    onSubmit: ({value}) => {
      const answer = value.answer.length === 0 ? null : value.answer.toUpperCase();
      if (answer !== puzzle.answer || value.status !== puzzle.status) {
        toast.promise(
          workspace.puzzles.update.mutateAsync({id: puzzle.id, answer, status: value.status}),
          {
            loading: "Updating puzzle...",
            success: "Success! Puzzle updated.",
            error: "Oops! Something went wrong.",
          }
        );
      }
    },
  });

  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);

  const presences = useAppSelector(state => state.presences.value)[puzzle.id] ?? [];

  return (
    <div
      className={cn(
        "flex flex-1 flex-col",
        getBgColorClassNamesForPuzzleStatusNoHover(puzzle.status)
      )}>
      <Item variant="muted">
        <ItemContent>
          <ItemTitle>{puzzle.name}</ItemTitle>
        </ItemContent>
        <ItemActions>
          {puzzle.googleSpreadsheetId && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    render={
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${puzzle.googleSpreadsheetId}/edit?gid=0#gid=0`}
                        target="_blank"
                        rel="noopener noreferrer">
                        <TableIcon />
                      </a>
                    }
                  />
                }
              />
              <TooltipContent>Link to the puzzle's Google spreadsheet</TooltipContent>
            </Tooltip>
          )}
          {puzzle.googleDrawingId && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    render={
                      <a
                        href={`https://docs.google.com/drawings/d/${puzzle.googleDrawingId}/edit?gid=0#gid=0`}
                        target="_blank"
                        rel="noopener noreferrer">
                        <BrushIcon />
                      </a>
                    }
                  />
                }
              />
              <TooltipContent>Link to the puzzle's Google drawing</TooltipContent>
            </Tooltip>
          )}
          {puzzle.link && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    render={
                      <a href={puzzle.link} target="_blank" rel="noopener noreferrer">
                        <PuzzleIcon />
                      </a>
                    }
                  />
                }
              />
              <TooltipContent>Link to the puzzle page on the hunt website</TooltipContent>
            </Tooltip>
          )}
          <EditPuzzleDialog
            workspaceId={workspaceId}
            puzzle={puzzle}
            open={isEditPuzzleDialogOpen}
            setOpen={setIsEditPuzzleDialogOpen}>
            <Button size="icon-sm" variant="ghost">
              <EditIcon />
            </Button>
          </EditPuzzleDialog>
        </ItemActions>
      </Item>
      <div className="p-4 text-sm gap-4 flex flex-col overflow-auto">
        <form.AppForm>
          <form.Form>
            <FieldGroup>
              <form.AppField
                name="answer"
                children={field => (
                  <field.TextField
                    label="Answer"
                    className="whitespace-pre font-mono"
                    onBlur={() => {
                      field.handleBlur();
                      void form.handleSubmit();
                    }}
                  />
                )}
              />
              <form.AppField
                name="status"
                children={field => {
                  return (
                    <field.SelectField
                      label="Status"
                      onValueChange={v => {
                        field.handleChange(v as any);
                        void form.handleSubmit();
                      }}
                      items={getPuzzleStatusOptions()}>
                      {getPuzzleStatusGroups().map(group => (
                        <SelectGroup key={group.groupLabel} className={group.bgColorNoHover}>
                          {group.values.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </field.SelectField>
                  );
                }}
              />
              {puzzle.childPuzzles.length > 0 && (
                <div>
                  <Accordion>
                    <AccordionItem>
                      <AccordionTrigger>Feeder Puzzle Answers</AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableBody>
                            {puzzle.childPuzzles.map(childPuzzle => (
                              <TableRow key={childPuzzle.name}>
                                <TableCell>{childPuzzle.name}</TableCell>
                                <TableCell className="font-mono">{childPuzzle.answer}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <FieldLabel>Hunters Present</FieldLabel>
                <div className="flex flex-row flex-wrap gap-2">
                  {presences.map((name, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-x-1.5 rounded-full bg-green-200 px-1.5 py-0.5 text-xs font-medium text-green-900">
                      <svg
                        viewBox="0 0 6 6"
                        aria-hidden="true"
                        className="h-1.5 w-1.5 fill-green-500">
                        <circle r={3} cx={3} cy={3} />
                      </svg>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </FieldGroup>
          </form.Form>
        </form.AppForm>
        <div>
          <CommentBox
            comment={puzzle.comment ?? ""}
            commentUpdatedAt={puzzle.commentUpdatedAt}
            commentUpdatedBy={puzzle.commentUpdatedBy}
            workspaceId={workspaceId}
            puzzleId={puzzle.id}
          />
        </div>
      </div>
    </div>
  );
}
