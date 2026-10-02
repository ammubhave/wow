import {Avatar, Card, Chip, ListBox, Select} from "@heroui/react";
import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {toast} from "sonner";

import {PeopleCardSkeleton} from "@/components/page-skeletons";
import {gravatarUrl} from "@/components/user-hover-card";
import {authClient} from "@/lib/auth-client";
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

const ROLES = [
  {id: "owner", label: "Owner"},
  {id: "member", label: "Member"},
] as const;

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const me = authClient.useSession().data?.user.id;
  const {members, myRole} = useSuspenseQuery(
    orpc.workspaces.members.list.queryOptions({input: {workspaceSlug}})
  ).data;
  const updateRole = useMutation(orpc.workspaces.members.updateRole.mutationOptions());
  // Owners first, then by name.
  const sorted = members.toSorted(
    (a, b) =>
      Number(b.role === "owner") - Number(a.role === "owner") ||
      a.user.name.localeCompare(b.user.name)
  );

  return (
    <Card>
      <Card.Header>
        <Card.Title>Members ({members.length})</Card.Title>
        <Card.Description>
          Owners manage the workspace: its name, password, Google and Discord connections, and who
          else is an owner. Everyone can edit puzzles, links and tags.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {sorted.map(member => (
          <div key={member.user.id} className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar>
                <Avatar.Image src={member.user.image ?? gravatarUrl(member.user.email)} />
                <Avatar.Fallback>{member.user.name?.[0]}</Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  {member.user.name}
                  {member.user.id === me && <span className="text-muted font-normal"> (you)</span>}
                </span>
                {myRole === "owner" && (
                  <span className="text-muted truncate text-xs">{member.user.email}</span>
                )}
              </div>
            </div>
            {myRole === "owner" ? (
              <Select
                aria-label={`Role of ${member.user.name}`}
                className="w-32 shrink-0"
                variant="secondary"
                value={member.role}
                isDisabled={updateRole.isPending}
                onChange={role => {
                  if (role !== "owner" && role !== "member") return;
                  if (role === member.role) return;
                  updateRole.mutate(
                    {workspaceSlug, userId: member.user.id, role},
                    {
                      // (Every query refetches after a mutation, so your own role updates too.)
                      onSuccess: () =>
                        toast.success(
                          role === "owner"
                            ? `${member.user.name} is now an owner.`
                            : `${member.user.name} is now a member.`
                        ),
                      onError: error => toast.error(error.message),
                    }
                  );
                }}>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {ROLES.map(role => (
                      <ListBox.Item key={role.id} id={role.id} textValue={role.label}>
                        {role.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            ) : (
              member.role === "owner" && (
                <Chip size="sm" variant="secondary">
                  Owner
                </Chip>
              )
            )}
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}
