import {Card} from "@heroui/react";
import {useQueryClient} from "@tanstack/react-query";
import {createFileRoute, useRouter} from "@tanstack/react-router";
import {useEffect, useRef} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";
import {z} from "zod";

import {useAppForm} from "@/components/form";
import {Page, READING_WIDTH} from "@/components/page";
import {CreateWorkspaceSkeleton} from "@/components/page-skeletons";
import {
  huntDetails,
  huntWebsiteLink,
  type Listing,
  useHuntSuggestions,
} from "@/hooks/use-hunt-suggestions";
import {authClient} from "@/lib/auth-client";
import {fromLocalInput} from "@/lib/datetime-local";
import {errorMessage} from "@/lib/errors";
import {orpc} from "@/lib/orpc";
import {workspaceSlugProblem} from "@/lib/workspace-slug";

/** A hunt website: empty, or a web address (https:// is added for you). */
const HUNT_WEBSITE_SCHEMA = z.union([
  z.literal(""),
  z.url({protocol: /^https?$/, error: "Enter a web address, like https://hunt.example"}),
]);

const TEAM_NAME_SCHEMA = z.string().trim().min(1, "Enter your team's name.");

export const Route = createFileRoute("/_workspace/_app/workspaces/create/")({
  component: RouteComponent,
  pendingComponent: CreateWorkspaceSkeleton,
  // From a hunt shortcut (My workspaces): the hunt listing, and its name to start the form with.
  validateSearch: z.object({hunt: z.string().optional(), event: z.string().optional()}),
  head: () => ({meta: [{title: "Create workspace | WOW"}]}),
});

