import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, useRouter} from "@tanstack/react-router";
import {useEffect} from "react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import PixelBlast from "@/components/pixel-blast";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {FieldGroup} from "@/components/ui/field";
import {Item, ItemContent, ItemDescription, ItemTitle} from "@/components/ui/item";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/_app/workspaces/join/$workspaceId")({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  const router = useRouter();
  const workspace = useSuspenseQuery(
    orpc.workspaces.getPublic.queryOptions({input: params.workspaceId})
  ).data;
  const form = useAppForm({
    defaultValues: {workspaceId: "", password: ""},
    onSubmit: ({value}) => {
      toast.promise(joinWorkspaceMutation.mutateAsync(value), {
        loading: "Joining workspace...",
        success: "Success! You have joined the workspace.",
        error: "Oops! Something went wrong.",
      });
    },
  });
  const joinWorkspaceMutation = useMutation(
    orpc.workspaces.join.mutationOptions({
      onSuccess: data => {
        form.reset();
        void router.navigate({to: "/$workspaceId", params: {workspaceId: data.slug}});
      },
    })
  );
  const organizations = authClient.useListOrganizations().data;
  useEffect(() => {
    if (organizations && organizations.findIndex(org => org.slug === params.workspaceId) !== -1) {
      void router.navigate({to: "/$workspaceId", params: {workspaceId: params.workspaceId}});
    }
  }, [organizations]);
  return (
    <div className="flex flex-1 w-full items-center justify-center p-6 md:p-10 relative">
      <div className="absolute inset-0">
        <PixelBlast color="#f49f1e" pixelSize={3} />
      </div>
      <div className="w-full max-w-sm z-10">
        <Card>
          <CardHeader>
            <CardTitle>Join Workspace {params.workspaceId}</CardTitle>
            <CardDescription>Enter the workspace password to join.</CardDescription>
          </CardHeader>
          <CardContent>
            <form.AppForm>
              <form.Form>
                <FieldGroup>
                  <Item variant="outline">
                    <ItemContent>
                      <ItemTitle>{workspace.teamName}</ItemTitle>
                      <ItemDescription>{workspace.eventName}</ItemDescription>
                    </ItemContent>
                  </Item>
                  <form.AppField name="password">
                    {field => <field.TextField label="Workspace Password" type="password" />}
                  </form.AppField>
                  <FieldGroup>
                    <form.SubmitButton>Join</form.SubmitButton>
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
