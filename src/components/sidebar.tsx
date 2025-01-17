import { CommentBox } from "@/components/comment-box";
import { trpc } from "@/lib/trpc";

import { CoffeeIcon } from "./coffee-icon";
import { Button } from "./ui/button";

export function Sidebar({ workspaceId }: { workspaceId: string }) {
  const workspace = trpc.workspaces.get.useQuery(workspaceId).data;
  const rounds = trpc.rounds.list.useQuery({ workspaceId }).data;
  return (
    <div className="h-[calc(100dvh-theme(spacing.16))] bg-background divide-y hidden lg:flex flex-col gap-4 w-1/5">
      <div className="p-4 flex-1 overflow-y-auto">
        <CommentBox workspaceId={workspaceId} comment={workspace?.comment} />
      </div>
      <div className="overflow-y-auto flex-1 p-2">
        <nav>
          <div className="flex flex-col gap-2 text-xs">
            {rounds?.map((round) => (
              <div
                key={round.id}
                className="grid grid-cols-2 items-center justify-center gap-2"
              >
                <a
                  href={"#" + round.id}
                  className="text-primary underline underline-offset-4"
                >
                  {round.name}
                </a>
                <div className="grid grid-cols-5 gap-2">
                  {round.puzzles.map((puzzle, puzzleIndex) => (
                    <a
                      key={puzzle.id}
                      className="font-medium text-primary underline underline-offset-4"
                      href={"#" + puzzle.id}
                    >
                      {puzzleIndex + 1}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 p-4">
        <Button
          variant="secondary"
          className="gap-2 font-['Cookie'] text-xl"
          asChild
        >
          <a href="https://www.buymeacoffee.com/amolbhave" target="_blank">
            <CoffeeIcon className="size-4" />
            Buy me a coffee
          </a>
        </Button>
        <p className="text-muted-foreground text-xs text-center">
          Help support the hosting and development costs for WOW!
        </p>
      </div>
    </div>
  );
}
