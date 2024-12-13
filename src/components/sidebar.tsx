import { useParams } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouterOutputs, trpc } from "@/lib/trpc";

export function Sidebar() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const rounds = trpc.rounds.list.useQuery({ workspaceId: workspaceId! });

  return (
    <div className="w-0 invisible lg:visible lg:w-1/6 top-20 sticky self-start">
      <Card className="sticky">
        <CardHeader>
          Test stuff
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
