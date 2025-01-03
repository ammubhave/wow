import { CommentBox } from "@/components/comment-box";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

export function Sidebar({workspaceId}: {
  workspaceId: string;
}) {
  const commentId = { workspaceId : workspaceId! };
  const comment = trpc.comments.findComment.useQuery(commentId);

  const roundFlattenedPuzzles = trpc.rounds.listPuzzles.useQuery({ workspaceId: workspaceId! });

  return (
    <div className="w-0 invisible lg:visible lg:w-1/6 top-20 sticky self-start">
      <Card className="sticky">
        <CardHeader>
          <CommentBox comment={comment?.data?.text} commentId={commentId} />
        </CardHeader>
        <CardContent>
          <nav>
            <Table>
              <TableBody>
                {roundFlattenedPuzzles.data?.map(([roundId, flattenedPuzzles], roundIndex) => (
                  <TableRow key={roundId}>
                    <TableCell className="whitespace-nowrap">
                      <a href={"#" + roundId}>Round {roundIndex}</a>
                    </TableCell>
                    {flattenedPuzzles.map((id: string, puzzleIndex: number) => (
                      <TableCell key={id} className="inline-block">
                        <a href={"#" + id}>{puzzleIndex+1}</a>
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
