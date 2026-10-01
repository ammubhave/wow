import {ItemCard, ItemCardGroup} from "@heroui-pro/react";
import {buttonVariants, EmptyState, Separator, Skeleton} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {ArrowRightIcon, ChevronRightIcon, PlusIcon} from "lucide-react";
import {Fragment} from "react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/_app/workspaces/")({
  component: RouteComponent,
  head: () => ({meta: [{title: "My Workspaces | WOW"}]}),
});

function RouteComponent() {
  const myWorkspaces = useQuery({
    queryKey: ["organizations"],
    queryFn: () => authClient.organization.list(),
  });
  const router = useRouter();
  const joinWorkspaceMutation = useMutation(
    orpc.workspaces.join.mutationOptions({
      onSuccess: data => {
        form.reset();
        void router.navigate({to: "/$workspaceSlug", params: {workspaceSlug: data.slug}});
      },
    })
  );
  const form = useAppForm({
    defaultValues: {workspaceSlug: "", password: ""},
    onSubmit: ({value}) => {
      toast.promise(joinWorkspaceMutation.mutateAsync(value), {
        loading: "Joining workspace...",
        success: "Success! You have joined the workspace.",
        error: "Oops! Something went wrong.",
      });
    },
  });

  return (
    <div className="w-full lg:p-8">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <h1 className="text-center text-xl font-semibold tracking-tight">My workspaces</h1>
        {!myWorkspaces.data?.data ? (
          <Skeleton className="h-36" />
        ) : myWorkspaces.data.data.length === 0 ? (
          <EmptyState>
            You are not a member of any workspaces. Join an existing one or create a new one to get
            started.
          </EmptyState>
        ) : (
          <ItemCardGroup className="overflow-hidden">
            {myWorkspaces.data.data.map((workspace, i) => (
              <Fragment key={workspace.id}>
                {i > 0 && <Separator />}
                <ItemCard<"a">
                  className="hover:bg-default/20 active:bg-default-hover/50 relative w-full overflow-hidden transition-colors"
                  render={props => (
                    <Link
                      {...props}
                      {...(!workspace.googleFolderId
                        ? ({
                            to: "/workspaces/create/$workspaceSlug",
                            params: {workspaceSlug: workspace.slug},
                          } as const)
                        : ({
                            to: "/$workspaceSlug",
                            params: {workspaceSlug: workspace.slug},
                          } as const))}
                    />
                  )}>
                  <ItemCard.Content>
                    <ItemCard.Title>{workspace.teamName}</ItemCard.Title>
                    <ItemCard.Description>{workspace.eventName}</ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <ChevronRightIcon aria-hidden="true" className="text-muted size-4" />
                  </ItemCard.Action>
                </ItemCard>
              </Fragment>
            ))}
          </ItemCardGroup>
        )}
        <Separator />
        <h1 className="text-center text-lg font-semibold tracking-tight">
          Join an existing workspace
        </h1>
        <form.AppForm>
          <form.Form>
            <form.AppField
              name="workspaceSlug"
              children={field => (
                <field.TextField
                  label="Workspace ID"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              )}
            />
            <form.AppField
              name="password"
              children={field => <field.TextField label="Workspace Password" type="password" />}
            />
            <form.SubmitButton fullWidth>
              <ArrowRightIcon />
              Join workspace
            </form.SubmitButton>
          </form.Form>
        </form.AppForm>
        <Separator />
        <Link
          className={buttonVariants({variant: "outline", fullWidth: true})}
          to="/workspaces/create">
          <PlusIcon />
          Create a new workspace
        </Link>
      </div>
    </div>
  );
}
