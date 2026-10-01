import {Button, Card} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {toast} from "sonner";
import {z} from "zod";

import {DiscordCardContents} from "@/components/discord-card-contents";
import {useAppForm} from "@/components/form";
import {GoogleDriveCardContents} from "@/components/google-drive-contents";
import {useWorkspace} from "@/hooks/use-workspace";
import {workspaceMutations} from "@/lib/workspace-mutations";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/settings/administration")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Administration | Workspace Settings | WOW"}]}),
});

function RouteComponent() {
  return (
    <div className="flex flex-col gap-8">
      <WorkspacePasswordCard />
      <GoogleDriveCard />
      <DiscordCard />
      <ArchiveWorkspaceCard />
      <DeleteWorkspaceCard />
    </div>
  );
}

function DeleteWorkspaceCard() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Delete Workspace</Card.Title>
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

function ArchiveWorkspaceCard() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Archive Workspace</Card.Title>
        <Card.Description>
          This will archive the workspace and all its data. It will not show up in the list of
          active workspace and its contents will become read-only. You can unarchive the workspace
          at any time.
        </Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button variant="secondary" isDisabled>
          Coming Soon
        </Button>
      </Card.Footer>
    </Card>
  );
}

function WorkspacePasswordCard() {
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
        <Card.Title>Workspace Password</Card.Title>
        <Card.Description>The workspace password is used to join the workspace.</Card.Description>
      </Card.Header>
      <form.AppForm>
        <Card.Content>
          <form
            id={form.formId}
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}>
            <form.AppField name="password" validators={{onSubmit: z.string().min(8)}}>
              {field => <field.TextField aria-label="Workspace password" />}
            </form.AppField>
          </form>
        </Card.Content>
        <Card.Footer>
          <form.SubmitButton>Save</form.SubmitButton>
        </Card.Footer>
      </form.AppForm>
    </Card>
  );
}

function GoogleDriveCard() {
  const {workspaceSlug} = Route.useParams();
  return (
    <Card>
      <GoogleDriveCardContents
        workspaceSlug={workspaceSlug}
        redirectUrl={`/${workspaceSlug}/settings/administration`}
      />
    </Card>
  );
}

function DiscordCard() {
  const {workspaceSlug} = Route.useParams();
  return (
    <Card>
      <DiscordCardContents
        workspaceSlug={workspaceSlug}
        redirectUrl={`/${workspaceSlug}/settings/administration`}
      />
    </Card>
  );
}
