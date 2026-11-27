import {Alert, Button, Card, InputGroup, Separator} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {PlusIcon, TrashIcon} from "lucide-react";
import {toast} from "sonner";
import {z} from "zod";

import {useAppForm} from "@/components/form";
import {IconButton} from "@/components/icon-button";
import {LookCard, TeamEmojiCard} from "@/components/settings/workspace-look-cards";
import {huntDetails, huntWebsiteLink, useHuntSuggestions} from "@/hooks/use-hunt-suggestions";
import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {useWorkspace} from "@/hooks/use-workspace";
import {useIsWorkspaceOwner} from "@/hooks/use-workspace-role";
import {fromLocalInput, toLocalInput} from "@/lib/datetime-local";
import {workspaceMutations} from "@/lib/workspace-mutations";

/** A hunt website: empty, or a web address (https:// is added for you). */
const HUNT_WEBSITE_SCHEMA = z.union([
  z.literal(""),
  z.url({protocol: /^https?$/, error: "Enter a web address, like https://hunt.example"}),
]);

/** A team or event name: can be changed, not cleared. */
const NAME_SCHEMA = (what: string) =>
  z.string().trim().min(1, `Give the ${what} a name.`).optional();

/**
 * The links as they'll be saved: blank rows dropped, "https://" added to a bare address
 * ("hunt.example"). Or what's wrong with them, before anything is sent.
 */
function linksToSave(links: {name: string; url: string}[]) {
  const kept = links
    .map(link => ({name: link.name.trim(), url: link.url.trim()}))
    .filter(link => link.name !== "" || link.url !== "");
  const result = kept.map(link => {
    const url = /^[a-z][a-z\d+.-]*:/i.test(link.url) ? link.url : `https://${link.url}`;
    return {name: link.name, url};
  });
  for (const [i, link] of result.entries()) {
    if (link.name === "") return {error: `Give link ${i + 1} a name.`} as const;
    // Spaces too: some browsers accept them in a URL where the server doesn't.
    const valid = HUNT_WEBSITE_SCHEMA.safeParse(link.url).success && !/\s/.test(link.url);
    if (!valid || kept[i]!.url === "") {
      return {error: `Link ${i + 1} isn't a web address, like https://hunt.example.`} as const;
    }
  }
  return {links: result} as const;
}

/**
 * Saves a settings change and waits for the server: true once saved (and says so). On failure the
 * mutation has already shown the error, and the form keeps what was typed.
 */
async function save(
  mutation: ReturnType<typeof useWorkspaceUpdate>,
  input: Parameters<ReturnType<typeof useWorkspaceUpdate>["mutateAsync"]>[0]
) {
  try {
    await mutation.mutateAsync(input);
  } catch {
    return false;
  }
  toast.success("Your changes have been saved.");
  return true;
}

const useWorkspaceUpdate = () => useMutation(workspaceMutations.workspaces.update());

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const isOwner = useIsWorkspaceOwner();
  const isReadOnly = useIsReadOnly();
  return (
    <>
      {/* Archived: nobody can change anything, so there's no owners-only split to explain. */}
      {!isOwner && !isReadOnly && (
        <Alert>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Only owners can change the details and look</Alert.Title>
            <Alert.Description>
              Anyone can add custom emoji, links and tags below. Ask an owner (see Members) if
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
    </>
  );
}

function UpdateLinksCard() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  // Archived: the links are shown as they are, with nothing to add, remove or save.
  const isReadOnly = useIsReadOnly();
  const mutation = useWorkspaceUpdate();
  const form = useAppForm({
    defaultValues: {links: workspace.links.map(({name, url}) => ({name, url})) ?? []},
    onSubmit: async ({value}) => {
      const checked = linksToSave(value.links);
      if ("error" in checked) {
        toast.error(checked.error);
        return;
      }
      // Only once it's saved: if it isn't (the error is shown), what was typed stays to fix.
      if (!(await save(mutation, {workspaceSlug, links: checked.links}))) return;
      // Untouched again, the form follows the workspace (now showing this change) from here on.
      form.reset({links: checked.links});
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
                            readOnly={isReadOnly}
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
                            readOnly={isReadOnly}
                            aria-label={`Link ${i + 1} URL`}
                            placeholder="URL"
                            className="min-w-0 flex-1"
                          />
                        )}
                      />
                      {!isReadOnly && (
                        <InputGroup.Suffix className="pe-0">
                          <IconButton
                            variant="secondary"
                            size="sm"
                            label="Remove link"
                            onPress={() => field.removeValue(i)}>
                            <TrashIcon />
                          </IconButton>
                        </InputGroup.Suffix>
                      )}
                    </InputGroup>
                  ))}
                  {isReadOnly ? (
                    field.state.value.length === 0 && (
                      <p className="text-muted text-sm">No links.</p>
                    )
                  ) : (
                    <Button
                      className="w-fit"
                      type="button"
                      variant="ghost"
                      onPress={() => field.pushValue({name: "", url: ""})}>
                      <PlusIcon />
                      Add link
                    </Button>
                  )}
                </div>
              )}
            </form.Field>
          </form.Form>
        </Card.Content>
        {!isReadOnly && (
          <Card.Footer>
            <form.SubmitButton savesChanges>Save</form.SubmitButton>
          </Card.Footer>
        )}
      </form.AppForm>
    </Card>
  );
}

