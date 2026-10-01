import {Skeleton} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {ArrowRightIcon, ChevronRightIcon, PlusIcon} from "lucide-react";
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
      <div className="mx-auto flex max-w-lg flex-col justify-center space-y-6">
        <div className="grid gap-6">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-xl font-semibold tracking-tight">My workspaces</h1>
          </div>
          {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Tailwind preflight sets list-style:none, which makes Safari/VoiceOver drop the implicit list role */}
          <ul role="list" className="divide-border ring-border divide-y overflow-hidden ring-1">
            {/* A <ul> may only contain <li>s, so the loading and empty states are list items too. */}
            {!myWorkspaces.data?.data ? (
              <li>
                <Skeleton className="flex h-36 justify-between gap-x-6 px-4 py-5 sm:px-6" />
              </li>
            ) : myWorkspaces.data.data.length === 0 ? (
              <li className="relative block w-full rounded-lg p-12 text-center">
                <p className="text-muted-foreground mt-1 text-sm">
                  You are not a member of any workspaces. Join an existing one or create a new one
                  to get started.
                </p>
              </li>
            ) : (
              myWorkspaces.data.data.map(workspace => (
                <li
                  key={workspace.id}
                  className="hover:bg-surface-secondary relative flex justify-between gap-x-6 px-4 py-5 sm:px-6">
                  <div className="flex min-w-0 gap-x-4">
                    <div className="min-w-0 flex-auto">
                      <p className="text-xs/relaxed leading-6">
                        <Link
                          {...(!workspace.googleFolderId
                            ? ({
                                to: "/workspaces/create/$workspaceSlug",
                                params: {workspaceSlug: workspace.slug},
                              } as const)
                            : ({
                                to: "/$workspaceSlug",
                                params: {workspaceSlug: workspace.slug},
                              } as const))}>
                          <span className="absolute inset-x-0 -top-px bottom-0" />
                          <span className="font-semibold">{workspace.teamName}</span> •{" "}
                          {workspace.eventName}
                        </Link>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-x-4">
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="text-muted-foreground size-4 flex-none"
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
          </div>
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-lg font-semibold tracking-tight">Join an existing workspace</h1>
          </div>
          <form.AppForm>
            <form.Form className="grid items-stretch space-y-8">
              <form.AppField
                name="workspaceSlug"
                children={field => (
                  <field.TextField
                    label="Workspace ID"
                    className="bg-background"
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                )}
              />
              <form.AppField
                name="password"
                children={field => (
                  <field.TextField
                    label="Workspace Password"
                    className="bg-background"
                    type="password"
                  />
                )}
              />
              <form.SubmitButton fullWidth>
                <ArrowRightIcon />
                Join workspace
              </form.SubmitButton>
            </form.Form>
          </form.AppForm>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
          </div>
          <Link className="button button--outline button--full-width" to="/workspaces/create">
            <PlusIcon />
            Create a new workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
