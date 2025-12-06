import {CoffeeIcon} from "lucide-react";
import * as React from "react";

import {Sidebar, SidebarContent, SidebarFooter, SidebarHeader} from "@/components/ui/sidebar";

import {CommentBox} from "./comment-box";
import {Button} from "./ui/button";
import {useWorkspace} from "./use-workspace";

export function AppSidebar({
  workspaceId,
  ...props
}: {workspaceId: string} & React.ComponentProps<typeof Sidebar>) {
  const workspace = useWorkspace({workspaceId});
  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" {...props}>
      <SidebarHeader>
        <div className="p-4 flex-1 overflow-y-auto">
          <CommentBox workspaceId={workspaceId} comment={workspace.get.data?.comment} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="overflow-y-auto flex-1 p-2">
          <nav>
            <div className="flex flex-col gap-2 text-xs">
              {workspace.get.data?.rounds.map(round => (
                <div key={round.id} className="grid grid-cols-2 items-center justify-center gap-2">
                  <a href={"#" + round.id} className="text-primary underline underline-offset-4">
                    {round.name}
                  </a>
                  <div className="grid grid-cols-5 gap-2">
                    {round.puzzles.map((puzzle, puzzleIndex) => (
                      <a
                        key={puzzle.id}
                        className="font-medium text-primary underline underline-offset-4"
                        href={"#" + puzzle.id}>
                        {puzzleIndex + 1}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </nav>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col items-center justify-center gap-4 p-4">
          <Button variant="secondary" className="gap-2 font-['Cookie'] text-xl" asChild>
            <a href="https://www.buymeacoffee.com/amolbhave" target="_blank">
              <CoffeeIcon className="size-4" />
              Buy me a coffee
            </a>
          </Button>
          <p className="text-muted-foreground text-xs text-center">
            Help support the hosting and development costs for WOW!
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
