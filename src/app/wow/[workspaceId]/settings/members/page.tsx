import { Suspense } from "react";
import { Link, useParams } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

export default function Page() {
  return (
    <div className="flex justify-center">
      <div className="flex max-w-4xl flex-1 flex-col gap-4 md:gap-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Workspace Settings</h1>
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
          <nav
            className="text-muted-foreground grid gap-4 text-sm"
            x-chunk="dashboard-04-chunk-0"
          >
            <Link to="..">General</Link>
            <span className="text-primary font-semibold">Members</span>
            <Link to="../administration">Administration</Link>
          </nav>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <PageInner />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function MembersCard({ workspaceId }: { workspaceId: string }) {
  const [members] = trpc.workspaces.listMembers.useSuspenseQuery(workspaceId);

  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Members ({members.length})</CardTitle>
        <CardDescription>Members of this workspace.</CardDescription>
      </CardHeader>
      <CardContent className="px-7 flex flex-col gap-3">
        {members.map((member) => (
          <div
            key={member.userId}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <Avatar className="size-6 mr-2">
                <AvatarImage src={member.user.picture ?? undefined} />
                <AvatarFallback>{member.user.firstName?.[0]}</AvatarFallback>
              </Avatar>{" "}
              <div className="flex items-baseline gap-2">
                <div className="font-medium">
                  {member.user.firstName} {member.user.lastName}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PageInner() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <div className="flex flex-col gap-8">
      <MembersCard workspaceId={workspaceId!} />
    </div>
  );
}
