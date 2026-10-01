import {Card} from "@heroui/react";
import {createFileRoute, useRouter} from "@tanstack/react-router";
import {toast} from "sonner";
import {z} from "zod";

import {useAppForm} from "@/components/form";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_public/reset-password")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Reset Password | WOW"}]}),
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
    <div className="flex w-full flex-1 items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <Card.Header>
            <Card.Title>Set new password</Card.Title>
            <Card.Description>
              Enter your new password below to reset your account password
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <form.AppForm>
              <form.Form>
                <div className="flex w-full flex-col gap-4">
                  <form.AppField name="password">
                    {field => (
                      <field.TextField
                        label="Password"
                        type="password"
                        autoComplete="new-password"
                      />
                    )}
                  </form.AppField>
                  <div className="flex w-full flex-col gap-4">
                    <div className="flex w-full flex-col gap-2">
                      <form.SubmitButton>Reset password</form.SubmitButton>
                    </div>
                  </div>
                </div>
              </form.Form>
            </form.AppForm>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
