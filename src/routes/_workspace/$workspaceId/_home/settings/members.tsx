import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";

import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_workspace/$workspaceId/_home/settings/members")({
  component: RouteComponent,
});

function RouteComponent() {
  const {workspaceId} = Route.useParams();
  const members = useSuspenseQuery({
    queryKey: ["workspaceMembers", workspaceId],
    queryFn: async () => {
      return await authClient.organization.getFullOrganization({
        query: {organizationSlug: workspaceId, membersLimit: 500},
        fetchOptions: {throw: true},
      });
    },
  }).data.members;
  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Members ({members.length})</CardTitle>
        <CardDescription>Members of this workspace.</CardDescription>
      </CardHeader>
      <CardContent className="px-7 flex flex-col gap-3">
        {members.map(member => (
          <div key={member.user.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar className="size-6 mr-2">
                <AvatarImage src={member.user.image ?? undefined} />
                <AvatarFallback>{member.user.name?.[0]}</AvatarFallback>
              </Avatar>{" "}
              <div className="flex items-baseline gap-2">
                <div className="font-medium">{member.user.name}</div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
