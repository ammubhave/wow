import {Card} from "@heroui/react";
import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, useRouter} from "@tanstack/react-router";
import {useEffect} from "react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import PixelBlast from "@/components/pixel-blast";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/_app/workspaces/join/$workspaceSlug")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Join Workspace | WOW"}]}),
});

function RouteComponent() {
  const params = Route.useParams();
  const router = useRouter();
  const workspace = useSuspenseQuery(
    orpc.workspaces.getPublic.queryOptions({input: params.workspaceSlug})
  ).data;
  const form = useAppForm({
    defaultValues: {workspaceSlug: params.workspaceSlug, password: ""},
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
        void router.navigate({to: "/$workspaceSlug", params: {workspaceSlug: data.slug}});
      },
    })
  );
  const organizations = authClient.useListOrganizations().data;
  const workspaceSlug = params.workspaceSlug;
  useEffect(() => {
    if (organizations && organizations.some(org => org.slug === workspaceSlug)) {
      void router.navigate({to: "/$workspaceSlug", params: {workspaceSlug}});
    }
  }, [organizations, workspaceSlug, router]);
  return (
    <div className="relative flex w-full flex-1 items-center justify-center p-6 md:p-10">
      <div className="absolute inset-0">
        <PixelBlast color="#f49f1e" pixelSize={3} />
      </div>
      <div className="z-10 w-full max-w-sm">
        <Card>
          <Card.Header>
            <Card.Title>Join Workspace {params.workspaceSlug}</Card.Title>
            <Card.Description>Enter the workspace password to join.</Card.Description>
          </Card.Header>
          <Card.Content>
            <form.AppForm>
              <form.Form>
                <div className="flex w-full flex-col gap-4">
                  <div className="border-border flex w-full flex-col gap-1 rounded-md border p-4">
                    <div className="text-sm font-medium">{workspace.teamName}</div>
                    <div className="text-muted-foreground text-sm">{workspace.eventName}</div>
                  </div>
                  <form.AppField name="password">
                    {field => <field.TextField label="Workspace Password" type="password" />}
                  </form.AppField>
                  <div className="flex w-full flex-col gap-4">
                    <form.SubmitButton>Join</form.SubmitButton>
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
