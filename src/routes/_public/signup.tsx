import {Card} from "@heroui/react";
import type {TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, Link, redirect, useRouter} from "@tanstack/react-router";
import {useRef} from "react";
import {toast} from "sonner";

import {Captcha, captchaHeaders} from "@/components/captcha";
import {useAppForm} from "@/components/form";
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
    defaultValues: {name: "", email: "", password: "", token: ""},
    onSubmit: async ({value}) => {
      if (["simhunt", "eggö", "admin"].includes(value.name.trim().toLowerCase())) {
        toast.error("That name is reserved. Please choose a different name.");
        return;
      }
      await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
        notificationsDisabled: false,
        fetchOptions: {
          headers: captchaHeaders(value.token),
          onSuccess: async () => {
            await router.navigate({to: "/login"});
          },
          onError: error => {
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
        <Card>
          <Card.Header>
            <Card.Title>Create an account</Card.Title>
            <Card.Description>Enter your information below to create your account</Card.Description>
          </Card.Header>
          <Card.Content>
            <form.AppForm>
              <form.Form>
                <div className="flex w-full flex-col gap-4">
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
                  <Captcha
                    ref={turnstileRef}
                    onToken={token => form.setFieldValue("token", token)}
                  />
                  <div className="flex w-full flex-col gap-4">
                    <div className="flex w-full flex-col gap-2">
                      <form.SubmitButton>Create Account</form.SubmitButton>
                      <p className="text-muted [&>a:hover]:text-primary px-6 text-center text-xs/relaxed [&>a]:underline [&>a]:underline-offset-4">
                        Already have an account? <Link to="/login">Sign in</Link>
                      </p>
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
