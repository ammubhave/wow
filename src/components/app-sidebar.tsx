import {MegaphoneIcon} from "lucide-react";
import * as React from "react";
import {cn} from "tailwind-variants";

import {useWorkspace} from "@/hooks/use-workspace";
import {getBgColorClassNamesForPuzzleStatus} from "@/lib/puzzleStatuses";
import {WorkspaceRoomState} from "@/server/do/workspace";

import {CommentBox} from "./comment-box";
import {MakeAccouncementDialog} from "./make-announcement-dialog";
import {Button} from "./ui/button";
import {Tooltip, TooltipContent, TooltipTrigger} from "./ui/tooltip";

export function AppSidebar({
  workspaceSlug,
  rounds,
  ...props
}: {workspaceSlug: string; rounds: WorkspaceRoomState["rounds"]} & React.ComponentProps<"div">) {
  const workspace = useWorkspace();
  return (
    <div
      className="bg-sidebar border-sidebar-border relative w-full max-w-[16rem] border-l"
      {...props}>
      <div className="absolute inset-0 flex flex-col overflow-y-auto">
        <div className="min-h-50 overflow-y-auto p-2">
          <CommentBox
            workspaceSlug={workspaceSlug}
            comment={workspace.comment}
            commentUpdatedAt={workspace.commentUpdatedAt}
            commentUpdatedBy={workspace.commentUpdatedBy}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-2 text-xs">
          {rounds
            .map(round => (
              <div key={round.id} className="grid grid-cols-2 items-center justify-center gap-2">
                <a
                  href={"#" + round.id}
                  className={cn(
                    "text-primary underline underline-offset-4",
                    getBgColorClassNamesForPuzzleStatus(round.status)
                  )}>
                  {round.name}
                </a>
                <div className="flex flex-wrap">
                  {round.puzzles.map(puzzle => (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <a
                            key={puzzle.id}
                            className={cn(
                              "size-4 text-[8px] flex items-center justify-center text-primary border",
                              getBgColorClassNamesForPuzzleStatus(puzzle.status)
                            )}
                            href={"#" + puzzle.id}>
                            {(puzzle as any).puzzleIndex}
                          </a>
                        }
                      />
                      <TooltipContent>{puzzle.name}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))
            .reverse()}
        </div>
        <div className="p-2">
          <Tooltip>
            <MakeAccouncementDialog
              workspaceSlug={workspaceSlug}
              children={
                <TooltipTrigger
                  render={
                    <Button variant="outline">
                      <MegaphoneIcon />
                    </Button>
                  }
                />
              }
            />
            <TooltipContent>Make an announcement</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
