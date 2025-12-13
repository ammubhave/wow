import {createFileRoute, Link, useRouter} from "@tanstack/react-router";

import {useAppForm} from "@/components/form";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldDescription, FieldGroup} from "@/components/ui/field";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_public/signup")({component: RouteComponent});

function RouteComponent() {
  const router = useRouter();
  const form = useAppForm({
    defaultValues: {name: "", email: "", username: "", password: "", confirmPassword: ""},
    onSubmit: async ({value}) =>
      await authClient.signUp.email(
        {
          name: value.name,
          email: value.email,
          username: value.username,
          password: value.password,
          notificationsDisabled: false,
        },
        {
          onSuccess: async () => {
            await router.navigate({to: "/login"});
          },
        }
      ),
  });
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
              <form
                onSubmit={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}>
                <FieldGroup>
                  <form.AppField name="name">
                    {field => <field.TextField label="Name" />}
                  </form.AppField>
                  <form.AppField name="email">
                    {field => (
                      <field.TextField
                        label="Email"
                        description="Used for Google Drive sharing and password resets"
                        type="email"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="username">
                    {field => <field.TextField label="Username" />}
                  </form.AppField>
                  <form.AppField name="password">
                    {field => (
                      <field.TextField
                        label="Password"
                        description="Password resets not supported"
                        type="password"
                      />
                    )}
                  </form.AppField>

                  <FieldGroup>
                    <Field>
                      <form.SubmitButton type="submit">Create Account</form.SubmitButton>
                      <FieldDescription className="px-6 text-center">
                        Already have an account? <Link to="/login">Sign in</Link>
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </FieldGroup>
              </form>
            </form.AppForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
