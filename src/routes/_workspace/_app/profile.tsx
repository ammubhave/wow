import {Avatar, buttonVariants, Card, Label, Link} from "@heroui/react";
import {createFileRoute, Link as RouterLink} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";
import {toast} from "sonner";

import {DangerZoneCard, SessionsCard, SignInMethodsCard} from "@/components/account-settings";
import {useAppForm} from "@/components/form";
import {PasskeysCard} from "@/components/passkeys-card";
import {userAvatarSrc, userInitials} from "@/components/user-hover-card";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_workspace/_app/profile")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Account | WOW"}]}),
});

function RouteComponent() {
  const {data} = authClient.useSession();
  if (!data) return null;
  return (
    <div className="flex w-full flex-1 justify-center">
      <div className="flex w-full max-w-xl flex-col gap-4">
        <div>
          <RouterLink to="/workspaces" className={buttonVariants({variant: "ghost", size: "sm"})}>
            <ArrowLeftIcon /> Back
          </RouterLink>
        </div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <ProfileCard user={data.user} />
        <SignInMethodsCard email={data.user.email} />
        <PasskeysCard />
        <SessionsCard currentToken={data.session.token} />
        <DangerZoneCard />
      </div>
    </div>
  );
}

function ProfileCard({
  user,
}: {
  user: NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"];
}) {
  const form = useAppForm({
    defaultValues: {name: user.name, email: user.email},
    onSubmit: async ({value}) => {
      if (user.name !== value.name) {
        await authClient.updateUser(
          {name: value.name},
          {
            onSuccess: async () => {
              toast.success("Profile saved");
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
    <Card>
      <Card.Header>
        <Card.Title>Profile</Card.Title>
        <Card.Description>How you appear to your teammates.</Card.Description>
      </Card.Header>
      <Card.Content>
        <form.AppForm>
          <form.Form>
            <form.AppField name="email">
              {field => <field.TextField variant="secondary" label="Email" autoComplete="email" />}
            </form.AppField>
            <form.AppField name="name">
              {field => <field.TextField variant="secondary" label="Name" autoComplete="name" />}
            </form.AppField>
            <div className="flex w-full flex-col gap-1">
              <Label>Profile picture</Label>
              <div className="flex items-center gap-4">
                <Avatar>
                  <Avatar.Image src={userAvatarSrc(user)} alt="User Avatar" />
                  <Avatar.Fallback>{userInitials(user.name)}</Avatar.Fallback>
                </Avatar>
                <p className="text-muted text-sm">
                  To update your profile picture, visit{" "}
                  <Link
                    href="https://gravatar.com/profile"
                    target="_blank"
                    rel="noopener noreferrer">
                    Gravatar
                  </Link>
                  .
                </p>
              </div>
            </div>
          </form.Form>
        </form.AppForm>
      </Card.Content>
      <Card.Footer className="mt-4">
        <form.AppForm>
          <form.SubmitButton>Save</form.SubmitButton>
        </form.AppForm>
      </Card.Footer>
    </Card>
  );
}
