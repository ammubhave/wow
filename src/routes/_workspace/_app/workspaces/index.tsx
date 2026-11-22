import {ItemCard, ItemCardGroup} from "@heroui-pro/react";
import {
  Button,
  buttonVariants,
  Card,
  Chip,
  EmptyState,
  ProgressBar,
  Separator,
  Skeleton,
} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {createFileRoute, Link, useRouter} from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CalendarIcon,
  ChevronRightIcon,
  GlobeIcon,
  LogInIcon,
  MapPinIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";
import {Fragment, useState} from "react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {HuntsComingUp} from "@/components/hunts-coming-up";
import {Page} from "@/components/page";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/_app/workspaces/")({
  component: RouteComponent,
  head: () => ({meta: [{title: "My workspaces | WOW"}]}),
});

type WorkspaceSummary = Awaited<ReturnType<typeof orpc.me.workspaces.call>>[number];

/** Where the hunt is: live, coming up, over, or no dates set (null). */
function huntState({huntStartsAt, huntEndsAt}: WorkspaceSummary, now: number) {
  if (huntStartsAt === null && huntEndsAt === null) return null;
  if (huntEndsAt !== null && now >= huntEndsAt) return "over" as const;
  if (huntStartsAt !== null && now < huntStartsAt) return "upcoming" as const;
  return "live" as const;
}

/** The join form's first field (the header's Join button jumps to it on narrow screens). */
const JOIN_INPUT_ID = "join-workspace-id";

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

/** "Jan 15", with the year when it isn't this one. */
const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });

/** The hunt's dates and place, when the workspace has them. */
function HuntWhenWhere({workspace}: {workspace: WorkspaceSummary}) {
  const {huntStartsAt: start, huntEndsAt: end, huntLocation: location} = workspace;
  const dates =
    start !== null && end !== null
      ? shortDate(start) === shortDate(end)
        ? shortDate(start)
        : `${shortDate(start)} – ${shortDate(end)}`
      : start !== null
        ? `From ${shortDate(start)}`
        : end !== null
          ? `Until ${shortDate(end)}`
          : null;
  if (!dates && !location) return null;
  const isOnline = location !== null && /\bonline\b/i.test(location);
  const PlaceIcon = isOnline ? GlobeIcon : MapPinIcon;
  return (
    <div className="text-muted flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {dates && (
        <span className="flex items-center gap-1">
          <CalendarIcon className="size-3.5" aria-hidden="true" />
          {dates}
        </span>
      )}
      {location && (
        <span className="flex min-w-0 items-center gap-1">
          <PlaceIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{location}</span>
        </span>
      )}
    </div>
  );
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
        <HuntWhenWhere workspace={workspace} />
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

  return (
    <Page
      title="My workspaces"
      actions={
        <>
          {/* Beside the list on wide screens; below it otherwise, so this jumps to it. */}
          <Button
            size="sm"
            variant="secondary"
            className="lg:hidden"
            onPress={() => {
              const input = document.getElementById(JOIN_INPUT_ID);
              input?.scrollIntoView({behavior: "smooth", block: "center"});
              input?.focus({preventScroll: true});
            }}>
            <LogInIcon />
            Join workspace
          </Button>
          <Link
            className={buttonVariants({variant: "primary", size: "sm"})}
            to="/workspaces/create">
            <PlusIcon />
            Create workspace
          </Link>
        </>
      }>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {!workspaces ? (
          <Skeleton className="h-36 rounded-2xl" />
        ) : !hasWorkspaces ? (
          <EmptyState className="border-separator flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
            <UsersIcon className="text-muted size-8" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-foreground font-semibold">No workspaces yet</p>
              <p className="text-muted max-w-sm text-sm">
                Captain? Create one for your team's next hunt. Joining a team? Open the invitation
                link or email you were sent, or use <strong>Join a workspace</strong>.
              </p>
            </div>
            <Link className={buttonVariants({variant: "primary"})} to="/workspaces/create">
              <PlusIcon />
              Create a workspace
            </Link>
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
        <Card className="lg:sticky lg:top-4">
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <LogInIcon className="text-accent size-4" aria-hidden="true" />
              Join a workspace
            </Card.Title>
            <Card.Description>
              Got an invitation link? Just open it. Otherwise, enter the workspace ID and password
              your team shared.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <form.AppForm>
              <form.Form>
                <form.AppField
                  name="workspaceSlug"
                  children={field => (
                    <field.TextField
                      id={JOIN_INPUT_ID}
                      variant="secondary"
                      label="Workspace ID"
                      placeholder="e.g. myteam2027"
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
                    <field.PasswordField variant="secondary" label="Workspace password" />
                  )}
                />
                <form.SubmitButton fullWidth>
                  <ArrowRightIcon />
                  Join workspace
                </form.SubmitButton>
              </form.Form>
            </form.AppForm>
          </Card.Content>
        </Card>
      </div>
      <HuntsComingUp />
    </Page>
  );
}
