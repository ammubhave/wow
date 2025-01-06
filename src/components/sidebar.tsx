import { CommentBox } from "@/components/comment-box";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

export function Sidebar({ workspaceId }: { workspaceId: string }) {
  const workspace = trpc.workspaces.get.useQuery(workspaceId).data;
  const rounds = trpc.rounds.list.useQuery({ workspaceId }).data;
  return (
    <div className="w-0 invisible lg:visible lg:w-1/6 top-20 sticky self-start">
      <Card className="sticky">
        <CardHeader>
          <CommentBox workspaceId={workspaceId} comment={workspace?.comment} />
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
