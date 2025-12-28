import {createFileRoute, useRouter} from "@tanstack/react-router";
import {toast} from "sonner";
import z from "zod";

import {useAppForm} from "@/components/form";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldGroup} from "@/components/ui/field";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_public/reset-password")({
  component: RouteComponent,
  validateSearch: z.object({token: z.string()}),
});

function RouteComponent() {
  const router = useRouter();
  const {token} = Route.useSearch();
  const form = useAppForm({
    defaultValues: {password: ""},
    onSubmit: async ({value}) =>
      await authClient.resetPassword(
        {newPassword: value.password, token},
        {
          onSuccess: async () => {
            toast.success("Password reset successfully");
            await router.navigate({to: "/login"});
          },
          onError: error => {
            toast.error(error.error.message);
          },
        }
      ),
  });
  return (
    <div className="flex flex-1 w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Set new password</CardTitle>
            <CardDescription>
              Enter your new password below to reset your account password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form.AppForm>
              <form.Form>
                <FieldGroup>
                  <form.AppField name="password">
                    {field => (
                      <field.TextField
                        label="Password"
                        type="password"
                        autoComplete="new-password"
                      />
                    )}
                  </form.AppField>
                  <FieldGroup>
                    <Field>
                      <form.SubmitButton>Reset password</form.SubmitButton>
                    </Field>
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
