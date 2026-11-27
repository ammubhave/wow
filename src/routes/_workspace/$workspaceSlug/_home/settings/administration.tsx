import {Alert, Button, Card, Chip} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {ArchiveIcon, ArchiveRestoreIcon} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";
import {z} from "zod";

import {ConfirmDialog} from "@/components/confirm-dialog";
import {useAppForm} from "@/components/form";
import {AdministrationSkeleton} from "@/components/page-skeletons";
import {SpreadsheetChoice, VoiceChoice} from "@/components/workspace-tools";
import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {useWorkspace} from "@/hooks/use-workspace";
import {useIsWorkspaceOwner} from "@/hooks/use-workspace-role";
import {orpc} from "@/lib/orpc";
import {workspaceMutations} from "@/lib/workspace-mutations";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/settings/administration")({
  component: RouteComponent,
  pendingComponent: AdministrationSkeleton,
  head: () => ({meta: [{title: "Administration | Workspace settings | WOW"}]}),
});

function RouteComponent() {
  const isOwner = useIsWorkspaceOwner();
  const isReadOnly = useIsReadOnly();
  // Owners can change these, unless the workspace is archived (then only the Archive card works,
  // so an owner can unarchive it).
  const canEdit = isOwner && !isReadOnly;
  return (
    <div className="flex flex-col gap-8">
      {!isOwner && (
        <Alert>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Only owners can change these settings</Alert.Title>
            <Alert.Description>
              Ask an owner (see Members) if something here needs changing.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <WorkspacePasswordCard canEdit={canEdit} />
      <SpreadsheetCard canEdit={canEdit} />
      <VoiceCard canEdit={canEdit} />
      <ArchiveWorkspaceCard isOwner={isOwner} />
      <DeleteWorkspaceCard />
    </div>
  );
}

function DeleteWorkspaceCard() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Delete workspace</Card.Title>
        <Card.Description>
          This will delete the workspace and all its data. This action is irreversible.
        </Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button variant="danger" isDisabled>
          Contact support to delete your workspace
        </Button>
      </Card.Footer>
    </Card>
  );
}

function ArchiveWorkspaceCard({isOwner}: {isOwner: boolean}) {
  const {workspaceSlug} = Route.useParams();
  const {archivedAt} = useWorkspace();
  const mutation = useMutation(orpc.workspaces.setArchived.mutationOptions());
  const [isConfirming, setIsConfirming] = useState(false);
  const isArchived = archivedAt !== null;
  const setArchived = (archived: boolean) =>
    mutation.mutate(
      {workspaceSlug, archived},
      {
        onSuccess: () => {
          setIsConfirming(false);
          toast.success(archived ? "The workspace is archived." : "The workspace is back.");
        },
        onError: () => toast.error("Couldn't change that. Please try again."),
      }
    );
  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          Archive workspace
          {isArchived && (
            <Chip size="sm" variant="soft">
              <Chip.Label>Archived</Chip.Label>
            </Chip>
          )}
        </Card.Title>
        <Card.Description>
          {isArchived
            ? "Read-only and hidden from everyone's workspace list. Unarchive it to bring it back."
            : "Once the hunt is done: makes the workspace read-only and hides it from everyone's workspace list. Nothing is deleted, and you can unarchive it any time."}
        </Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button
          variant="secondary"
          isDisabled={!isOwner}
          isPending={mutation.isPending}
          // Unarchiving only gives things back, so it doesn't ask.
          onPress={() => (isArchived ? setArchived(false) : setIsConfirming(true))}>
          {isArchived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
          {isArchived ? "Unarchive" : "Archive"}
        </Button>
      </Card.Footer>
      <ConfirmDialog
        isOpen={isConfirming}
        onOpenChange={setIsConfirming}
        heading="Archive this workspace?"
        confirmLabel="Archive"
        status="warning"
        isPending={mutation.isPending}
        onConfirm={() => setArchived(true)}>
        It becomes read-only for everyone and disappears from their workspace lists. Nothing is
        deleted, and you can unarchive it here any time.
      </ConfirmDialog>
    </Card>
  );
}

function WorkspacePasswordCard({canEdit}: {canEdit: boolean}) {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  const mutation = useMutation(workspaceMutations.workspaces.update());
  const form = useAppForm({
    defaultValues: {password: workspace.password ?? ""},
    onSubmit: ({value}) => {
      mutation.mutate(
        {workspaceSlug, ...value},
        {onSuccess: () => toast.success("The workspace password has been updated.")}
      );
      // Untouched again, the form follows the workspace (now showing this change) from here on.
      form.reset(value);
    },
  });

  return (
    <Card>
      <Card.Header>
        <Card.Title>Workspace password</Card.Title>
        <Card.Description>Teammates join with it and the invitation link.</Card.Description>
      </Card.Header>
      <form.AppForm>
        <Card.Content>
          <form.Form>
            <form.AppField
              name="password"
              validators={{onSubmit: z.string().min(8, "Use at least 8 characters.")}}>
              {field => (
                <field.PasswordField
                  variant="secondary"
                  aria-label="Workspace password"
                  // Members can still see it, to tell teammates how to join.
                  readOnly={!canEdit}
                />
              )}
            </form.AppField>
          </form.Form>
        </Card.Content>
        {canEdit && (
          <Card.Footer>
            <form.SubmitButton savesChanges>Save</form.SubmitButton>
          </Card.Footer>
        )}
      </form.AppForm>
    </Card>
  );
}

function SpreadsheetCard({canEdit}: {canEdit: boolean}) {
  const {workspaceSlug} = Route.useParams();
  return (
    <Card>
      <SpreadsheetChoice
        isDisabled={!canEdit}
        workspaceSlug={workspaceSlug}
        redirectUrl={`/${workspaceSlug}/settings/administration`}
      />
    </Card>
  );
}

function VoiceCard({canEdit}: {canEdit: boolean}) {
  const {workspaceSlug} = Route.useParams();
  return (
    <Card>
      <VoiceChoice
        isDisabled={!canEdit}
        workspaceSlug={workspaceSlug}
        redirectUrl={`/${workspaceSlug}/settings/administration`}
      />
    </Card>
  );
}
