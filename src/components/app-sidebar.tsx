import {Resizable} from "@heroui-pro/react/resizable";
import {Button, Drawer, Tooltip} from "@heroui/react";
import {MegaphoneIcon, MessagesSquareIcon, NotebookPenIcon} from "lucide-react";
import * as React from "react";
import {cn} from "tailwind-variants";
import {useMediaQuery} from "usehooks-ts";

import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {useWorkspace} from "@/hooks/use-workspace";
import {getBgColorClassNamesForPuzzleStatus} from "@/lib/puzzleStatuses";
import {WorkspaceRoomState} from "@/server/do/workspace";

import {Chat} from "./chat";
import {CommentBox, visibleComment} from "./comment-box";
import {IconButton, IconTooltip} from "./icon-button";
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
            {/* The onboarding tour points at this. */}
            <div data-tour="sidebar" className="flex flex-1 flex-col">
              <SidebarContents workspaceSlug={workspaceSlug} rounds={rounds} />
            </div>
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
    <section data-tour="team-chat" aria-label="Team chat" className="flex min-h-0 flex-1 flex-col">
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
      <IconButton
        data-tour="team-chat-button"
        variant="outline"
        label="Team chat"
        className="md:hidden">
        <MessagesSquareIcon />
      </IconButton>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-[min(24rem,90vw)]">
            <IconTooltip label="Close">
              <Drawer.CloseTrigger />
            </IconTooltip>
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
      <IconButton
        data-tour="sidebar-button"
        variant="outline"
        label="Notes and progress"
        className="md:hidden">
        <NotebookPenIcon />
      </IconButton>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-[min(20rem,85vw)]">
            <IconTooltip label="Close">
              <Drawer.CloseTrigger />
            </IconTooltip>
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
  const isReadOnly = useIsReadOnly();
  return (
    <>
      {/* A read-only workspace's notes can't be added to, so without any there's no notes area. */}
      {(!isReadOnly || visibleComment(workspace.comment)) && (
        <div className="min-h-50 overflow-y-auto p-2">
          <CommentBox
            workspaceSlug={workspaceSlug}
            comment={workspace.comment}
            commentUpdatedAt={workspace.commentUpdatedAt}
            commentUpdatedBy={workspace.commentUpdatedBy}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-2 text-xs">
        {rounds.toReversed().map(round => (
          <SidebarRound
            key={round.id}
            round={round}
            allPuzzles={workspace.rounds.find(r => r.id === round.id)?.puzzles ?? round.puzzles}
          />
        ))}
      </div>
      {!isReadOnly && (
        <div className="p-2">
          <MakeAccouncementDialog
            workspaceSlug={workspaceSlug}
            children={
              <Button variant="outline" size="sm">
                <MegaphoneIcon />
                Make an announcement
              </Button>
            }
          />
        </div>
      )}
    </>
  );
}

/** One round's puzzle squares. */
function SidebarRound({
  round,
  allPuzzles,
}: {
  round: WorkspaceRoomState["rounds"][number];
  /** The round's unfiltered puzzles: numbering matches the round order, not the active filter. */
  allPuzzles: WorkspaceRoomState["rounds"][number]["puzzles"];
}) {
  const solved = allPuzzles.filter(p => p.status === "solved" || p.status === "backsolved").length;
  return (
    // Name and count on one line, the squares on a full-width line below, so long round names and
    // big rounds don't crowd each other.
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <a
          href={"#" + round.id}
          className={cn(
            "text-foreground hover:text-accent truncate font-medium underline-offset-4 hover:underline",
            getBgColorClassNamesForPuzzleStatus(round.status)
          )}>
          {round.name}
        </a>
        <span className="text-muted shrink-0 tabular-nums">
          {solved}/{allPuzzles.length}
        </span>
      </div>
      {round.puzzles.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {round.puzzles.map(puzzle => {
            const number = allPuzzles.findIndex(p => p.id === puzzle.id) + 1;
            return (
              <Tooltip key={puzzle.id} delay={0}>
                <Tooltip.Trigger>
                  <a
                    // The tooltip only describes; give the bare number square a real name.
                    aria-label={`${number}. ${puzzle.name}`}
                    className={cn(
                      "text-muted hover:text-foreground flex size-5 items-center justify-center border text-[10px] tabular-nums",
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
      )}
    </div>
  );
}
