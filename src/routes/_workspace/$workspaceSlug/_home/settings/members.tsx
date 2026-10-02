import {Avatar, Card} from "@heroui/react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";

import {PeopleCardSkeleton} from "@/components/page-skeletons";
import {gravatarUrl} from "@/components/user-hover-card";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/settings/members")({
  loader: ({context: {queryClient}, params: {workspaceSlug}}) =>
    queryClient.ensureQueryData(
      orpc.workspaces.members.list.queryOptions({input: {workspaceSlug}})
    ),
  pendingComponent: () => <PeopleCardSkeleton />,
  component: RouteComponent,
  head: () => ({meta: [{title: "Members | Workspace Settings | WOW"}]}),
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const members = useSuspenseQuery(
    orpc.workspaces.members.list.queryOptions({input: {workspaceSlug}})
  ).data;
  return (
    <Card>
      <Card.Header>
        <Card.Title>Members ({members.length})</Card.Title>
        <Card.Description>Members of this workspace.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {members.map(member => (
          <div key={member.user.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar>
                <Avatar.Image src={member.user.image ?? gravatarUrl(member.user.email)} />
                <Avatar.Fallback>{member.user.name?.[0]}</Avatar.Fallback>
              </Avatar>
              <div className="flex flex-col items-baseline">
                <div className="font-medium">{member.user.name}</div>
              </div>
            </div>
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}
