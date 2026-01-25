import {MegaphoneIcon} from "lucide-react";
import * as React from "react";
import {cn} from "tailwind-variants";

import {getBgColorClassNamesForPuzzleStatus} from "@/lib/puzzleStatuses";
import {RouterOutputs} from "@/server/router";

import {CommentBox} from "./comment-box";
import {MakeAccouncementDialog} from "./make-announcement-dialog";
import {Button} from "./ui/button";
import {Tooltip, TooltipContent, TooltipTrigger} from "./ui/tooltip";
import {useWorkspace} from "./use-workspace";

export function AppSidebar({
  workspaceSlug,
  rounds,
  ...props
}: {
  workspaceSlug: string;
  rounds: RouterOutputs["workspaces"]["get"]["rounds"];
} & React.ComponentProps<"div">) {
  const workspace = useWorkspace({workspaceSlug});
  return (
    <div
      className="relative w-full max-w-[16rem] bg-sidebar border-l border-sidebar-border"
      {...props}>
      <div className="absolute inset-0 overflow-y-auto flex flex-col">
        <div className="p-2 overflow-y-auto min-h-50">
          <CommentBox
            workspaceSlug={workspaceSlug}
            comment={workspace.get.data.comment}
            commentUpdatedAt={workspace.get.data.commentUpdatedAt}
            commentUpdatedBy={workspace.get.data.commentUpdatedBy}
          />
        </div>
        <div className="flex flex-1 p-2 flex-col gap-2 text-xs">
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
