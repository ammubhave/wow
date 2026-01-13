import {MegaphoneIcon} from "lucide-react";
import * as React from "react";

import {getBgColorClassNamesForPuzzleStatus} from "@/lib/puzzleStatuses";
import {cn} from "@/lib/utils";
import {RouterOutputs} from "@/server/router";

import {CommentBox} from "./comment-box";
import {MakeAccouncementDialog} from "./make-announcement-dialog";
import {Button} from "./ui/button";
import {useWorkspace} from "./use-workspace";

export function AppSidebar({
  workspaceId,
  rounds,
  ...props
}: {
  workspaceId: string;
  rounds: RouterOutputs["workspaces"]["get"]["rounds"];
} & React.ComponentProps<"div">) {
  const workspace = useWorkspace({workspaceId});
  return (
    <div
      className="relative w-full max-w-[16rem] bg-sidebar border-l border-sidebar-border"
      {...props}>
      <div className="absolute inset-0 overflow-y-auto flex flex-col">
        <div className="p-2 overflow-y-auto">
          <CommentBox
            workspaceId={workspaceId}
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
                    <a
                      key={puzzle.id}
                      className={cn(
                        "size-4 text-[8px] flex items-center justify-center text-primary border",
                        getBgColorClassNamesForPuzzleStatus(puzzle.status)
                      )}
                      href={"#" + puzzle.id}>
                      {(puzzle as any).puzzleIndex}
                    </a>
                  ))}
                </div>
              </div>
            ))
            .reverse()}
        </div>
        <div className="p-2">
          <MakeAccouncementDialog
            workspaceId={workspaceId}
            children={
              <Button variant="outline">
                <MegaphoneIcon />
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
