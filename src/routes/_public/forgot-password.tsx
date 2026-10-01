import {buttonVariants, Card} from "@heroui/react";
import type {TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, Link, redirect, useRouter} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";
import {useRef} from "react";
import {toast} from "sonner";

import {Captcha, captchaHeaders} from "@/components/captcha";
import {useAppForm} from "@/components/form";
import {authClient} from "@/lib/auth-client";
import {getSession} from "@/lib/auth-server";

export const Route = createFileRoute("/_public/forgot-password")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Forgot Password | WOW"}]}),
  loader: async () => {
    const session = await getSession();
    if (session) throw redirect({to: "/workspaces"});
  },
});

function RouteComponent() {
  const router = useRouter();
  const form = useAppForm({
    defaultValues: {email: "", token: ""},
    onSubmit: async ({value}) => {
      await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: "/reset-password",
        fetchOptions: {
          headers: captchaHeaders(value.token),
          onSuccess: async () => {
            await router.navigate({to: "/forgot-password-check-email"});
          },
          onError: async error => {
            turnstileRef.current?.reset();
            toast.error(error.error.message);
          },
        },
      });
    },
  });
  const turnstileRef = useRef<TurnstileInstance>(null);
  return (
    <div className="flex w-full flex-1 items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-2">
          <div>
            <Link to="/login" className={buttonVariants({variant: "outline", size: "sm"})}>
              <ArrowLeftIcon aria-hidden="true" /> Back
            </Link>
          </div>
          <Card>
            <Card.Header>
              <Card.Title>Forgot password?</Card.Title>
              <Card.Description>Enter your email below to send reset instructions</Card.Description>
            </Card.Header>
            <Card.Content>
              <form.AppForm>
                <form.Form>
                  <form.AppField name="email">
                    {field => (
                      <field.TextField variant="secondary" label="Email" autoComplete="email" />
                    )}
                  </form.AppField>
                  <Captcha
                    ref={turnstileRef}
                    onToken={token => form.setFieldValue("token", token)}
                  />
                  <form.SubmitButton fullWidth>Reset password</form.SubmitButton>
                </form.Form>
              </form.AppForm>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
