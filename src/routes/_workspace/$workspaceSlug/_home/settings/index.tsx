import {Button, Card, InputGroup, Label, Separator} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {CopyIcon, PlusIcon, TrashIcon} from "lucide-react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {useWorkspace} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";
import {workspaceMutations} from "@/lib/workspace-mutations";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/settings/")({
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
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  const mutation = useMutation(workspaceMutations.workspaces.update());
  const form = useAppForm({
    defaultValues: {links: workspace.links.map(({name, url}) => ({name, url})) ?? []},
    onSubmit: ({value}) => {
      mutation.mutate(
        {workspaceSlug, ...value},
        {onSuccess: () => toast.success("Your changes have been saved.")}
      );
      // Untouched again, the form follows the workspace (now showing this change) from here on.
      form.reset(value);
    },
  });

  return (
    <Card>
      <Card.Header>
        <Card.Title>Links</Card.Title>
        <Card.Description>
          Add links to this workspace to be displayed in the navigation bar. For example, you can
          add a link to the puzzle hunt website.
        </Card.Description>
      </Card.Header>
      <form.AppForm>
        <Card.Content>
          <form.Form>
            <form.Field name="links" mode="array">
              {field => (
                <div className="flex flex-col gap-1">
                  {field.state.value.map((_, i) => (
                    // oxlint-disable-next-line react/no-array-index-key -- TanStack Form array fields are bound by index (`links[${i}]`), so the index is the row's identity; the values are free-text and may be empty or duplicated, so there is no stable data key.
                    <InputGroup key={i} variant="secondary">
                      <form.AppField
                        name={`links[${i}].name`}
                        children={nameField => (
                          <InputGroup.Input
                            value={nameField.state.value}
                            onChange={e => nameField.handleChange(e.target.value)}
                            onBlur={nameField.handleBlur}
                            aria-label={`Link ${i + 1} name`}
                            placeholder="Name"
                          />
                        )}
                      />
                      <Separator orientation="vertical" />
                      <form.AppField
                        name={`links[${i}].url`}
                        children={urlField => (
                          <InputGroup.Input
                            value={urlField.state.value}
                            onChange={e => urlField.handleChange(e.target.value)}
                            onBlur={urlField.handleBlur}
                            aria-label={`Link ${i + 1} URL`}
                            placeholder="URL"
                          />
                        )}
                      />
                      <InputGroup.Suffix className="pe-0">
                        <Button
                          isIconOnly
                          variant="secondary"
                          size="sm"
                          aria-label="Remove link"
                          onPress={() => field.removeValue(i)}>
                          <TrashIcon />
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                  ))}
                  <Button
                    className="w-fit"
                    type="button"
                    variant="ghost"
                    onPress={() => field.pushValue({name: "", url: ""})}>
                    <PlusIcon />
                    Add link
                  </Button>
                </div>
              )}
            </form.Field>
          </form.Form>
        </Card.Content>
        <Card.Footer>
          <form.SubmitButton>Save</form.SubmitButton>
        </Card.Footer>
      </form.AppForm>
    </Card>
  );
}

