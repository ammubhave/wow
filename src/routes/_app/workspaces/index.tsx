import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {ArrowRightIcon, ChevronRightIcon, PlusIcon} from "lucide-react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_app/workspaces/")({component: RouteComponent});

function RouteComponent() {
  const myWorkspaces = useQuery({
    queryKey: ["organizations"],
    queryFn: () => authClient.organization.list(),
  });

  const queryClient = useQueryClient();
  const router = useRouter();
  const joinWorkspaceMutation = useMutation(
    orpc.workspaces.join.mutationOptions({
      onSuccess: data => {
        void queryClient.invalidateQueries();
        form.reset();
        void router.navigate({to: "/$workspaceId", params: {workspaceId: data.slug}});
      },
    })
  );
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

  return (
    <div className="lg:p-8 w-full">
      <div className="mx-auto flex max-w-lg flex-col justify-center space-y-6">
        <div className="grid gap-6">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-xl font-semibold tracking-tight">My workspaces</h1>
          </div>
          <ul
            role="list"
            className="divide-y divide-gray-100 overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
            {!myWorkspaces.data?.data ? (
              <Skeleton className="flex h-36 justify-between gap-x-6 px-4 py-5 sm:px-6" />
            ) : myWorkspaces.data.data.length === 0 ? (
              <div className="relative block w-full rounded-lg p-12 text-center">
                <p className="mt-1 text-sm text-gray-500">
                  You are not a member of any workspaces. Join an existing one or create a new one
                  to get started.
                </p>
              </div>
            ) : (
              myWorkspaces.data.data.map(workspace => (
                <li
                  key={workspace.id}
                  className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6">
                  <div className="flex min-w-0 gap-x-4">
                    <div className="min-w-0 flex-auto">
                      <p className="text-sm leading-6 text-gray-900">
                        <Link
                          {...(!workspace.googleAccessToken || !workspace.googleFolderId
                            ? ({
                                to: "/workspaces/create/$workspaceId",
                                params: {workspaceId: workspace.slug},
                              } as const)
                            : ({
                                to: "/$workspaceId",
                                params: {workspaceId: workspace.slug},
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
                      className="h-5 w-5 flex-none text-gray-400"
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
            <form
              onSubmit={e => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
              className="grid items-stretch space-y-8">
              <form.AppField
                name="workspaceId"
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
              <form.SubmitButton className="gap-2" variant="default">
                <ArrowRightIcon className="size-4" />
                Join workspace
              </form.SubmitButton>
            </form>
          </form.AppForm>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
          </div>
          <Button className="gap-2" variant="outline" asChild>
            <Link to="/workspaces/create">
              <PlusIcon className="size-4" />
              Create a new workspace
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
