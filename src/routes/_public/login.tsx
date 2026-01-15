import {Turnstile, TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, Link, redirect, useRouter} from "@tanstack/react-router";
import {useRef} from "react";
import {toast} from "sonner";
import z from "zod";

import {useAppForm} from "@/components/form";
import {useTheme} from "@/components/theme-provider";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldDescription, FieldGroup} from "@/components/ui/field";
import {authClient} from "@/lib/auth-client";
import {getSession} from "@/lib/auth-server";

export const Route = createFileRoute("/_public/login")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Login | WOW"}]}),
  validateSearch: z.object({redirectTo: z.string().optional().default("/workspaces")}),
  loader: async () => {
    const session = await getSession();
    if (session) throw redirect({to: "/workspaces"});
  },
});

function RouteComponent() {
  const router = useRouter();
  const searchParams = Route.useSearch();
  const form = useAppForm({
    defaultValues: {username: "", password: "", token: ""},
    onSubmit: async ({value}) => {
      await authClient.signIn.username({
        username: value.username,
        password: value.password,
        fetchOptions: {
          headers: {"x-captcha-response": value.token},
          onSuccess: async () => {
            await router.navigate({to: searchParams.redirectTo});
          },
          onError: async error => {
            turnstileRef.current?.reset();
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
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Login to your account</CardTitle>
              <CardDescription>Enter your username below to login to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <form.AppForm>
                <form.Form>
                  <FieldGroup>
                    <form.AppField name="username">
                      {field => <field.TextField label="Username" autoComplete="username" />}
                    </form.AppField>
                    <form.AppField name="password">
                      {field => (
                        <field.TextField
                          label="Password"
                          type="password"
                          autoComplete="current-password"
                          description={
                            <Link className="ml-auto table" to="/forgot-password">
                              Forgot password?
                            </Link>
                          }
                        />
                      )}
                    </form.AppField>
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY}
                      options={{theme: theme === "system" ? "auto" : theme, size: "flexible"}}
                      onSuccess={token => form.setFieldValue("token", token)}
                    />
                    <Field>
                      <form.SubmitButton>Login</form.SubmitButton>
                      <FieldDescription className="text-center">
                        Don&apos;t have an account? <Link to="/signup">Sign up</Link>
                      </FieldDescription>
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
