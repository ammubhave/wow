import {Card} from "@heroui/react";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_workspace/_app/change-password")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Change Password | WOW"}]}),
});

function RouteComponent() {
  const router = useRouter();
  const form = useAppForm({
    defaultValues: {currentPassword: "", newPassword: ""},
    onSubmit: async ({value}) => {
      await authClient.changePassword(
        {currentPassword: value.currentPassword, newPassword: value.newPassword},
        {
          onSuccess: async () => {
            toast.success("Password changed successfully");
            await router.navigate({to: "/workspaces"});
          },
          onError: error => {
            toast.error(error.error.message);
          },
        }
      );
    },
  });
  return (
    <div className="flex w-full flex-1 items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-2">
          <div>
            <Link to="/workspaces" className="button button--outline button--sm gap-2">
              <ArrowLeftIcon /> Back
            </Link>
          </div>
          <Card>
            <Card.Header>
              <Card.Title>Change password</Card.Title>
              <Card.Description>Set a new password for your account.</Card.Description>
            </Card.Header>
            <Card.Content>
              <form.AppForm>
                <form.Form>
                  <div className="flex w-full flex-col gap-4">
                    <form.AppField name="currentPassword">
                      {field => (
                        <field.TextField
                          label="Current Password"
                          type="password"
                          autoComplete="current-password"
                        />
                      )}
                    </form.AppField>
                    <form.AppField name="newPassword">
                      {field => (
                        <field.TextField
                          label="New Password"
                          type="password"
                          autoComplete="new-password"
                        />
                      )}
                    </form.AppField>
                    <div className="flex w-full flex-col gap-4">
                      <form.SubmitButton>Change password</form.SubmitButton>
                    </div>
                  </div>
                </form.Form>
              </form.AppForm>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
