import { CommentBox } from "@/components/comment-box";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

import { CoffeeIcon } from "./coffee-icon";
import { Button } from "./ui/button";

export function Sidebar({ workspaceId }: { workspaceId: string }) {
  const workspace = trpc.workspaces.get.useQuery(workspaceId).data;
  const rounds = trpc.rounds.list.useQuery({ workspaceId }).data;
  return (
    <div className="bg-background divide-y hidden lg:flex flex-col gap-4 w-1/5">
      <div className="p-4">
        <CommentBox workspaceId={workspaceId} comment={workspace?.comment} />
      </div>
      <div className="flex-1">
        <nav>
          <Table>
            <TableBody>
              {rounds?.map((round, roundIndex) => (
                <TableRow key={round.id}>
                  <TableCell className="whitespace-nowrap">
                    <a href={"#" + round.id}>Round {roundIndex + 1}</a>
                  </TableCell>
                  {round.puzzles.map((puzzle, puzzleIndex) => (
                    <TableCell key={puzzle.id} className="inline-block">
                      <a href={"#" + puzzle.id}>{puzzleIndex + 1}</a>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
