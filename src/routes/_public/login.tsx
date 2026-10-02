import {Button, Card, linkVariants} from "@heroui/react";
import type {TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, Link, redirect, useRouter} from "@tanstack/react-router";
import {KeyRoundIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import {
  AuthLayout,
  FormError,
  GoogleButton,
  LastUsedChip,
  OrDivider,
} from "@/components/auth-layout";
import {Captcha, captchaHeaders} from "@/components/captcha";
import {useAppForm} from "@/components/form";
import {authClient} from "@/lib/auth-client";
import {authErrorMessage, keepRedirect, redirectToSearch} from "@/lib/auth-helpers";
import {getSession} from "@/lib/auth-server";

export const Route = createFileRoute("/_public/login")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Log in | WOW"}]}),
  validateSearch: redirectToSearch,
  // Already signed in (e.g. another tab): go where the link was headed.
  beforeLoad: async ({search}) => {
    if (await getSession()) throw redirect({href: search.redirectTo});
  },
});

function RouteComponent() {
  const router = useRouter();
  const searchParams = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const onSignedIn = () => router.navigate({to: searchParams.redirectTo});

  const form = useAppForm({
    defaultValues: {email: "", password: "", token: ""},
    onSubmit: async ({value}) => {
      setError(null);
      await authClient.signIn.email({
        email: value.email,
        password: value.password,
        fetchOptions: {
          headers: captchaHeaders(value.token),
          onSuccess: onSignedIn,
          onError: context => {
            turnstileRef.current?.reset();
            setError(authErrorMessage(context.error, "Couldn't log in. Please try again."));
          },
        },
      });
    },
  });

  const signInWithPasskey = async (autoFill: boolean) => {
    const result = await authClient.signIn.passkey({autoFill});
    if (result.data) await onSignedIn();
    // Autofill is a background offer the user may ignore; only a pressed button reports failure.
    else if (!autoFill && result.error)
      setError(authErrorMessage(result.error, "Couldn't log in with a passkey."));
  };

  // Offer saved passkeys in the email field's autofill, where the browser supports it.
  useEffect(() => {
    const offerPasskeys = async () => {
      if (await PublicKeyCredential.isConditionalMediationAvailable?.()) {
        await signInWithPasskey(true);
      }
    };
    void offerPasskeys();
    // Runs once: the browser keeps the autofill request open until it's used.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthLayout>
      <Card>
        <Card.Header>
          <Card.Title className="text-lg font-semibold">Welcome back</Card.Title>
          <Card.Description>Log in to get back to your team's hunt.</Card.Description>
        </Card.Header>
        <Card.Content className="gap-4">
          <div className="flex flex-col gap-2">
            <GoogleButton callbackURL={searchParams.redirectTo} label="Continue with Google" />
            <Button
              variant="tertiary"
              fullWidth
              className="relative"
              onPress={() => void signInWithPasskey(false)}>
              <KeyRoundIcon />
              Continue with a passkey
              <LastUsedChip method="passkey" />
            </Button>
          </div>
          <OrDivider>or with email</OrDivider>
          <form.AppForm>
            <form.Form onChange={() => setError(null)}>
              <form.AppField name="email">
                {field => (
                  <field.TextField
                    variant="secondary"
                    label="Email"
                    type="email"
                    // "webauthn" lets the browser list saved passkeys in this field's autofill.
                    autoComplete="username webauthn"
                    autoFocus
                  />
                )}
              </form.AppField>
              <form.AppField name="password">
                {field => (
                  <field.PasswordField
                    variant="secondary"
                    label="Password"
                    autoComplete="current-password"
                    description={
                      <Link
                        className={linkVariants().base({className: "ms-auto table"})}
                        to="/forgot-password">
                        Forgot password?
                      </Link>
                    }
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
            <form.SubmitButton fullWidth className="relative">
              Log in
              <LastUsedChip method="email" />
            </form.SubmitButton>
          </form.AppForm>
          <p className="text-muted text-center text-xs/relaxed">
            New to WOW?{" "}
            <Link
              className={linkVariants().base()}
              to="/signup"
              search={keepRedirect(searchParams.redirectTo)}>
              Create an account
            </Link>
          </p>
        </Card.Footer>
      </Card>
    </AuthLayout>
  );
}