function LeaveWorkspaceCard() {
  const navigate = Route.useNavigate();
  const {workspaceSlug} = Route.useParams();
  const leaveMutation = useMutation(orpc.workspaces.leave.mutationOptions());
  return (
    <Card>
      <Card.Header>
        <Card.Title>Leave Workspace</Card.Title>
        <Card.Description>
          Leave this workspace. You will no longer be able to access it.
        </Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button
          variant="danger"
          onPress={() => {
            toast.promise(
              leaveMutation.mutateAsync(
                {workspaceSlug},
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
      </Card.Footer>
    </Card>
  );
}
function DetailsCard() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  const mutation = useMutation(workspaceMutations.workspaces.update());
  const form = useAppForm({
    defaultValues: {
      teamName: workspace.teamName ?? undefined,
      eventName: workspace.eventName ?? undefined,
    },
    onSubmit: ({value}) => {
      mutation.mutate(
        {workspaceSlug, ...value},
        {onSuccess: () => toast.success("Your changes have been saved.")}
      );
      // Untouched again, the form follows the workspace (now showing this change) from here on.
      form.reset(value);
    },
  });

  return (
    <Card>
      <Card.Header>
        <Card.Title>Details</Card.Title>
        <Card.Description>General information about this workspace.</Card.Description>
      </Card.Header>
      <form.AppForm>
        <Card.Content>
          <form.Form>
            <form.AppField
              name="teamName"
              children={field => <field.TextField variant="secondary" label="Team Name" />}
            />
            <form.AppField
              name="eventName"
              children={field => <field.TextField variant="secondary" label="Event Name" />}
            />
            <div className="flex flex-col gap-1">
              <Label>Invitation Link</Label>
              <p className="text-muted flex items-center gap-2 text-xs">
                https://join.wafflehaus.io/{workspaceSlug}
                <Button
                  variant="ghost"
                  isIconOnly
                  type="button"
                  aria-label="Copy invitation link"
                  onPress={() => {
                    toast.promise(
                      navigator.clipboard.writeText(`https://join.wafflehaus.io/${workspaceSlug}`),
                      {
                        loading: "Copying...",
                        success: "Join link copied!",
                        error: "Oops! Something went wrong.",
                      }
                    );
                  }}>
                  <CopyIcon />
                </Button>
              </p>
            </div>
          </form.Form>
        </Card.Content>
        <Card.Footer>
          <form.SubmitButton>Save</form.SubmitButton>
        </Card.Footer>
      </form.AppForm>
    </Card>
  );
}

function UpdateTagsCard() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  const mutation = useMutation(workspaceMutations.workspaces.update());
  const form = useAppForm({
    defaultValues: {tags: workspace.tags},
    onSubmit: ({value}) => {
      mutation.mutate(
        {workspaceSlug, ...value},
        {onSuccess: () => toast.success("Your changes have been saved.")}
      );
      // Untouched again, the form follows the workspace (now showing this change) from here on.
      form.reset(value);
    },
  });

  return (
    <Card>
      <Card.Header>
        <Card.Title>Tags</Card.Title>
        <Card.Description>
          Add tags to this workspace to help categorize and organize the puzzles.
        </Card.Description>
      </Card.Header>
      <form.AppForm>
        <Card.Content>
          <form.Form>
            <form.Field name="tags" mode="array">
              {field => (
                <div className="flex flex-col gap-1">
                  {field.state.value.map((_, i) => (
                    // oxlint-disable-next-line react/no-array-index-key -- TanStack Form array fields are bound by index (`tags[${i}]`), so the index is the row's identity; the values are free-text and may be empty or duplicated, so there is no stable data key.
                    <InputGroup key={i} variant="secondary">
                      <form.AppField
                        name={`tags[${i}]`}
                        children={tagField => (
                          <InputGroup.Input
                            value={tagField.state.value}
                            onChange={e => tagField.handleChange(e.target.value)}
                            onBlur={tagField.handleBlur}
                            aria-label={`Tag ${i + 1}`}
                          />
                        )}
                      />
                      <InputGroup.Suffix className="pe-0">
                        <Button
                          isIconOnly
                          variant="secondary"
                          size="sm"
                          aria-label="Remove tag"
                          onPress={() => field.removeValue(i)}>
                          <TrashIcon />
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                  ))}
                  <Button
                    className="w-fit"
                    type="button"
                    variant="ghost"
                    onPress={() => field.pushValue("")}>
                    <PlusIcon />
                    Add tag
                  </Button>
                </div>
              )}
            </form.Field>
          </form.Form>
        </Card.Content>
        <Card.Footer>
          <form.SubmitButton>Save</form.SubmitButton>
        </Card.Footer>
      </form.AppForm>
    </Card>
  );
}
