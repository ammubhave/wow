import {
  AlertDialog,
  Avatar,
  Button,
  Card,
  Chip,
  Description,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import {useMutation, useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {CopyIcon, LinkIcon, MailIcon, RotateCwIcon, UserMinusIcon, XIcon} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";
import {z} from "zod";

import {ControlledAlertDialog} from "@/components/controlled-dialog";
import {PeopleCardSkeleton} from "@/components/page-skeletons";
import {gravatarUrl} from "@/components/user-hover-card";
import {useWorkspace} from "@/hooks/use-workspace";
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
    <div className="flex flex-col gap-8">
      {myRole === "owner" && <InviteCard workspaceSlug={workspaceSlug} />}
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
                    {member.user.id === me && (
                      <span className="text-muted font-normal"> (you)</span>
                    )}
                  </span>
                  {myRole === "owner" && (
                    <span className="text-muted truncate text-xs">{member.user.email}</span>
                  )}
                </div>
              </div>
              {myRole === "owner" ? (
                <div className="flex shrink-0 items-center gap-1">
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
                  {member.user.id !== me && (
                    <RemoveMemberButton
                      workspaceSlug={workspaceSlug}
                      userId={member.user.id}
                      name={member.user.name}
                    />
                  )}
                </div>
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
    </div>
  );
}

/** Removes someone from the workspace, after asking (owners only; not yourself: that's Leave). */
function RemoveMemberButton({
  workspaceSlug,
  userId,
  name,
}: {
  workspaceSlug: string;
  userId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const remove = useMutation(orpc.workspaces.members.remove.mutationOptions());
  return (
    <ControlledAlertDialog
      isOpen={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="sm" isIconOnly aria-label={`Remove ${name}`}>
          <UserMinusIcon />
        </Button>
      }>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Remove {name}?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>
              They lose access to this workspace right away. Their puzzles, answers and messages
              stay. They can join again with the workspace password, so change it (Settings ›
              Administration) if they shouldn't.
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button
              variant="danger"
              isPending={remove.isPending}
              onPress={() =>
                remove.mutate(
                  {workspaceSlug, userId},
                  {
                    onSuccess: () => {
                      setOpen(false);
                      toast.success(`${name} was removed from the workspace.`);
                    },
                    onError: error => toast.error(error.message),
                  }
                )
              }>
              Remove
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </ControlledAlertDialog>
  );
}

/** The addresses in what was typed or pasted (commas, spaces or new lines between them). */
function parseEmails(text: string) {
  const parts = text
    .split(/[\s,;]+/)
    .map(part => part.replace(/^<|>$/g, "").trim())
    .filter(Boolean);
  const valid = parts.filter(part => z.email().safeParse(part).success);
  return {
    valid: [...new Set(valid.map(email => email.toLowerCase()))],
    invalid: parts.filter(p => !valid.includes(p)),
  };
}

const daysLeft = (date: Date) => Math.max(1, Math.ceil((date.getTime() - Date.now()) / 86_400_000));

/** Owners invite people by email, and see (resend, cancel) the invitations still pending. */
function InviteCard({workspaceSlug}: {workspaceSlug: string}) {
  const [text, setText] = useState("");
  const {valid, invalid} = parseEmails(text);
  const pending = useQuery(orpc.workspaces.invitations.list.queryOptions({input: {workspaceSlug}}));
  const send = useMutation(orpc.workspaces.invitations.send.mutationOptions());
  const resend = useMutation(orpc.workspaces.invitations.resend.mutationOptions());
  const cancel = useMutation(orpc.workspaces.invitations.cancel.mutationOptions());

  const onSend = () =>
    send.mutate(
      {workspaceSlug, emails: valid},
      {
        onSuccess: results => {
          const sent = results.filter(result => result.ok);
          const failed = results.filter(result => !result.ok);
          if (sent.length > 0) {
            toast.success(
              sent.length === 1
                ? `Invitation sent to ${sent[0]!.email}.`
                : `${sent.length} invitations sent.`
            );
          }
          for (const result of failed) toast.error(`${result.email}: ${result.message}`);
          // Keep what didn't go (and anything that wasn't an address), to fix and send again.
          setText([...failed.map(result => result.email), ...invalid].join("\n"));
        },
        onError: error => toast.error(error.message),
      }
    );

  return (
    <Card>
      <Card.Header>
        <Card.Title>Invite people</Card.Title>
        <Card.Description>
          Each person gets an email with a link to join; it works when they sign in (or sign up)
          with that address, and expires after 7 days. No password needed.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <TextField variant="secondary" value={text} onChange={setText}>
          <Label>Email addresses</Label>
          <TextArea rows={3} placeholder="sam@example.com, kit@example.com" />
          <Description>
            {invalid.length > 0
              ? `Not an email address: ${invalid.join(", ")}`
              : "Paste several at once, separated by commas or new lines."}
          </Description>
        </TextField>
        <div>
          <Button isDisabled={valid.length === 0} isPending={send.isPending} onPress={onSend}>
            <MailIcon />
            {valid.length > 1 ? `Send ${valid.length} invitations` : "Send invitation"}
          </Button>
        </div>
        <ShareLinkAndPassword workspaceSlug={workspaceSlug} />
        {pending.data && pending.data.length > 0 && (
          <section aria-label="Pending invitations" className="flex flex-col gap-2">
            <h3 className="text-muted text-xs font-medium tracking-wide uppercase">
              Waiting to join ({pending.data.length})
            </h3>
            <ul className="divide-separator flex flex-col divide-y">
              {pending.data.map(invitation => (
                <li key={invitation.id} className="flex items-center gap-2 py-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{invitation.email}</span>
                    <span className="text-muted text-xs">
                      Invited by {invitation.inviterName} · expires in{" "}
                      {daysLeft(invitation.expiresAt)}{" "}
                      {daysLeft(invitation.expiresAt) === 1 ? "day" : "days"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={resend.isPending}
                    aria-label={`Resend the invitation to ${invitation.email}`}
                    onPress={() =>
                      resend.mutate(
                        {workspaceSlug, invitationId: invitation.id},
                        {
                          onSuccess: () => toast.success(`Sent again to ${invitation.email}.`),
                          onError: error => toast.error(error.message),
                        }
                      )
                    }>
                    <RotateCwIcon />
                    Resend
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    isDisabled={cancel.isPending}
                    aria-label={`Cancel the invitation to ${invitation.email}`}
                    onPress={() =>
                      cancel.mutate(
                        {workspaceSlug, invitationId: invitation.id},
                        {
                          onSuccess: () =>
                            toast.success(`The invitation to ${invitation.email} was cancelled.`),
                          onError: error => toast.error(error.message),
                        }
                      )
                    }>
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Card.Content>
    </Card>
  );
}

const copy = (text: string, what: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied.`),
    () => toast.error("Couldn't copy. Select it and copy it yourself.")
  );

/**
 * The other way in: the invitation link and the workspace password, e.g. for the team's group chat
 * (anyone who has both can join).
 */
function ShareLinkAndPassword({workspaceSlug}: {workspaceSlug: string}) {
  const workspace = useWorkspace();
  const link = `https://join.wafflehaus.io/${workspaceSlug}`;
  const password = workspace.password ?? "";
  const message = `Join ${workspace.teamName ?? "the team"} on WOW: ${link}\nPassword: ${password}`;
  return (
    <section
      aria-label="Share the link and password"
      className="border-separator flex flex-col gap-2 border-t pt-4">
      <h3 className="text-muted text-xs font-medium tracking-wide uppercase">
        Or share the link and password
      </h3>
      <p className="text-muted text-sm">
        For a group chat: anyone with both can join, with whatever account they sign in with.
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted text-xs">Link</dt>
        <dd className="truncate font-mono text-xs">{link}</dd>
        <dd>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label="Copy invitation link"
            onPress={() => void copy(link, "Invitation link")}>
            <CopyIcon />
          </Button>
        </dd>
        <dt className="text-muted text-xs">Password</dt>
        <dd className="truncate font-mono text-xs">{password}</dd>
        <dd>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label="Copy workspace password"
            onPress={() => void copy(password, "Password")}>
            <CopyIcon />
          </Button>
        </dd>
      </dl>
      <div>
        <Button size="sm" variant="secondary" onPress={() => void copy(message, "Invitation")}>
          <LinkIcon />
          Copy both, ready to paste
        </Button>
      </div>
    </section>
  );
}
