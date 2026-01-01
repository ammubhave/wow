import {createFileRoute, useRouter} from "@tanstack/react-router";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {FieldGroup} from "@/components/ui/field";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_app/change-password")({component: RouteComponent});

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
    <div className="flex flex-1 w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Set a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form.AppForm>
              <form.Form>
                <FieldGroup>
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
                  <FieldGroup>
                    <form.SubmitButton>Change password</form.SubmitButton>
                  </FieldGroup>
                </FieldGroup>
              </form.Form>
            </form.AppForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
