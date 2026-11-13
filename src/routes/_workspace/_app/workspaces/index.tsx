import {ItemCard, ItemCardGroup} from "@heroui-pro/react";
import {
  Button,
  buttonVariants,
  Chip,
  Disclosure,
  EmptyState,
  ProgressBar,
  Separator,
  Skeleton,
} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {ArrowRightIcon, ChevronRightIcon, PlusIcon, UsersIcon} from "lucide-react";
import {Fragment, useState} from "react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/_app/workspaces/")({
  component: RouteComponent,
  head: () => ({meta: [{title: "My Workspaces | WOW"}]}),
});

type WorkspaceSummary = Awaited<ReturnType<typeof orpc.me.workspaces.call>>[number];

/** Where the hunt is: live, coming up, over, or no dates set (null). */
function huntState({huntStartsAt, huntEndsAt}: WorkspaceSummary, now: number) {
  if (huntStartsAt === null && huntEndsAt === null) return null;
  if (huntEndsAt !== null && now >= huntEndsAt) return "over" as const;
  if (huntStartsAt !== null && now < huntStartsAt) return "upcoming" as const;
  return "live" as const;
}

// Live hunts first, then upcoming, then ones without dates, then finished; newest first in each.
const STATE_ORDER = {live: 0, upcoming: 1, none: 2, over: 3};

function HuntStateChip({workspace, now}: {workspace: WorkspaceSummary; now: number}) {
  const state = huntState(workspace, now);
  if (state === "live") {
    return (
      <Chip size="sm" color="success" variant="soft">
        <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
        <Chip.Label>Live</Chip.Label>
      </Chip>
    );
  }
  if (state === "upcoming" && workspace.huntStartsAt !== null) {
    return (
      <Chip size="sm" variant="soft">
        <Chip.Label>
          Starts{" "}
          {new Date(workspace.huntStartsAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </Chip.Label>
      </Chip>
    );
  }
  if (state === "over") {
    return (
      <Chip size="sm" variant="soft">
        <Chip.Label>Hunt over</Chip.Label>
      </Chip>
    );
  }
  return null;
}

function WorkspaceCard({workspace, now}: {workspace: WorkspaceSummary; now: number}) {
  return (
    <ItemCard<"a">
      className="hover:bg-default/20 active:bg-default-hover/50 relative w-full overflow-hidden transition-colors"
      render={props => (
        <Link {...props} to="/$workspaceSlug" params={{workspaceSlug: workspace.slug}} />
      )}>
      <ItemCard.Content className="min-w-0 gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ItemCard.Title className="truncate">{workspace.teamName}</ItemCard.Title>
          <HuntStateChip workspace={workspace} now={now} />
          {workspace.role === "owner" && (
            <Chip size="sm" variant="tertiary">
              <Chip.Label>Owner</Chip.Label>
            </Chip>
          )}
        </div>
        <ItemCard.Description className="truncate">{workspace.eventName}</ItemCard.Description>
        <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {workspace.puzzles > 0 ? (
            <ProgressBar
              aria-label={`${workspace.solved} of ${workspace.puzzles} puzzles solved`}
              value={workspace.solved}
              maxValue={workspace.puzzles}
              size="sm"
              color="success"
              className="flex w-44 items-center gap-2">
              <ProgressBar.Track className="flex-1">
                <ProgressBar.Fill />
              </ProgressBar.Track>
              <span className="tabular-nums">
                {workspace.solved}/{workspace.puzzles} solved
              </span>
            </ProgressBar>
          ) : (
            <span>No puzzles yet</span>
          )}
          <span className="flex items-center gap-1">
            <UsersIcon className="size-3.5" aria-hidden="true" />
            {workspace.members} {workspace.members === 1 ? "member" : "members"}
          </span>
        </div>
      </ItemCard.Content>
      <ItemCard.Action>
        <ChevronRightIcon aria-hidden="true" className="text-muted size-4" />
      </ItemCard.Action>
    </ItemCard>
  );
}

function RouteComponent() {
  const myWorkspaces = useQuery(orpc.me.workspaces.queryOptions());
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
  // Read once per visit: enough for "live" vs "over".
  const [now] = useState(() => Date.now());
  const workspaces = myWorkspaces.data
    ?.map(workspace => ({workspace, rank: STATE_ORDER[huntState(workspace, now) ?? "none"]}))
    .toSorted((a, b) => a.rank - b.rank || b.workspace.createdAt - a.workspace.createdAt)
    .map(({workspace}) => workspace);
  const hasWorkspaces = (workspaces?.length ?? 0) > 0;
  // Joining by ID and password is the fallback (invitations are links); open it when it's the way in.
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">My workspaces</h1>
          <Link
            className={buttonVariants({variant: "primary", size: "sm"})}
            to="/workspaces/create">
            <PlusIcon />
            Create workspace
          </Link>
        </div>
        {!workspaces ? (
          <Skeleton className="h-36" />
        ) : !hasWorkspaces ? (
          <EmptyState>
            You're not in any workspaces yet. Open the invitation link a teammate sent you, or
            create a workspace for your team.
          </EmptyState>
        ) : (
          <ItemCardGroup className="overflow-hidden">
            {workspaces.map((workspace, i) => (
              <Fragment key={workspace.slug}>
                {i > 0 && <Separator />}
                <WorkspaceCard workspace={workspace} now={now} />
              </Fragment>
            ))}
          </ItemCardGroup>
        )}
        <Disclosure
          isExpanded={isJoinOpen || (workspaces !== undefined && !hasWorkspaces)}
          onExpandedChange={setIsJoinOpen}>
          <Disclosure.Heading className="flex justify-center">
            <Button slot="trigger" variant="ghost" size="sm" className="text-muted">
              Have a workspace ID and password?
              <Disclosure.Indicator />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="pt-4">
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
                    children={field => (
                      <field.TextField label="Workspace password" type="password" />
                    )}
                  />
                  <form.SubmitButton fullWidth>
                    <ArrowRightIcon />
                    Join workspace
                  </form.SubmitButton>
                </form.Form>
              </form.AppForm>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      </div>
    </div>
  );
}
