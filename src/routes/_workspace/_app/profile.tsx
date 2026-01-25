import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldGroup, FieldLabel} from "@/components/ui/field";
import {gravatarUrl} from "@/components/user-hover-card";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_workspace/_app/profile")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Profile | WOW"}]}),
});

function RouteComponent() {
  const {data: user} = authClient.useSession();
  return user ? <ProfileCard user={user.user} /> : null;
}

function ProfileCard({
  user,
}: {
  user: NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"];
}) {
  const router = useRouter();
  const form = useAppForm({
    defaultValues: {name: user.name, email: user.email},
    onSubmit: async ({value}) => {
      if (user.name !== value.name) {
        await authClient.updateUser(
          {name: value.name},
          {
            onSuccess: async () => {
              toast.success("User updated successfully");
              await router.navigate({to: "/workspaces"});
            },
            onError: error => {
              toast.error(error.error.message);
            },
          }
        );
      }
      if (user.email !== value.email) {
        await authClient.changeEmail(
          {newEmail: value.email, callbackURL: "/profile"},
          {
            onSuccess: () => {
              toast.success(
                "Email change requested. Please check your new email to confirm the change."
              );
            },
            onError: error => {
              toast.error(error.error.message);
            },
          }
        );
      }
    },
  });
  return (
    <div className="flex flex-1 w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-2">
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
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Update your profile information. You may need to logout and log back in to see some
                changes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.AppForm>
                <form.Form>
                  <FieldGroup>
                    <form.AppField name="email">
                      {field => <field.TextField label="Email" autoComplete="email" />}
                    </form.AppField>
                    <form.AppField name="name">
                      {field => <field.TextField label="Name" autoComplete="name" />}
                    </form.AppField>
                    <Field>
                      <FieldLabel>Profile picture</FieldLabel>
                      <div className="flex gap-4 items-center">
                        <img
                          src={user.image ?? gravatarUrl(user.email, {size: 96, d: "identicon"})}
                          alt="User Avatar"
                          className="size-10 rounded-full"
                        />
                        <div>
                          To update your profile picture,
                          <br />
                          please visit{" "}
                          <a
                            href="https://gravatar.com/profile"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline">
                            Gravatar
                          </a>
                          .
                        </div>
                      </div>
                    </Field>
                    <FieldGroup>
                      <form.SubmitButton>Save</form.SubmitButton>
                    </FieldGroup>
                  </FieldGroup>
                </form.Form>
              </form.AppForm>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
