import {buttonVariants, Card} from "@heroui/react";
import {useQueryClient} from "@tanstack/react-query";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";
import {toast} from "sonner";
import {z} from "zod";

import {useAppForm} from "@/components/form";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_workspace/_app/workspaces/create/")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Create Workspace | WOW"}]}),
});

const reservedSlugs = new Set(["exchange"]);

function RouteComponent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useAppForm({
    defaultValues: {teamName: "", eventName: "", workspaceSlug: "", password: ""},
    onSubmit: async ({value}) => {
      if (!(await authClient.organization.checkSlug({slug: value.workspaceSlug})).data) {
        toast.error("Workspace ID is already taken. Please choose another one.");
        return;
      }
      if (reservedSlugs.has(value.workspaceSlug.toLowerCase())) {
        toast.error(
          `Workspace ID cannot be ${value.workspaceSlug.toLowerCase()}. Please choose another one.`
        );
        return;
      }
      toast.promise(
        authClient.organization.create(
          {
            name: `${value.teamName} - ${value.eventName}`,
            slug: value.workspaceSlug,
            teamName: value.teamName,
            eventName: value.eventName,
            password: value.password,
          },
          {
            throw: true,
            onSuccess: () => {
              void queryClient.invalidateQueries();
              form.reset();
              void router.navigate({
                to: "/workspaces/create/$workspaceSlug",
                params: {workspaceSlug: value.workspaceSlug},
              });
            },
          }
        ),
        {
          loading: "Creating workspace...",
          success: "Success! Your workspace has been created.",
          error: "Oops! Something went wrong.",
          description: `${value.teamName} · ${value.eventName}`,
        }
      );
    },
  });

  return (
    <div className="flex w-full justify-center">
      <div className="flex max-w-3xl flex-1 flex-col items-stretch gap-4">
        <div>
          <Link to="/workspaces" className={buttonVariants({variant: "ghost", size: "sm"})}>
            <ArrowLeftIcon /> Back
          </Link>
        </div>
        <form.AppForm>
          <Card>
            <Card.Header>
              <Card.Title>Create workspace</Card.Title>
              <Card.Description>
                You need to provide a team name and an event name to create your workspace. You also
                need to provide a password that other users can use to join your workspace.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <form.Form>
                <form.AppField
                  name="teamName"
                  validators={{onBlur: z.string().min(1)}}
                  children={field => <field.TextField variant="secondary" label="Team name" />}
                />
                <form.AppField
                  name="eventName"
                  children={field => <field.TextField variant="secondary" label="Event name" />}
                />
                <form.AppField
                  name="workspaceSlug"
                  children={field => (
                    <field.TextField
                      variant="secondary"
                      label="Workspace ID"
                      description="This is the ID that will be used to identify your workspace and will be used by other users to join your workspace. (E.g. myteam2025)"
                    />
                  )}
                />
                <form.AppField
                  name="password"
                  children={field => (
                    <field.TextField variant="secondary" label="Workspace password" />
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
    </div>
  );
}
