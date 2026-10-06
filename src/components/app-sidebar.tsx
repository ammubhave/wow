import {Resizable} from "@heroui-pro/react/resizable";
import {Button, Drawer, Tooltip} from "@heroui/react";
import {MegaphoneIcon, MessagesSquareIcon, NotebookPenIcon} from "lucide-react";
import * as React from "react";
import {memo} from "react";
import {cn} from "tailwind-variants";
import {useMediaQuery} from "usehooks-ts";

import {useWorkspace} from "@/hooks/use-workspace";
import {getBgColorClassNamesForPuzzleStatus} from "@/lib/puzzleStatuses";
import {WorkspaceRoomState} from "@/server/do/workspace";

import {Chat} from "./chat";
import {CommentBox} from "./comment-box";
import {MakeAccouncementDialog} from "./make-announcement-dialog";

/**
 * The board's sidebar: team notes, round progress and announcements, above the team chat (with
 * the lobby call). Hidden on phones, where both open in drawers from the board's toolbar.
 */
export function AppSidebar({
  workspaceSlug,
  rounds,
  ...props
}: {workspaceSlug: string; rounds: WorkspaceRoomState["rounds"]} & React.ComponentProps<"div">) {
  // Not rendered at all on phones (not just hidden), so its team chat doesn't connect twice.
  const isWide = useMediaQuery("(min-width: 768px)");
  if (!isWide) return null;
  return (
    <div className="bg-background relative w-80 shrink-0 border-l" {...props}>
      <div className="absolute inset-0 flex">
        <Resizable orientation="vertical">
          <Resizable.Panel defaultSize={40} className="flex flex-col overflow-y-auto">
            <SidebarContents workspaceSlug={workspaceSlug} rounds={rounds} />
          </Resizable.Panel>
          <Resizable.Handle type="drag" />
          <Resizable.Panel defaultSize={60} className="flex flex-col">
            <TeamChat />
          </Resizable.Panel>
        </Resizable>
      </div>
    </div>
  );
}

/** The team chat, under its heading. */
function TeamChat() {
  return (
    <section aria-label="Team chat" className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-muted flex items-center gap-1.5 px-3 pt-2 text-xs font-medium">
        <MessagesSquareIcon className="size-3.5" />
        Team chat
      </h2>
      <Chat />
    </section>
  );
}

/** On phones, the team chat opens in a drawer from the board's toolbar. */
export function TeamChatDrawerButton() {
  return (
    <Drawer>
      <Button variant="outline" isIconOnly aria-label="Team chat" className="md:hidden">
        <MessagesSquareIcon />
      </Button>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-[min(24rem,90vw)]">
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>Team chat</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex min-h-0 flex-col p-0">
              <Chat />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
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
