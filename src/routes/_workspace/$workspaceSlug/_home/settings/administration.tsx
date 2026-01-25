import {createFileRoute} from "@tanstack/react-router";
import {toast} from "sonner";

import {DiscordCardContents} from "@/components/discord-card-contents";
import {useAppForm} from "@/components/form";
import {GoogleDriveCardContents} from "@/components/google-drive-contents";
import {Button} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {useWorkspace} from "@/components/use-workspace";

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
      <CardHeader>
        <CardTitle>Delete Workspace</CardTitle>
        <CardDescription>
          This will delete the workspace and all its data. This action is irreversible.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="destructive" disabled>
          Contact support to delete your workspace
        </Button>
      </CardFooter>
    </Card>
  );
}

function ArchiveWorkspaceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Archive Workspace</CardTitle>
        <CardDescription>
          This will archive the workspace and all its data. It will not show up in the list of
          active workspace and its contents will become read-only. You can unarchive the workspace
          at any time.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="secondary" disabled>
          Coming Soon
        </Button>
      </CardFooter>
    </Card>
  );
}

function WorkspacePasswordCard() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace({workspaceSlug});
  const form = useAppForm({
    defaultValues: {password: workspace.get.data.password ?? ""},
    onSubmit: ({value}) => {
      toast.promise(workspace.update.mutateAsync({workspaceSlug, ...value}), {
        loading: "Saving...",
        success: "Success! The workspace password has been updated.",
        error: "Oops! Something went wrong.",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Password</CardTitle>
        <CardDescription>The workspace password is used to join the workspace.</CardDescription>
      </CardHeader>
      <form.AppForm>
        <CardContent>
          <form
            id={form.formId}
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}>
            <form.AppField name="password">{field => <field.TextField />}</form.AppField>
          </form>
        </CardContent>
        <CardFooter>
          <form.SubmitButton>Save</form.SubmitButton>
        </CardFooter>
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
