import {useMutation} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {BrushIcon, EditIcon, PuzzleIcon, TableIcon} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

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
import {ButtonGroup, ButtonGroupText} from "@/components/ui/button-group";
import {FieldGroup} from "@/components/ui/field";
import {InputGroup} from "@/components/ui/input-group";
import {Item, ItemActions, ItemContent, ItemTitle} from "@/components/ui/item";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from "@/components/ui/resizable";
import {SelectGroup, SelectItem} from "@/components/ui/select";
import {SidebarInset} from "@/components/ui/sidebar";
import {Table, TableBody, TableCell, TableRow} from "@/components/ui/table";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {useWorkspace} from "@/hooks/use-workspace";
import {client, orpc} from "@/lib/orpc";
import {
  getBgColorClassNamesForPuzzleStatusNoHover,
  getPuzzleStatusGroups,
  getPuzzleStatusOptions,
} from "@/lib/puzzleStatuses";
import {usePuzzle} from "@/lib/usePuzzle";

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
    return <></>;
  }

  return (
    <SidebarInset>
      <PresencesWebSocket workspaceSlug={workspaceSlug!} puzzleId={puzzleId!}>
        <div className="flex flex-1">
          <ResizablePanelGroup orientation="horizontal">
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
              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize={30} className="flex">
                  <PuzzleInfoPanel workspaceSlug={workspaceSlug!} puzzle={puzzle.data} />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={60} className="flex flex-col">
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
    childPuzzles: {answer: string | null; name: string}[];
    isMetaPuzzle: boolean;
    tags: string[];
  };
}) {
  const workspace = useWorkspace();
  const puzzleUpdateMutation = useMutation(orpc.puzzles.update.mutationOptions());
  const form = useAppForm({
    defaultValues: {answer: puzzle.answer ?? "", status: puzzle.status, tags: puzzle.tags},
    onSubmit: ({value}) => {
      toast.promise(
        puzzleUpdateMutation.mutateAsync({
          workspaceSlug,
          id: puzzle.id,
          answer: value.answer,
          status: value.status,
          tags: value.tags,
        }),
        {
          loading: "Updating puzzle...",
          success: "Success! Puzzle updated.",
          error: "Oops! Something went wrong.",
        }
      );
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

  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);

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
            workspaceSlug={workspaceSlug}
            puzzle={puzzle}
            open={isEditPuzzleDialogOpen}
            setOpen={setIsEditPuzzleDialogOpen}>
            <Button size="icon-sm" variant="ghost">
              <EditIcon />
            </Button>
          </EditPuzzleDialog>
        </ItemActions>
      </Item>
      <div className="text-sm gap-2 flex flex-col overflow-auto">
        <form.AppForm>
          <form.Form>
            <FieldGroup className="gap-0">
              <form.AppField
                name="answer"
                children={field => (
                  <ButtonGroup className="w-full">
                    <ButtonGroupText className="min-w-16">Answer</ButtonGroupText>
                    <InputGroup>
                      <field.InputGroupInputField className="whitespace-pre uppercase font-mono" />
                    </InputGroup>
                  </ButtonGroup>
                )}
              />
              <form.AppField
                name="status"
                children={field => (
                  <ButtonGroup className="w-full">
                    <ButtonGroupText className="min-w-16">Status</ButtonGroupText>
                    <InputGroup>
                      <field.SelectField
                        className="border-0 bg-transparent"
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
                    </InputGroup>
                  </ButtonGroup>
                )}
              />
              <form.AppField
                name="tags"
                children={field => (
                  <ButtonGroup className="w-full">
                    <ButtonGroupText className="min-w-16">Tags</ButtonGroupText>
                    <InputGroup className="h-auto">
                      <field.ComboboxMultipleField
                        className="border-0 bg-transparent"
                        items={workspace.tags}
                      />
                    </InputGroup>
                  </ButtonGroup>
                )}
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
            </FieldGroup>
          </form.Form>
        </form.AppForm>
        <div className="px-2 gap-2 flex flex-col">
          <CommentBox
            comment={puzzle.comment}
            commentUpdatedAt={puzzle.commentUpdatedAt}
            commentUpdatedBy={puzzle.commentUpdatedBy}
            workspaceSlug={workspaceSlug}
            puzzleId={puzzle.id}
          />
        </div>
      </div>
    </div>
  );
}
