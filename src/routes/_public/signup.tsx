import {Card, linkVariants} from "@heroui/react";
import type {TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, Link, redirect, useRouter} from "@tanstack/react-router";
import {useRef, useState} from "react";
import {toast} from "sonner";

import {AuthLayout, FormError, GoogleButton, OrDivider} from "@/components/auth-layout";
import {Captcha, captchaHeaders} from "@/components/captcha";
import {useAppForm} from "@/components/form";
import {authClient} from "@/lib/auth-client";
import {authErrorMessage, keepRedirect, redirectToSearch} from "@/lib/auth-helpers";
import {getSession} from "@/lib/auth-server";

export const Route = createFileRoute("/_public/signup")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Sign up | WOW"}]}),
  validateSearch: redirectToSearch,
  beforeLoad: async ({search}) => {
    if (await getSession()) throw redirect({href: search.redirectTo});
  },
});

function RouteComponent() {
  const router = useRouter();
  // Where the visitor was headed (e.g. a teammate's workspace link) before being asked to sign up.
  const {redirectTo} = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const form = useAppForm({
    defaultValues: {name: "", email: "", password: "", token: ""},
    onSubmit: async ({value}) => {
      setError(null);
      if (["simhunt", "eggö", "admin"].includes(value.name.trim().toLowerCase())) {
        setError("That name is reserved. Please choose a different name.");
        return;
      }
      await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
        notificationsDisabled: false,
        fetchOptions: {
          headers: captchaHeaders(value.token),
          // Sign-up also signs in, so go straight on to where they were headed.
          onSuccess: async () => {
            toast.success("Welcome to WOW!");
            await router.navigate({href: redirectTo});
          },
          onError: context => {
            turnstileRef.current?.reset();
            setError(
              authErrorMessage(context.error, "Couldn't create your account. Please try again.")
            );
          },
        },
      });
    },
  });
  return (
    <AuthLayout>
      <Card>
        <Card.Header>
          <Card.Title className="text-lg font-semibold">Create your account</Card.Title>
          <Card.Description>Join your team's workspace and start solving.</Card.Description>
        </Card.Header>
        <Card.Content className="gap-4">
          <GoogleButton callbackURL={redirectTo} label="Sign up with Google" />
          <OrDivider>or with email</OrDivider>
          <form.AppForm>
            <form.Form onChange={() => setError(null)}>
              <form.AppField name="name">
                {field => (
                  <field.TextField
                    variant="secondary"
                    label="Name"
                    description="Shown to your teammates"
                    autoComplete="name"
                    autoFocus
                  />
                )}
              </form.AppField>
              <form.AppField name="email">
                {field => (
                  <field.TextField
                    variant="secondary"
                    label="Email"
                    description="Used for Google Drive sharing and password resets"
                    type="email"
                    autoComplete="email"
                  />
                )}
              </form.AppField>
              <form.AppField name="password">
                {field => (
                  <field.PasswordField
                    variant="secondary"
                    label="Password"
                    autoComplete="new-password"
                  />
                )}
              </form.AppField>
              <Captcha ref={turnstileRef} onToken={token => form.setFieldValue("token", token)} />
              <FormError error={error} />
            </form.Form>
          </form.AppForm>
        </Card.Content>
        <Card.Footer className="mt-4 flex-col gap-2">
          <form.AppForm>
            <form.SubmitButton fullWidth>Create account</form.SubmitButton>
          </form.AppForm>
          <p className="text-muted text-center text-xs/relaxed">
            Already have an account?{" "}
            <Link className={linkVariants().base()} to="/login" search={keepRedirect(redirectTo)}>
              Log in
            </Link>
          </p>
        </Card.Footer>
      </Card>
    </AuthLayout>
  );
}
