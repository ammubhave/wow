import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";

import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {gravatarUrl} from "@/components/user-hover-card";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/$workspaceId/_home/settings/members")({
  component: RouteComponent,
});

function RouteComponent() {
  const {workspaceId} = Route.useParams();
  const members = useSuspenseQuery(
    orpc.workspaces.members.list.queryOptions({input: {workspaceId}})
  ).data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members ({members.length})</CardTitle>
        <CardDescription>Members of this workspace.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {members.map(member => (
          <div key={member.user.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarImage src={member.user.image ?? gravatarUrl(member.user.email)} />
                <AvatarFallback>{member.user.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex items-baseline flex-col">
                <div className="font-medium">{member.user.name}</div>
                <div className="text-xs font-medium text-muted-foreground">
                  {member.user.displayUsername}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
