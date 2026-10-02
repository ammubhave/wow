import {Card} from "@heroui/react";
import type {TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, redirect, useRouter} from "@tanstack/react-router";
import {useRef, useState} from "react";

import {AuthLayout, BackToLogin, FormError} from "@/components/auth-layout";
import {Captcha, captchaHeaders} from "@/components/captcha";
import {useAppForm} from "@/components/form";
import {authClient} from "@/lib/auth-client";
import {authErrorMessage} from "@/lib/auth-helpers";
import {getSession} from "@/lib/auth-server";

export const Route = createFileRoute("/_public/forgot-password")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Forgot password | WOW"}]}),
  loader: async () => {
    const session = await getSession();
    if (session) throw redirect({to: "/workspaces"});
  },
});

function RouteComponent() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const form = useAppForm({
    defaultValues: {email: "", token: ""},
    onSubmit: async ({value}) => {
      setError(null);
      await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: "/reset-password",
        fetchOptions: {
          headers: captchaHeaders(value.token),
          onSuccess: async () => {
            await router.navigate({to: "/forgot-password-check-email"});
          },
          onError: context => {
            turnstileRef.current?.reset();
            setError(
              authErrorMessage(context.error, "Couldn't send the reset email. Please try again.")
            );
          },
        },
      });
    },
  });
  return (
    <AuthLayout>
      <BackToLogin />
      <Card>
        <Card.Header>
          <Card.Title className="text-lg font-semibold">Forgot your password?</Card.Title>
          <Card.Description>
            Enter your email and we'll send you a link to set a new one.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <form.AppForm>
            <form.Form onChange={() => setError(null)}>
              <form.AppField name="email">
                {field => (
                  <field.TextField
                    variant="secondary"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                  />
                )}
              </form.AppField>
              <Captcha ref={turnstileRef} onToken={token => form.setFieldValue("token", token)} />
              <FormError error={error} />
            </form.Form>
          </form.AppForm>
        </Card.Content>
        <Card.Footer className="mt-4">
          <form.AppForm>
            <form.SubmitButton fullWidth>Send reset link</form.SubmitButton>
          </form.AppForm>
        </Card.Footer>
      </Card>
    </AuthLayout>
  );
}
