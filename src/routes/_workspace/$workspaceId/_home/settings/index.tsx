import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {CopyIcon, PlusIcon, TrashIcon} from "lucide-react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {Button} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {Field, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {useWorkspace} from "@/components/use-workspace";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/$workspaceId/_home/settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <DetailsCard />
      <UpdateLinksCard />
      <UpdateTagsCard />
      <LeaveWorkspaceCard />
    </>
  );
}

function UpdateLinksCard() {
  const {workspaceId} = Route.useParams();
  const workspace = useWorkspace({workspaceId});
  const links = useSuspenseQuery(
    orpc.workspaces.links.list.queryOptions({input: {workspaceId}})
  ).data;
  const form = useAppForm({
    defaultValues: {links: links.map(({name, url}) => ({name, url}))},
    onSubmit: ({value}) => {
      toast.promise(workspace.links.update.mutateAsync({workspaceId, ...value}), {
        loading: "Saving...",
        success: "Success! Your changes have been saved.",
        error: "Oops! Something went wrong.",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Links</CardTitle>
        <CardDescription>
          Add links to this workspace to be displayed in the navigation bar. For example, you can
          add a link to the puzzle hunt website.
        </CardDescription>
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
            <form.Field name="links" mode="array">
              {field => (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead className="w-0">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {field.state.value.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3}>
                            <p className="text-muted-foreground">No links added yet.</p>
                          </TableCell>
                        </TableRow>
                      )}
                      {field.state.value.map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <form.AppField
                              name={`links[${i}].name`}
                              children={field => <field.TextField className="bg-background" />}
                            />
                          </TableCell>
                          <TableCell>
                            <form.AppField
                              name={`links[${i}].url`}
                              children={field => <field.TextField className="bg-background" />}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => field.removeValue(i)}>
                              <TrashIcon className="size-4" />
                              <span className="sr-only">Remove link</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-2"
                      onClick={() => field.pushValue({name: "", url: "about:blank"})}>
                      <PlusIcon className="size-4" />
                      Add link
                    </Button>
                  </div>
                </>
              )}
            </form.Field>
          </form>
        </CardContent>
        <CardFooter>
          <form.SubmitButton>Save</form.SubmitButton>
        </CardFooter>
      </form.AppForm>
    </Card>
  );
}

function LeaveWorkspaceCard() {
  const navigate = Route.useNavigate();
  const {workspaceId} = Route.useParams();
  const leaveMutation = useMutation(orpc.workspaces.leave.mutationOptions());
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Workspace</CardTitle>
        <CardDescription>
          Leave this workspace. You will no longer be able to access it.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          variant="destructive"
          onClick={() => {
            toast.promise(
              leaveMutation.mutateAsync(
                {workspaceId},
                {
                  onSuccess: async () => {
                    await navigate({to: "/workspaces"});
                  },
                }
              ),
              {
                loading: "Leaving workspace...",
                success: "Success! You have left the workspace.",
                error: "Oops! Something went wrong.",
              }
            );
          }}>
          Leave
        </Button>
      </CardFooter>
    </Card>
  );
}
function DetailsCard() {
  const {workspaceId} = Route.useParams();
  const workspace = useWorkspace({workspaceId});

  const form = useAppForm({
    defaultValues: {
      teamName: workspace.get.data.teamName ?? undefined,
      eventName: workspace.get.data.eventName ?? undefined,
    },
    onSubmit: ({value}) => {
      toast.promise(workspace.update.mutateAsync({workspaceId, ...value}), {
        loading: "Saving...",
        success: "Success! Your changes have been saved.",
        error: "Oops! Something went wrong.",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>General information about this workspace.</CardDescription>
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
            <FieldGroup>
              <form.AppField
                name="teamName"
                children={field => <field.TextField label="Team Name" />}
              />
              <form.AppField
                name="eventName"
                children={field => <field.TextField label="Event Name" />}
              />
              <Field>
                <FieldLabel>Invitation Link</FieldLabel>
                <p className="text-muted-foreground text-xs flex items-center gap-2">
                  https://join.wafflehaus.io/{workspaceId}
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => {
                      toast.promise(
                        navigator.clipboard.writeText(`https://join.wafflehaus.io/${workspaceId}`),
                        {
                          loading: "Copying...",
                          success: "Join link copied!",
                          error: "Oops! Something went wrong.",
                        }
                      );
                    }}>
                    <CopyIcon className="size-4" />
                  </Button>
                </p>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <form.SubmitButton>Save</form.SubmitButton>
        </CardFooter>
      </form.AppForm>
    </Card>
  );
}

function UpdateTagsCard() {
  const {workspaceId} = Route.useParams();
  const tags = (useWorkspace({workspaceId}).get.data.tags as string[] | undefined) ?? [];
  const mutation = useMutation(orpc.workspaces.update.mutationOptions());
  const form = useAppForm({
    defaultValues: {tags},
    onSubmit: ({value}) => {
      toast.promise(mutation.mutateAsync({workspaceId, ...value}), {
        loading: "Saving...",
        success: "Success! Your changes have been saved.",
        error: "Oops! Something went wrong.",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>
          Add tags to this workspace to help categorize and organize the puzzles.
        </CardDescription>
      </CardHeader>
      <form.AppForm>
        <CardContent className="space-y-4">
          <form
            id={form.formId}
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}>
            <form.Field name="tags" mode="array">
              {field => (
                <>
                  <Table>
                    <TableBody>
                      {field.state.value.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2}>
                            <p className="text-muted-foreground">No tags added yet.</p>
                          </TableCell>
                        </TableRow>
                      )}
                      {field.state.value.map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <form.AppField
                              name={`tags[${i}]`}
                              children={field => <field.TextField className="bg-background" />}
                            />
                          </TableCell>

                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => field.removeValue(i)}>
                              <TrashIcon className="size-4" />
                              <span className="sr-only">Remove tag</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-2"
                      onClick={() => field.pushValue("")}>
                      <PlusIcon className="size-4" />
                      Add tag
                    </Button>
                  </div>{" "}
                </>
              )}
            </form.Field>
          </form>
        </CardContent>
        <CardFooter>
          <form.SubmitButton>Save</form.SubmitButton>
        </CardFooter>
      </form.AppForm>
    </Card>
  );
}
