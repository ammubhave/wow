import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldDescription, FieldGroup} from "@/components/ui/field";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_public/login")({component: RouteComponent});

function RouteComponent() {
  const router = useRouter();
  const form = useAppForm({
    defaultValues: {username: "", password: ""},
    onSubmit: async ({value}) => {
      await authClient.signIn.username(
        {username: value.username, password: value.password},
        {
          onSuccess: async () => {
            await router.navigate({to: "/workspaces"});
          },
          onError: async error => {
            toast.error(error.error.message);
          },
        }
      );
    },
  });
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
                      {field => <field.TextField label="Username" />}
                    </form.AppField>
                    <form.AppField name="password">
                      {field => <field.TextField label="Password" type="password" />}
                    </form.AppField>
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