/** "The Night Owls" → "the-night-owls": the shape of a workspace ID. */
const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function RouteComponent() {
  const creating = useRef(false);
  const {suggestions: huntSuggestions, byId: huntsById} = useHuntSuggestions();
  const search = Route.useSearch();
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useAppForm({
    defaultValues: {
      teamName: "",
      eventName: search.event ?? "",
      huntStartsAt: "",
      huntEndsAt: "",
      huntLocation: "",
      huntWebsite: "",
      workspaceSlug: "",
      password: "",
    },
    onSubmit: async ({value}) => {
      // (The fields' validators checked the dates and the workspace ID.)
      const huntStartsAt = fromLocalInput(value.huntStartsAt);
      const huntEndsAt = fromLocalInput(value.huntEndsAt);
      const huntUrl = value.huntWebsite.trim();
      // Awaited, so the form counts as submitting (Create is disabled) until it's done, and a
      // second click or Enter while it's working does nothing.
      if (creating.current) return;
      creating.current = true;
      const description = `${value.teamName} · ${value.eventName}`;
      const toastId = toast.loading("Creating workspace…", {description});
      try {
        await authClient.organization.create(
          {
            name: `${value.teamName} - ${value.eventName}`,
            slug: value.workspaceSlug,
            teamName: value.teamName,
            eventName: value.eventName,
            password: value.password,
            ...(value.huntLocation.trim() ? {huntLocation: value.huntLocation.trim()} : {}),
            ...(huntUrl ? {links: [huntWebsiteLink(huntUrl)]} : {}),
          },
          {throw: true}
        );
      } catch (error) {
        creating.current = false;
        toast.error(errorMessage(error, "Couldn't create the workspace. Please try again."), {
          id: toastId,
          description,
        });
        return;
      }
      // It exists from here on: a problem with the dates is reported as just that.
      let datesSaved = true;
      // Dates go separately: the sign-in library's create takes no dates over JSON.
      if (huntStartsAt !== null || huntEndsAt !== null) {
        try {
          await orpc.workspaces.update.call({
            workspaceSlug: value.workspaceSlug,
            huntStartsAt,
            huntEndsAt,
          });
        } catch {
          datesSaved = false;
        }
      }
      if (datesSaved) {
        toast.success("Workspace created", {id: toastId, description});
      } else {
        toast.warning("Workspace created, but its hunt dates weren't saved", {
          id: toastId,
          description: "Add them in the workspace's Settings.",
        });
      }
      void queryClient.invalidateQueries();
      form.reset();
      creating.current = false;
      await router.navigate({
        to: "/workspaces/create/$workspaceSlug",
        params: {workspaceSlug: value.workspaceSlug},
      });
    },
  });

  const applyHunt = (listing: Listing) => {
    const details = huntDetails(listing);
    form.setFieldValue("huntStartsAt", details.huntStartsAt);
    form.setFieldValue("huntEndsAt", details.huntEndsAt);
    form.setFieldValue("huntLocation", details.huntLocation);
    form.setFieldValue("huntWebsite", listing.url ?? "");
  };
  /** A hunt was picked: fill in its dates and place (still editable). */
  const fillFrom = (id: string | null) => {
    const listing = id ? huntsById.get(id) : undefined;
    if (!listing) return;
    applyHunt(listing);
  };
  // From a hunt shortcut: fill them in once the hunts have loaded.
  const shortcutHunt = search.hunt ? huntsById.get(search.hunt) : undefined;
  useEffect(() => {
    if (!shortcutHunt || form.getFieldValue("huntStartsAt")) return;
    applyHunt(shortcutHunt);
    // Once, when that hunt arrives.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcutHunt?.id]);

  // A workspace ID suggested from the team name, until someone types their own.
  const idEdited = useRef(false);
  function suggestId() {
    if (idEdited.current) return;
    const id = slugify(form.getFieldValue("teamName")).slice(0, 40).replace(/-$/, "");
    form.setFieldValue("workspaceSlug", id);
  }

  return (
    <Page title="Create workspace">
      <div className={cn(READING_WIDTH, "flex flex-col gap-4")}>
        <form.AppForm>
          <Card>
            <Card.Header>
              <Card.Description>
                Your team, and the hunt you're playing. Once it's made, invite teammates by email,
                or share the invitation link and password.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <form.Form>
                <form.AppField
                  name="teamName"
                  validators={{onBlur: TEAM_NAME_SCHEMA, onSubmit: TEAM_NAME_SCHEMA}}
                  listeners={{onChange: suggestId}}
                  children={field => (
                    <field.TextField variant="secondary" label="Team name" isRequired />
                  )}
                />
                <form.AppField
                  name="eventName"
                  validators={{
                    onSubmit: z.string().trim().min(1, "Enter the hunt's name, or pick one."),
                  }}
                  children={field => (
                    <field.SuggestField
                      variant="secondary"
                      label="Event name"
                      isRequired
                      placeholder="e.g. MIT Mystery Hunt 2027"
                      description="Start typing to pick an upcoming hunt (it fills in the rest of the hunt details), or enter any name."
                      suggestions={huntSuggestions}
                      onPick={fillFrom}
                    />
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <form.AppField
                    name="huntStartsAt"
                    children={field => (
                      <field.TextField variant="secondary" label="Starts" type="datetime-local" />
                    )}
                  />
                  <form.AppField
                    name="huntEndsAt"
                    validators={{
                      onSubmit: ({value, fieldApi}) => {
                        const starts = fromLocalInput(fieldApi.form.getFieldValue("huntStartsAt"));
                        const ends = fromLocalInput(value);
                        return starts && ends && ends <= starts
                          ? {message: "The hunt has to end after it starts."}
                          : undefined;
                      },
                    }}
                    children={field => (
                      <field.TextField variant="secondary" label="Ends" type="datetime-local" />
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
                      description="Linked from the workspace's header."
                    />
                  )}
                />
                <form.AppField
                  name="workspaceSlug"
                  validators={{
                    onSubmit: ({value}) => {
                      const problem = workspaceSlugProblem(value);
                      return problem ? {message: problem} : undefined;
                    },
                    onSubmitAsync: async ({value}) =>
                      (await authClient.organization.checkSlug({slug: value})).data
                        ? undefined
                        : {message: "That ID is taken. Choose another one."},
                  }}
                  listeners={{
                    onChange: () => {
                      idEdited.current = true;
                    },
                  }}
                  children={field => (
                    <field.TextField
                      variant="secondary"
                      label="Workspace ID"
                      isRequired
                      placeholder="e.g. myteam2027"
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      description="Its web address (www.wafflehaus.io/…) and how teammates find it. Suggested from your team's name; change it if you like."
                    />
                  )}
                />
                <form.AppField
                  name="password"
                  // The same rule as changing it later (Settings › Administration).
                  validators={{onSubmit: z.string().min(8, "Use at least 8 characters.")}}
                  children={field => (
                    <field.PasswordField
                      variant="secondary"
                      label="Workspace password"
                      isRequired
                      description="At least 8 characters. Teammates enter it to join."
                    />
                  )}
                />
              </form.Form>
            </Card.Content>
            <Card.Footer className="mt-4">
              <form.SubmitButton>Create</form.SubmitButton>
            </Card.Footer>
          </Card>
        </form.AppForm>
      </div>
    </Page>
  );
}
