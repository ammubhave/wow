import {Turnstile, TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, Link, redirect, useRouter} from "@tanstack/react-router";
import {useRef} from "react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {useTheme} from "@/components/theme-provider";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldDescription, FieldGroup} from "@/components/ui/field";
import {authClient} from "@/lib/auth-client";
import {getSession} from "@/lib/auth-server";

export const Route = createFileRoute("/_public/signup")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Sign Up | WOW"}]}),
  loader: async () => {
    const session = await getSession();
    if (session) throw redirect({to: "/workspaces"});
  },
});

function RouteComponent() {
  const router = useRouter();
  const form = useAppForm({
    defaultValues: {name: "", email: "", username: "", password: "", token: ""},
    onSubmit: async ({value}) =>
      await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
        notificationsDisabled: false,
        fetchOptions: {
          headers: {"x-captcha-response": value.token},
          onSuccess: async () => {
            await router.navigate({to: "/login"});
          },
          onError: error => {
            turnstileRef.current?.reset();
            toast.error(error.error.message);
          },
        },
      }),
  });
  const {theme} = useTheme();
  const turnstileRef = useRef<TurnstileInstance>(null);
  return (
    <div className="flex flex-1 w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Enter your information below to create your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form.AppForm>
              <form.Form>
                <FieldGroup>
                  <form.AppField name="name">
                    {field => <field.TextField label="Name" autoComplete="name" />}
                  </form.AppField>
                  <form.AppField name="email">
                    {field => (
                      <field.TextField
                        label="Email"
                        description="Used for Google Drive sharing and password resets"
                        type="email"
                        autoComplete="email"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="password">
                    {field => (
                      <field.TextField
                        label="Password"
                        type="password"
                        autoComplete="new-password"
                      />
                    )}
                  </form.AppField>
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY}
                    options={{theme: theme === "system" ? "auto" : theme, size: "flexible"}}
                    onSuccess={token => form.setFieldValue("token", token)}
                  />
                  <FieldGroup>
                    <Field>
                      <form.SubmitButton>Create Account</form.SubmitButton>
                      <FieldDescription className="px-6 text-center">
                        Already have an account? <Link to="/login">Sign in</Link>
                      </FieldDescription>
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
