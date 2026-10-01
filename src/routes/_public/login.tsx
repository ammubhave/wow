import {Button, Card, Separator} from "@heroui/react";
import type {TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, Link, redirect, useRouter} from "@tanstack/react-router";
import {useRef} from "react";
import {toast} from "sonner";
import {z} from "zod";

import {Captcha, captchaHeaders} from "@/components/captcha";
import {useAppForm} from "@/components/form";
import {authClient} from "@/lib/auth-client";
import {getSession} from "@/lib/auth-server";

export const Route = createFileRoute("/_public/login")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Login | WOW"}]}),
  validateSearch: z.object({
    // Only allow same-origin paths, so a crafted login link can't bounce the user to another site.
    redirectTo: z
      .string()
      .optional()
      .transform(value =>
        value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
          ? value
          : "/workspaces"
      ),
  }),
  loader: async () => {
    const session = await getSession();
    if (session) throw redirect({to: "/workspaces"});
  },
});

async function loginWithGoogle(callbackURL: string) {
  const {error} = await authClient.signIn.social({provider: "google", callbackURL});
  if (error) toast.error(error.message ?? "Couldn't sign in with Google. Please try again.");
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
          headers: captchaHeaders(value.token),
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
  const turnstileRef = useRef<TurnstileInstance>(null);
  return (
    <div className="flex w-full flex-1 items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <Card.Header>
              <Card.Title>Login to your account</Card.Title>
              <Card.Description>
                You can login with Google or use your email and password below.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <form.AppForm>
                <form.Form>
                  <div className="flex w-full flex-col gap-4">
                    <div className="flex w-full flex-col gap-2">
                      <Button
                        variant="tertiary"
                        fullWidth
                        onPress={() => void loginWithGoogle(searchParams.redirectTo)}>
                        <svg
                          aria-hidden="true"
                          fill="none"
                          focusable="false"
                          height="16"
                          role="presentation"
                          viewBox="0 0 16 16"
                          width="16"
                          xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M5.877 1.46a6.921 6.921 0 0 0 .474 13.224c1.159.3 2.373.312 3.539.038a6.248 6.248 0 0 0 2.833-1.472 6.28 6.28 0 0 0 1.75-2.872 8.125 8.125 0 0 0 .176-3.673h-6.51v2.7h3.77a3.25 3.25 0 0 1-1.385 2.136c-.46.304-.98.509-1.523.601a4.517 4.517 0 0 1-1.652 0 4.068 4.068 0 0 1-1.537-.67 4.299 4.299 0 0 1-1.586-2.124 4.189 4.189 0 0 1 0-2.694c.208-.613.551-1.17 1.005-1.631a4.066 4.066 0 0 1 4.096-1.07c.558.172 1.07.471 1.492.875.425-.423.849-.847 1.273-1.272.218-.228.457-.446.672-.68a6.693 6.693 0 0 0-2.227-1.374 7 7 0 0 0-4.66-.042Z"
                            fill="#fff"></path>
                          <path
                            d="M5.877 1.46a7 7 0 0 1 4.66.04c.826.31 1.582.78 2.226 1.381-.219.234-.45.453-.672.68l-1.272 1.267a3.752 3.752 0 0 0-1.492-.875 4.066 4.066 0 0 0-4.098 1.065A4.293 4.293 0 0 0 4.225 6.65L1.958 4.894A6.949 6.949 0 0 1 5.877 1.46Z"
                            fill="#E33629"></path>
                          <path
                            d="M1.356 6.633a6.89 6.89 0 0 1 .602-1.74l2.267 1.76a4.19 4.19 0 0 0 0 2.694c-.755.584-1.511 1.17-2.267 1.76a6.927 6.927 0 0 1-.602-4.474Z"
                            fill="#F8BD00"></path>
                          <path
                            d="M8.139 6.704h6.51a8.127 8.127 0 0 1-.176 3.673 6.283 6.283 0 0 1-1.75 2.872c-.732-.571-1.467-1.138-2.199-1.709a3.25 3.25 0 0 0 1.385-2.137h-3.77v-2.7Z"
                            fill="#587DBD"></path>
                          <path
                            d="M1.957 11.106a539.69 539.69 0 0 0 2.267-1.759 4.298 4.298 0 0 0 1.588 2.125c.462.326.987.552 1.54.665a4.517 4.517 0 0 0 1.652 0 3.96 3.96 0 0 0 1.524-.602c.731.57 1.466 1.137 2.198 1.708a6.25 6.25 0 0 1-2.833 1.474 7.394 7.394 0 0 1-3.54-.039 6.967 6.967 0 0 1-4.397-3.572Z"
                            fill="#319F43"></path>
                        </svg>
                        Login with Google
                      </Button>
                    </div>
                    <div className="relative -my-2 h-5 text-xs/relaxed">
                      <Separator className="absolute inset-0 top-1/2" />
                      <span className="text-muted bg-card relative mx-auto block w-fit px-2">
                        Or continue with
                      </span>
                    </div>
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
                    <Captcha
                      ref={turnstileRef}
                      onToken={token => form.setFieldValue("token", token)}
                    />
                    <div className="flex w-full flex-col gap-2">
                      <form.SubmitButton>Login</form.SubmitButton>
                      <p className="text-muted [&>a:hover]:text-primary text-center text-xs/relaxed [&>a]:underline [&>a]:underline-offset-4">
                        Don&apos;t have an account? <Link to="/signup">Sign up</Link>
                      </p>
                    </div>
                  </div>
                </form.Form>
              </form.AppForm>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
