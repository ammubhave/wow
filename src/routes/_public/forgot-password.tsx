import {Turnstile, TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, Link, redirect, useRouter} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";
import {useRef} from "react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {useTheme} from "@/components/theme-provider";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldGroup} from "@/components/ui/field";
import {authClient} from "@/lib/auth-client";
import {getSession} from "@/lib/auth-server";

export const Route = createFileRoute("/_public/forgot-password")({
  component: RouteComponent,
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
          headers: {"x-captcha-response": value.token},
          onSuccess: async () => {
            await router.navigate({to: "/forgot-password-check-email"});
          },
          onError: async error => {
            toast.error(error.error.message);
          },
        },
      });
    },
  });
  const {theme} = useTheme();
  const turnstileRef = useRef<TurnstileInstance>(null);
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
                <Link to="/login">
                  <ArrowLeftIcon /> Back
                </Link>
              }
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Forgot password?</CardTitle>
              <CardDescription>Enter your email below to send reset instructions</CardDescription>
            </CardHeader>
            <CardContent>
              <form.AppForm>
                <form.Form>
                  <FieldGroup>
                    <form.AppField name="email">
                      {field => <field.TextField label="Email" autoComplete="email" />}
                    </form.AppField>
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY}
                      options={{theme: theme === "system" ? "auto" : theme, size: "flexible"}}
                      onSuccess={token => form.setFieldValue("token", token)}
                    />
                    <Field>
                      <form.SubmitButton>Reset password</form.SubmitButton>
                    </Field>
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
