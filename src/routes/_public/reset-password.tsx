import {Card} from "@heroui/react";
import {createFileRoute, useRouter} from "@tanstack/react-router";
import {useState} from "react";
import {toast} from "sonner";
import {z} from "zod";

import {AuthLayout, FormError} from "@/components/auth-layout";
import {useAppForm} from "@/components/form";
import {authClient} from "@/lib/auth-client";
import {authErrorMessage} from "@/lib/auth-helpers";

export const Route = createFileRoute("/_public/reset-password")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Reset password | WOW"}]}),
  validateSearch: z.object({token: z.string()}),
});

function RouteComponent() {
  const router = useRouter();
  const {token} = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: {password: ""},
    onSubmit: async ({value}) => {
      setError(null);
      await authClient.resetPassword(
        {newPassword: value.password, token},
        {
          onSuccess: async () => {
            toast.success("Password updated. Log in with your new password.");
            await router.navigate({to: "/login"});
          },
          onError: context => {
            setError(
              authErrorMessage(
                context.error,
                "Couldn't reset your password. The link may have expired."
              )
            );
          },
        }
      );
    },
  });
  return (
    <AuthLayout>
      <Card>
        <Card.Header>
          <Card.Title className="text-lg font-semibold">Set a new password</Card.Title>
          <Card.Description>Choose a new password for your account.</Card.Description>
        </Card.Header>
        <Card.Content>
          <form.AppForm>
            <form.Form onChange={() => setError(null)}>
              <form.AppField name="password">
                {field => (
                  <field.PasswordField
                    variant="secondary"
                    label="New password"
                    autoComplete="new-password"
                    autoFocus
                  />
                )}
              </form.AppField>
              <FormError error={error} />
            </form.Form>
          </form.AppForm>
        </Card.Content>
        <Card.Footer className="mt-4">
          <form.AppForm>
            <form.SubmitButton fullWidth>Update password</form.SubmitButton>
          </form.AppForm>
        </Card.Footer>
      </Card>
    </AuthLayout>
  );
}
