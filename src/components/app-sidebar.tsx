import {Button, Drawer, Tooltip} from "@heroui/react";
import {MegaphoneIcon, NotebookPenIcon} from "lucide-react";
import * as React from "react";
import {memo} from "react";
import {cn} from "tailwind-variants";

import {useWorkspace} from "@/hooks/use-workspace";
import {getBgColorClassNamesForPuzzleStatus} from "@/lib/puzzleStatuses";
import {WorkspaceRoomState} from "@/server/do/workspace";

import {CommentBox} from "./comment-box";
import {MakeAccouncementDialog} from "./make-announcement-dialog";

/** The board's sidebar (team notes, round progress, announcements); hidden on phones. */
export function AppSidebar({
  workspaceSlug,
  rounds,
  ...props
}: {workspaceSlug: string; rounds: WorkspaceRoomState["rounds"]} & React.ComponentProps<"div">) {
  return (
    <div
      className="bg-background relative hidden w-full max-w-[16rem] border-l md:block"
      {...props}>
      <div className="absolute inset-0 flex flex-col overflow-y-auto">
        <SidebarContents workspaceSlug={workspaceSlug} rounds={rounds} />
      </div>
    </div>
  );
}

/** On phones, the sidebar's contents open in a drawer from the board's toolbar. */
export function SidebarDrawerButton({
  workspaceSlug,
  rounds,
}: {
  workspaceSlug: string;
  rounds: WorkspaceRoomState["rounds"];
}) {
  return (
    <Drawer>
      <Button variant="outline" isIconOnly aria-label="Notes and progress" className="md:hidden">
        <NotebookPenIcon />
      </Button>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-[min(20rem,85vw)]">
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>Notes and progress</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col p-0">
              <SidebarContents workspaceSlug={workspaceSlug} rounds={rounds} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

function SidebarContents({
  workspaceSlug,
  rounds,
}: {
  workspaceSlug: string;
  rounds: WorkspaceRoomState["rounds"];
}) {
  const workspace = useWorkspace();
  return (
    <>
      <div className="min-h-50 overflow-y-auto p-2">
        <CommentBox
          workspaceSlug={workspaceSlug}
          comment={workspace.comment}
          commentUpdatedAt={workspace.commentUpdatedAt}
          commentUpdatedBy={workspace.commentUpdatedBy}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2 text-xs">
        {rounds.toReversed().map(round => (
          <SidebarRound
            key={round.id}
            round={round}
            allPuzzles={workspace.rounds.find(r => r.id === round.id)?.puzzles ?? round.puzzles}
          />
        ))}
      </div>
      <div className="p-2">
        <Tooltip delay={0}>
          <MakeAccouncementDialog
            workspaceSlug={workspaceSlug}
            children={
              <Button variant="outline" isIconOnly aria-label="Make an announcement">
                <MegaphoneIcon />
              </Button>
            }
          />
          <Tooltip.Content>Make an announcement</Tooltip.Content>
        </Tooltip>
      </div>
    </>
  );
}

/** One round's puzzle squares. Memoized so a workspace update only re-renders changed rounds. */
const SidebarRound = memo(function SidebarRound({
  round,
  allPuzzles,
}: {
  round: WorkspaceRoomState["rounds"][number];
  /** The round's unfiltered puzzles: numbering matches the round order, not the active filter. */
  allPuzzles: WorkspaceRoomState["rounds"][number]["puzzles"];
}) {
  return (
    <div className="grid grid-cols-2 items-center justify-center gap-2">
      <a
        href={"#" + round.id}
        className={cn(
          "text-accent underline underline-offset-4",
          getBgColorClassNamesForPuzzleStatus(round.status)
        )}>
        {round.name}
      </a>
      <div className="flex flex-wrap">
        {round.puzzles.map(puzzle => {
          const number = allPuzzles.findIndex(p => p.id === puzzle.id) + 1;
          return (
            <Tooltip key={puzzle.id} delay={0}>
              <Tooltip.Trigger>
                <a
                  // The tooltip only describes; give the bare number square a real name.
                  aria-label={`${number}. ${puzzle.name}`}
                  className={cn(
                    "size-4 text-[8px] flex items-center justify-center text-accent border",
                    getBgColorClassNamesForPuzzleStatus(puzzle.status)
                  )}
                  href={"#" + puzzle.id}>
                  {number}
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content>{puzzle.name}</Tooltip.Content>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
});
