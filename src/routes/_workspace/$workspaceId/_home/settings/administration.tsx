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

export const Route = createFileRoute("/_workspace/$workspaceId/_home/settings/administration")({
  component: RouteComponent,
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
  // const navigate = useNavigate();
  // const { workspaceId } = useParams<{ workspaceId: string }>();
  // const utils = trpc.useUtils();
  // const mutation = trpc.workspaces.delete.useMutation({
  //   onSuccess: () => {
  //     navigate("/");
  //     utils.invalidate();
  //   },
  // });

  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Delete Workspace</CardTitle>
        <CardDescription>
          This will delete the workspace and all its data. This action is irreversible.
        </CardDescription>
      </CardHeader>
      <CardFooter className="border-t px-6 py-4">
        <Button
          variant="destructive"
          disabled
          // onClick={() => {
          //   toast.promise(mutation.mutateAsync(workspaceId!), {
          //     loading: "Deleting workspace...",
          //     success: "Success! Your workspace has been deleted.",
          //     error: "Oops! Something went wrong.",
          //   });
          // }}
        >
          {/* Delete */}
          Contact support to delete your workspace
        </Button>
      </CardFooter>
    </Card>
  );
}

function ArchiveWorkspaceCard() {
  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Archive Workspace</CardTitle>
        <CardDescription>
          This will archive the workspace and all its data. It will not show up in the list of
          active workspace and its contents will become read-only. You can unarchive the workspace
          at any time.
        </CardDescription>
      </CardHeader>
      <CardFooter className="gap-2 border-t px-6 py-4">
        <Button variant="secondary" disabled>
          Coming Soon
        </Button>
      </CardFooter>
    </Card>
  );
}

function WorkspacePasswordCard() {
  const workspaceId = Route.useParams().workspaceId;
  const workspace = useWorkspace({workspaceId});
  const form = useAppForm({
    defaultValues: {password: workspace.get.data.password ?? ""},
    onSubmit: ({value}) => {
      toast.promise(workspace.update.mutateAsync({workspaceId, ...value}), {
        loading: "Saving...",
        success: "Success! The workspace password has been updated.",
        error: "Oops! Something went wrong.",
      });
    },
  });

  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Workspace Password</CardTitle>
        <CardDescription>The workspace password is used to join the workspace.</CardDescription>
      </CardHeader>
      <form.AppForm>
        <form
          onSubmit={e => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}>
          <CardContent className="space-y-8">
            <form.AppField name="password">{field => <field.TextField />}</form.AppField>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <form.SubmitButton>Save</form.SubmitButton>
          </CardFooter>
        </form>
      </form.AppForm>
    </Card>
  );
}

function GoogleDriveCard() {
  const {workspaceId} = Route.useParams();
  return (
    <Card>
      <GoogleDriveCardContents
        workspaceId={workspaceId}
        redirectUrl={`/${workspaceId}/settings/administration`}
      />
    </Card>
  );
}

function DiscordCard() {
  const {workspaceId} = Route.useParams();
  return (
    <Card>
      <DiscordCardContents
        workspaceId={workspaceId}
        redirectUrl={`/${workspaceId}/settings/administration`}
      />
    </Card>
  );
}
