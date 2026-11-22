import {Card, Chip} from "@heroui/react";
import {ORPCError} from "@orpc/client";
import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, useRouter} from "@tanstack/react-router";
import {UsersIcon} from "lucide-react";
import {useEffect, useState} from "react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {CardFormSkeleton} from "@/components/page-skeletons";
import PixelBlast from "@/components/pixel-blast";
import {authClient} from "@/lib/auth-client";
import {forgetJoinPassword, joinPasswordFor} from "@/lib/join-password";
import {orpc} from "@/lib/orpc";
import {accentHex, applyAccent} from "@/lib/workspace-theme";

export const Route = createFileRoute("/_workspace/_app/workspaces/join/$workspaceSlug")({
  loader: ({context: {queryClient}, params: {workspaceSlug}}) =>
    queryClient.ensureQueryData(orpc.workspaces.getPublic.queryOptions({input: workspaceSlug})),
  pendingComponent: CardFormSkeleton,
  component: RouteComponent,
  head: () => ({meta: [{title: "Join workspace | WOW"}]}),
});

function RouteComponent() {
  const params = Route.useParams();
  const router = useRouter();
  const workspace = useSuspenseQuery(
    orpc.workspaces.getPublic.queryOptions({input: params.workspaceSlug})
  ).data;
  // A join link with the password in it fills it in (see lib/join-password.ts).
  const [linkPassword, setLinkPassword] = useState(() => joinPasswordFor(params.workspaceSlug));
  const form = useAppForm({
    defaultValues: {workspaceSlug: params.workspaceSlug, password: linkPassword ?? ""},
    // Awaited, so the Join button stays disabled until the request settles (repeat clicks used to
    // send several joins at once).
    onSubmit: async ({value}) => {
      const join = joinWorkspaceMutation.mutateAsync(value);
      toast.promise(join, {
        loading: "Joining workspace...",
        success: "Success! You have joined the workspace.",
        error: (error: unknown) =>
          error instanceof ORPCError && error.code === "FORBIDDEN"
            ? "That password isn't right."
            : error instanceof ORPCError && error.code === "CONFLICT"
              ? error.message
              : "Oops! Something went wrong.",
      });
      await join.catch((error: unknown) => {
        // The link's password is out of date (or mistyped): forget it and ask for the real one.
        if (linkPassword && error instanceof ORPCError && error.code === "FORBIDDEN") {
          forgetJoinPassword(params.workspaceSlug);
          setLinkPassword(null);
          form.setFieldValue("password", "");
        }
      });
    },
  });
  const joinWorkspaceMutation = useMutation(
    orpc.workspaces.join.mutationOptions({
      onSuccess: data => {
        forgetJoinPassword(params.workspaceSlug);
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
  // The team's own look while you're joining it: its accent color and emoji.
  useEffect(() => applyAccent(workspace.accent), [workspace.accent]);
  const teamName = workspace.teamName ?? params.workspaceSlug;
  const others = workspace.members;
  return (
    <div className="relative flex w-full flex-1 items-center justify-center px-4">
      <div className="absolute inset-0">
        <PixelBlast color={accentHex(workspace.accent)} pixelSize={3} />
      </div>
      <div className="z-10 w-full max-w-sm">
        <Card>
          <Card.Header className="items-center gap-3 text-center">
            <span
              aria-hidden="true"
              className="bg-accent-soft text-accent flex size-16 items-center justify-center rounded-full text-3xl font-bold">
              {workspace.emoji ?? initials(teamName)}
            </span>
            <Card.Title className="text-2xl font-bold">{teamName}</Card.Title>
            {workspace.eventName && <Card.Description>{workspace.eventName}</Card.Description>}
            {others > 0 && (
              <Chip size="sm" variant="soft" color="accent">
                <UsersIcon className="size-3" aria-hidden="true" />
                <Chip.Label>{others === 1 ? "1 teammate" : `${others} teammates`}</Chip.Label>
              </Chip>
            )}
          </Card.Header>
          {workspace.archived ? (
            <Card.Content>
              <p className="text-muted text-center text-sm">
                This workspace is archived, so it isn&apos;t taking new members.
              </p>
            </Card.Content>
          ) : (
            <>
              {/* A link with the password needs nothing but the button. */}
              {!linkPassword && (
                <Card.Content>
                  <form.AppForm>
                    <form.Form>
                      <form.AppField name="password">
                        {field => (
                          <field.TextField
                            variant="secondary"
                            label="Workspace password"
                            type="password"
                          />
                        )}
                      </form.AppField>
                    </form.Form>
                  </form.AppForm>
                </Card.Content>
              )}
              <Card.Footer className="mt-4">
                <form.AppForm>
                  <form.SubmitButton fullWidth>Join {teamName}</form.SubmitButton>
                </form.AppForm>
              </Card.Footer>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/** "The Red Herrings" → "RH": stands in for a team without an emoji. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(word => !/^(the|a|an|of)$/i.test(word))
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? "")
    .join("") || "?";
