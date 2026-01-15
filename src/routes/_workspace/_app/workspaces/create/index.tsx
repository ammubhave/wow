import {useQueryClient} from "@tanstack/react-query";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";
import {toast} from "sonner";
import z from "zod";

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
import {FieldGroup} from "@/components/ui/field";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_workspace/_app/workspaces/create/")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Create Workspace | WOW"}]}),
});

function RouteComponent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useAppForm({
    defaultValues: {teamName: "", eventName: "", workspaceId: "", password: ""},
    onSubmit: ({value}) => {
      toast.promise(
        authClient.organization.create(
          {
            name: `${value.teamName} - ${value.eventName}`,
            slug: value.workspaceId,
            teamName: value.teamName,
            eventName: value.eventName,
            password: value.password,
          },
          {
            throw: true,
            onSuccess: ({data}) => {
              console.log("Created", data);
              void queryClient.invalidateQueries();
              form.reset();
              void router.navigate({
                to: "/workspaces/create/$workspaceId",
                params: {workspaceId: value.workspaceId},
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
    <div className="flex justify-center w-full">
      <div className="max-w-3xl flex-1 flex flex-col items-stretch gap-2">
        <div>
          <Button
            variant="outline"
            size="sm"
            aria-label="Go Back"
            render={
              <Link to="/workspaces">
                <ArrowLeftIcon /> Back
              </Link>
            }
          />
        </div>
        <form.AppForm>
          <Card>
            <CardHeader>
              <CardTitle>Create workspace</CardTitle>
              <CardDescription>
                You need to provide a team name and an event name to create your workspace. You also
                need to provide a password that other users can use to join your workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.Form>
                <FieldGroup>
                  <form.AppField
                    name="teamName"
                    validators={{onBlur: z.string().min(1)}}
                    children={field => <field.TextField label="Team Name" />}
                  />
                  <form.AppField
                    name="eventName"
                    children={field => <field.TextField label="Event Name" />}
                  />
                  <form.AppField
                    name="workspaceId"
                    children={field => (
                      <field.TextField
                        label="Workspace ID"
                        description="This is the ID that will be used to identify your workspace and will be used by other users to join your workspace. (E.g. myteam2025)"
                      />
                    )}
                  />
                  <form.AppField
                    name="password"
                    children={field => <field.TextField label="Workspace Password" />}
                  />
                </FieldGroup>
              </form.Form>
            </CardContent>
            <CardFooter>
              <form.SubmitButton>Create</form.SubmitButton>
            </CardFooter>
          </Card>
        </form.AppForm>
      </div>
    </div>
  );
}
