import {useLocalStorage} from "@uidotdev/usehooks";
import {CoffeeIcon} from "lucide-react";
import * as React from "react";

import {Sidebar, SidebarContent, SidebarFooter, SidebarHeader} from "@/components/ui/sidebar";
import {cn, getBgColorClassNamesForPuzzleStatus} from "@/lib/utils";
import {RouterOutputs} from "@/server/router";

import {CommentBox} from "./comment-box";
import {Button} from "./ui/button";
import {useWorkspace} from "./use-workspace";

export function AppSidebar({
  workspaceId,
  rounds,
  ...props
}: {
  workspaceId: string;
  rounds: RouterOutputs["workspaces"]["get"]["rounds"];
} & React.ComponentProps<typeof Sidebar>) {
  const workspace = useWorkspace({workspaceId});
  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" {...props}>
      <SidebarHeader>
        <div className="p-4 flex-1 overflow-y-auto">
          <CommentBox workspaceId={workspaceId} comment={workspace.get.data?.comment ?? ""} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="overflow-y-auto flex-1 p-2">
          <nav>
            <div className="flex flex-col gap-2 text-xs">
              {rounds
                .map(round => (
                  <div
                    key={round.id}
                    className="grid grid-cols-2 items-center justify-center gap-2">
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
          </nav>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col items-center justify-center gap-4 p-4">
          <Button
            variant="secondary"
            className="font-['Cookie'] text-xl"
            render={
              <a href="https://www.buymeacoffee.com/amolbhave" target="_blank">
                <CoffeeIcon />
                Buy me a coffee
              </a>
            }
          />
          <p className="text-muted-foreground text-xs text-center">
            Help support the hosting and development costs for WOW!
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
