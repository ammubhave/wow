import {Alert, Button, Card, InputGroup, Label, Separator} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {CopyIcon, PlusIcon, TrashIcon} from "lucide-react";
import {toast} from "sonner";
import {z} from "zod";

import {useAppForm} from "@/components/form";
import {LookCard, TeamEmojiCard} from "@/components/settings/workspace-look-cards";
import {huntDetails, huntWebsiteLink, useHuntSuggestions} from "@/hooks/use-hunt-suggestions";
import {useWorkspace} from "@/hooks/use-workspace";
import {useIsWorkspaceOwner} from "@/hooks/use-workspace-role";
import {fromLocalInput, toLocalInput} from "@/lib/datetime-local";
import {orpc} from "@/lib/orpc";
import {workspaceMutations} from "@/lib/workspace-mutations";

/** A hunt website: empty, or a web address (https:// is added for you). */
const HUNT_WEBSITE_SCHEMA = z.union([
  z.literal(""),
  z.url({protocol: /^https?$/, error: "Enter a web address, like https://hunt.example"}),
]);

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const isOwner = useIsWorkspaceOwner();
  return (
    <>
      {!isOwner && (
        <Alert>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Only owners can change the details and look</Alert.Title>
            <Alert.Description>
              Anyone can add team emoji, links and tags below. Ask an owner (see Members) if
              something else needs changing.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <DetailsCard />
      <LookCard workspaceSlug={workspaceSlug} />
      <TeamEmojiCard workspaceSlug={workspaceSlug} />
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
                            // Both inputs shrink to fit a phone: the name narrower, the URL the rest.
                            className="w-24 min-w-0 shrink-0 sm:w-40"
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
                            className="min-w-0 flex-1"
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
          <form.SubmitButton savesChanges>Save</form.SubmitButton>
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
/** The link the hunt website is kept as (see `huntWebsiteLink`). */
const HUNT_WEBSITE = "Hunt website";

function DetailsCard() {
  const {suggestions: huntSuggestions, byId: huntsById} = useHuntSuggestions();
  const {workspaceSlug} = Route.useParams();
  const isOwner = useIsWorkspaceOwner();
  const workspace = useWorkspace();
  const mutation = useMutation(workspaceMutations.workspaces.update());
  const currentHuntWebsite = workspace.links.find(link => link.name === HUNT_WEBSITE)?.url ?? "";
  const form = useAppForm({
    defaultValues: {
      teamName: workspace.teamName ?? undefined,
      eventName: workspace.eventName ?? undefined,
      huntStartsAt: toLocalInput(workspace.huntStartsAt),
      huntEndsAt: toLocalInput(workspace.huntEndsAt),
      huntLocation: workspace.huntLocation ?? "",
      // The "Hunt website" link (the header's first link), edited here like on the create form.
      huntWebsite: currentHuntWebsite,
    },
    onSubmit: ({value}) => {
      const huntStartsAt = fromLocalInput(value.huntStartsAt);
      const huntEndsAt = fromLocalInput(value.huntEndsAt);
      if (huntStartsAt && huntEndsAt && huntEndsAt <= huntStartsAt) {
        toast.error("The hunt has to end after it starts.");
        return;
      }
      const {huntWebsite, ...details} = value;
      const website = huntWebsite.trim();
      // A changed website replaces the "Hunt website" link (first in the header), or removes it.
      const linksChanged = website !== currentHuntWebsite;
      const links = [
        ...(website ? [huntWebsiteLink(website)] : []),
        ...workspace.links
          .filter(link => link.name !== HUNT_WEBSITE)
          .map(({name, url}) => ({name, url})),
      ];
      mutation.mutate(
        {workspaceSlug, ...details, huntStartsAt, huntEndsAt, ...(linksChanged ? {links} : {})},
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
        <Card.Description>
          The team, and the hunt: when and where it is. With dates, the header counts the hunt down
          and up, and the solves chart covers it.
        </Card.Description>
      </Card.Header>
      <form.AppForm>
        <Card.Content>
          <form.Form>
            <form.AppField
              name="teamName"
              children={field => (
                <field.TextField variant="secondary" label="Team name" isDisabled={!isOwner} />
              )}
            />
            <form.AppField
              name="eventName"
              children={field => (
                <field.SuggestField
                  variant="secondary"
                  label="Event name"
                  isDisabled={!isOwner}
                  suggestions={huntSuggestions}
                  onPick={id => {
                    const listing = id ? huntsById.get(id) : undefined;
                    if (!listing) return;
                    // Picked a hunt: its dates, place and website too (still editable before saving).
                    const details = huntDetails(listing);
                    form.setFieldValue("huntStartsAt", details.huntStartsAt);
                    form.setFieldValue("huntEndsAt", details.huntEndsAt);
                    form.setFieldValue("huntLocation", details.huntLocation);
                    if (listing.url && !form.getFieldValue("huntWebsite")) {
                      form.setFieldValue("huntWebsite", listing.url);
                    }
                  }}
                />
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <form.AppField
                name="huntStartsAt"
                children={field => (
                  <field.TextField
                    variant="secondary"
                    label="Starts"
                    type="datetime-local"
                    isDisabled={!isOwner}
                  />
                )}
              />
              <form.AppField
                name="huntEndsAt"
                children={field => (
                  <field.TextField
                    variant="secondary"
                    label="Ends"
                    type="datetime-local"
                    isDisabled={!isOwner}
                  />
                )}
              />
            </div>
            <form.AppField
              name="huntLocation"
              children={field => (
                <field.TextField
                  variant="secondary"
                  label="Location"
                  placeholder="Online, or a city"
                  isDisabled={!isOwner}
                />
              )}
            />
            <form.AppField
              name="huntWebsite"
              validators={{onBlur: HUNT_WEBSITE_SCHEMA, onSubmit: HUNT_WEBSITE_SCHEMA}}
              children={field => (
                <field.TextField
                  variant="secondary"
                  label="Hunt website"
                  type="url"
                  placeholder="https://"
                  description="The first link in the workspace's header."
                  isDisabled={!isOwner}
                />
              )}
            />
            <div className="flex flex-col gap-1">
              <Label>Invitation link</Label>
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
        {isOwner && (
          <Card.Footer>
            <form.SubmitButton savesChanges>Save</form.SubmitButton>
          </Card.Footer>
        )}
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
          <form.SubmitButton savesChanges>Save</form.SubmitButton>
        </Card.Footer>
      </form.AppForm>
    </Card>
  );
}