/** The link the hunt website is kept as (see `huntWebsiteLink`). */
const HUNT_WEBSITE = "Hunt website";

function DetailsCard() {
  const {suggestions: huntSuggestions, byId: huntsById} = useHuntSuggestions();
  const {workspaceSlug} = Route.useParams();
  const isOwner = useIsWorkspaceOwner();
  const isReadOnly = useIsReadOnly();
  // Owners can change the details, unless the workspace is archived.
  const canEdit = isOwner && !isReadOnly;
  const workspace = useWorkspace();
  const mutation = useWorkspaceUpdate();
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
    onSubmit: async ({value}) => {
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
      const saved = await save(mutation, {
        workspaceSlug,
        ...details,
        teamName: details.teamName?.trim(),
        eventName: details.eventName?.trim(),
        huntStartsAt,
        huntEndsAt,
        ...(linksChanged ? {links} : {}),
      });
      if (!saved) return;
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
              validators={{onSubmit: NAME_SCHEMA("team")}}
              children={field => (
                <field.TextField variant="secondary" label="Team name" isDisabled={!canEdit} />
              )}
            />
            <form.AppField
              name="eventName"
              validators={{onSubmit: NAME_SCHEMA("event")}}
              children={field => (
                <field.SuggestField
                  variant="secondary"
                  label="Event name"
                  isDisabled={!canEdit}
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
                    isDisabled={!canEdit}
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
                    isDisabled={!canEdit}
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
                  isDisabled={!canEdit}
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
                  isDisabled={!canEdit}
                />
              )}
            />
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

function UpdateTagsCard() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  // Archived: the tags are shown as they are, with nothing to add, remove or save.
  const isReadOnly = useIsReadOnly();
  const mutation = useWorkspaceUpdate();
  const form = useAppForm({
    defaultValues: {tags: workspace.tags},
    onSubmit: async ({value}) => {
      // Blank rows (an "Add tag" left empty) aren't tags.
      const tags = value.tags.map(tag => tag.trim()).filter(tag => tag !== "");
      if (!(await save(mutation, {workspaceSlug, tags}))) return;
      // Untouched again, the form follows the workspace (now showing this change) from here on.
      form.reset({tags});
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
                            readOnly={isReadOnly}
                            aria-label={`Tag ${i + 1}`}
                          />
                        )}
                      />
                      {!isReadOnly && (
                        <InputGroup.Suffix className="pe-0">
                          <IconButton
                            variant="secondary"
                            size="sm"
                            label="Remove tag"
                            onPress={() => field.removeValue(i)}>
                            <TrashIcon />
                          </IconButton>
                        </InputGroup.Suffix>
                      )}
                    </InputGroup>
                  ))}
                  {isReadOnly ? (
                    field.state.value.length === 0 && <p className="text-muted text-sm">No tags.</p>
                  ) : (
                    <Button
                      className="w-fit"
                      type="button"
                      variant="ghost"
                      onPress={() => field.pushValue("")}>
                      <PlusIcon />
                      Add tag
                    </Button>
                  )}
                </div>
              )}
            </form.Field>
          </form.Form>
        </Card.Content>
        {!isReadOnly && (
          <Card.Footer>
            <form.SubmitButton savesChanges>Save</form.SubmitButton>
          </Card.Footer>
        )}
      </form.AppForm>
    </Card>
  );
}
