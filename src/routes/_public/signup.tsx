import {Turnstile, TurnstileInstance} from "@marsidev/react-turnstile";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {CheckIcon, XIcon} from "lucide-react";
import {useRef} from "react";
import {toast} from "sonner";
import z from "zod";

import {useAppForm} from "@/components/form";
import {useTheme} from "@/components/theme-provider";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldDescription, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";
import {UsernameAvailabilityIndicator} from "@/components/username-availability-indicator";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_public/signup")({component: RouteComponent});

function RouteComponent() {
  const router = useRouter();
  const form = useAppForm({
    defaultValues: {name: "", email: "", username: "", password: "", token: ""},
    onSubmit: async ({value}) =>
      await authClient.signUp.email({
        name: value.name,
        email: value.email,
        username: value.username,
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
                  <form.AppField
                    name="username"
                    validators={{onBlur: z.string().min(3, "Username is too short")}}>
                    {field => (
                      <UsernameAvailabilityIndicator username={field.state.value}>
                        {available => (
                          <Field
                            data-invalid={
                              available === false ||
                              (field.state.meta.errors.length > 0 && form.state.isTouched)
                            }>
                            <FieldLabel>Username</FieldLabel>
                            <InputGroup>
                              <InputGroupInput
                                value={field.state.value}
                                onChange={e => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                autoComplete="username"
                                aria-invalid={
                                  available === false ||
                                  (field.state.meta.errors.length > 0 && form.state.isTouched)
                                }
                              />
                              {available === true && (
                                <InputGroupAddon align="inline-end">
                                  <div className="flex size-4 items-center justify-center rounded-full bg-green-500 dark:bg-green-800">
                                    <CheckIcon className="size-3 text-white" />
                                  </div>
                                </InputGroupAddon>
                              )}
                              {available === false && (
                                <InputGroupAddon align="inline-end">
                                  <div className="flex size-4 items-center justify-center rounded-full bg-red-500 dark:bg-red-800">
                                    <XIcon className="size-3 text-white" />
                                  </div>
                                </InputGroupAddon>
                              )}
                            </InputGroup>
                            {available === true && (
                              <FieldDescription className="text-green-700">
                                This username is available.
                              </FieldDescription>
                            )}
                            {available === false && (
                              <FieldDescription className="text-red-700">
                                This username is not available.
                              </FieldDescription>
                            )}
                            <FieldError errors={field.state.meta.errors} />
                          </Field>
                        )}
                      </UsernameAvailabilityIndicator>
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
