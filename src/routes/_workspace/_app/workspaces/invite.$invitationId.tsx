import {Button, Card} from "@heroui/react";
import {useMutation, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {MailIcon} from "lucide-react";
import {toast} from "sonner";

import {CardFormSkeleton} from "@/components/page-skeletons";
import PixelBlast from "@/components/pixel-blast";
import {authClient} from "@/lib/auth-client";
import {errorMessage} from "@/lib/errors";
import {orpc} from "@/lib/orpc";
import {workspaceMembershipChanged} from "@/lib/workspace-membership";
import {accentHex} from "@/lib/workspace-theme";

/**
 * Where an emailed invitation's link goes (see `workspaces.invitations`). Signed-out visitors are
 * sent to log in (or sign up) first, then come back here.
 */
export const Route = createFileRoute("/_workspace/_app/workspaces/invite/$invitationId")({
  loader: ({context: {queryClient}, params: {invitationId}}) =>
    queryClient.ensureQueryData(
      orpc.workspaces.invitations.preview.queryOptions({input: {invitationId}})
    ),
  pendingComponent: CardFormSkeleton,
  errorComponent: () => (
    <InviteFrame title="Invitation not found">
      <p className="text-muted text-sm">
        This invitation link doesn't work. Check you copied all of it, or ask for a new one.
      </p>
      <Link to="/workspaces" className="text-accent text-sm underline-offset-4 hover:underline">
        Go to My workspaces
      </Link>
    </InviteFrame>
  ),
  component: RouteComponent,
  head: () => ({meta: [{title: "Invitation | WOW"}]}),
});

function InviteFrame({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <div className="relative flex w-full flex-1 items-center justify-center px-4">
      <div className="absolute inset-0">
        <PixelBlast color={accentHex(undefined)} pixelSize={3} />
      </div>
      <div className="z-10 w-full max-w-sm">
        <Card>
          <Card.Header>
            <Card.Title>{title}</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">{children}</Card.Content>
        </Card>
      </div>
    </div>
  );
}

function RouteComponent() {
  const {invitationId} = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invite = useSuspenseQuery(
    orpc.workspaces.invitations.preview.queryOptions({input: {invitationId}})
  ).data;
  const accept = useMutation(
    orpc.workspaces.invitations.accept.mutationOptions({
      onSuccess: ({slug}) => {
        workspaceMembershipChanged(queryClient, slug);
        toast.success(`Welcome to ${invite.teamName ?? "the team"}!`);
        void router.navigate({to: "/$workspaceSlug", params: {workspaceSlug: slug}});
      },
      onError: error =>
        toast.error(errorMessage(error, "Couldn't accept the invitation. Please try again.")),
    })
  );
  const team = (
    <Card variant="secondary">
      <Card.Header>
        <Card.Title>{invite.teamName}</Card.Title>
        <Card.Description>{invite.eventName}</Card.Description>
      </Card.Header>
    </Card>
  );
  const goToWorkspace = (
    <Button
      fullWidth
      onPress={() =>
        void router.navigate({to: "/$workspaceSlug", params: {workspaceSlug: invite.slug}})
      }>
      Go to the workspace
    </Button>
  );

  if (invite.isMember) {
    return (
      <InviteFrame title="You're already on the team">
        {team}
        {goToWorkspace}
      </InviteFrame>
    );
  }
  if (invite.status !== "pending") {
    return (
      <InviteFrame
        title={
          invite.status === "expired"
            ? "This invitation has expired"
            : invite.status === "accepted"
              ? "This invitation was already used"
              : "This invitation was cancelled"
        }>
        {team}
        <p className="text-muted text-sm">
          Ask {invite.inviterName} (or another owner) to invite you again, or for the workspace
          password.
        </p>
      </InviteFrame>
    );
  }
  if (!invite.forYou) {
    return (
      <InviteFrame title="This invitation is for someone else">
        {team}
        <p className="text-muted text-sm">
          {invite.inviterName} invited <strong>{invite.email}</strong>, but you're signed in as{" "}
          <strong>{invite.signedInAs}</strong>. Sign out and sign in (or sign up) with the invited
          address, or ask {invite.inviterName} to invite this one.
        </p>
        <Button
          variant="secondary"
          fullWidth
          onPress={() =>
            void authClient
              .signOut()
              .then(() =>
                router.navigate({
                  to: "/login",
                  search: {redirectTo: `/workspaces/invite/${invitationId}`},
                })
              )
              // Nothing of this account's (this invite's preview included) may show to whoever
              // signs in next.
              .then(() => queryClient.clear())
          }>
          Sign out and switch account
        </Button>
      </InviteFrame>
    );
  }
  return (
    <InviteFrame title="You're invited">
      <p className="text-muted text-sm">
        {invite.inviterName} invited you to join the team's workspace.
      </p>
      {team}
      <Button fullWidth isPending={accept.isPending} onPress={() => accept.mutate({invitationId})}>
        <MailIcon />
        Join the team
      </Button>
    </InviteFrame>
  );
}
