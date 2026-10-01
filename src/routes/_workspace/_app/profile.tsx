import {buttonVariants, Card, Label, linkVariants} from "@heroui/react";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
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
    <div className="flex w-full flex-1 items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-2">
          <div>
            <Link to="/workspaces" className={buttonVariants({variant: "outline", size: "sm"})}>
              <ArrowLeftIcon /> Back
            </Link>
          </div>
          <Card>
            <Card.Header>
              <Card.Title>Profile</Card.Title>
              <Card.Description>
                Update your profile information. You may need to logout and log back in to see some
                changes.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <form.AppForm>
                <form.Form>
                  <form.AppField name="email">
                    {field => (
                      <field.TextField variant="secondary" label="Email" autoComplete="email" />
                    )}
                  </form.AppField>
                  <form.AppField name="name">
                    {field => (
                      <field.TextField variant="secondary" label="Name" autoComplete="name" />
                    )}
                  </form.AppField>
                  <div className="flex w-full flex-col gap-1">
                    <Label>Profile picture</Label>
                    <div className="flex items-center gap-4">
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
                          className={linkVariants().base()}>
                          Gravatar
                        </a>
                        .
                      </div>
                    </div>
                  </div>
                  <form.SubmitButton fullWidth>Save</form.SubmitButton>
                </form.Form>
              </form.AppForm>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
