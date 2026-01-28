import {Turnstile, TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, Link, redirect, useRouter} from "@tanstack/react-router";
import {useRef} from "react";
import {toast} from "sonner";
import z from "zod";

import {useAppForm} from "@/components/form";
import {useTheme} from "@/components/theme-provider";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldDescription, FieldGroup, FieldSeparator} from "@/components/ui/field";
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

async function loginWithGoogle() {
  await authClient.signIn.social({provider: "google", callbackURL: "/workspaces"}, {throw: true});
}

function RouteComponent() {
  const router = useRouter();
  const searchParams = Route.useSearch();
  const form = useAppForm({
    defaultValues: {email: "", password: "", token: ""},
    onSubmit: async ({value}) => {
      await authClient.signIn.email({
        email: value.email,
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
              <CardDescription>
                You can login with Google or use your email and password below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.AppForm>
                <form.Form>
                  <FieldGroup>
                    <Field>
                      <Button variant="outline" onClick={loginWithGoogle}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                          <path
                            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                            fill="currentColor"
                          />
                        </svg>
                        Login with Google
                      </Button>
                    </Field>
                    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                      Or continue with
                    </FieldSeparator>
                    <form.AppField name="email">
                      {field => <field.TextField label="Email" autoComplete="email" />}
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
