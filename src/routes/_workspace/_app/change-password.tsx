import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {FieldGroup} from "@/components/ui/field";
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
    </div>
  );
}
