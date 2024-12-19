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
  const comment = trpc.comments.findComment.useQuery({ workspaceId: workspaceId! });
  const commentId = { workspaceId : workspaceId };

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
                <TableRow>
                  <TableCell>
                    1
                  </TableCell>
                  <TableCell>
                    2
                  </TableCell>
                  <TableCell>
                    3
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    4
                  </TableCell>
                  <TableCell>
                    5
                  </TableCell>
                  <TableCell>
                    6
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
