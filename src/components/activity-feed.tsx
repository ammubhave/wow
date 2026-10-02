import {Timeline} from "@heroui-pro/react";
import {
  Avatar,
  Button,
  Chip,
  Dropdown,
  Label,
  Separator,
  Skeleton,
  Spinner,
  Tooltip,
} from "@heroui/react";
import {useSuspenseInfiniteQuery} from "@tanstack/react-query";
import {Link, useParams} from "@tanstack/react-router";
import {
  CircleCheckIcon,
  CircleIcon,
  FunnelIcon,
  KeyRoundIcon,
  LogInIcon,
  OctagonAlertIcon,
  PlusIcon,
  SignalIcon,
  TrashIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import type {Key, Selection} from "react-aria-components";
import {useInView} from "react-intersection-observer";
import {useFormatter, useNow} from "use-intl";
import {useLocalStorage} from "usehooks-ts";

import {gravatarUrl, UserHoverCard} from "@/components/user-hover-card";
import {useWorkspace} from "@/hooks/use-workspace";
import {ARRIVE_FROM_TOP, useMountedAt} from "@/lib/arrivals";
import {orpc} from "@/lib/orpc";
import {getPuzzleStatusGroups, getPuzzleStatusOptions} from "@/lib/puzzleStatuses";
import type {ActivityLogCursor, WorkspaceRoomState} from "@/server/do/workspace";

import {RelativeTime} from "./activity-log";

type Entry = WorkspaceRoomState["activityLogEntries"][number];
type TimelineStatus = "default" | "current" | "success" | "warning" | "danger" | "muted";

const EVENT_TYPES = [
  {id: "solves", label: "Solves"},
  {id: "status", label: "Status & importance changes"},
  {id: "answers", label: "Answers"},
  {id: "board", label: "Puzzles & rounds"},
  {id: "members", label: "Members joining"},
] as const;
type Filter = "all" | (typeof EVENT_TYPES)[number]["id"];

const isSolved = (status: string | null | undefined) =>
  status === "solved" || status === "backsolved";

function statusLabel(status: string | null) {
  return getPuzzleStatusOptions().find(option => option.value === status)?.label ?? "None";
}

/** Timeline/Chip tone for a puzzle status, following the board's status groups. */
function statusTone(status: string | null): "default" | "success" | "warning" | "danger" {
  const group = getPuzzleStatusGroups().find(g => g.values.some(v => v.value === status));
  if (group?.groupLabel === "Solved") return "success";
  if (group?.groupLabel === "Warning") return "warning";
  if (group?.groupLabel === "Stuck") return "danger";
  return "default";
}

function matchesFilter(entry: Entry, filter: Filter) {
  const puzzle = entry.puzzle_activity_log_entry;
  switch (filter) {
    case "all":
      return true;
    case "solves":
      return puzzle?.subType === "updateStatus" && isSolved(puzzle.field);
    case "status":
      return puzzle?.subType === "updateStatus" || puzzle?.subType === "updateImportance";
    case "answers":
      return puzzle?.subType === "updateAnswer";
    case "board":
      return (
        entry.round_activity_log_entry !== null ||
        puzzle?.subType === "create" ||
        puzzle?.subType === "delete"
      );
    case "members":
      return entry.workspace_activity_log_entry !== null;
    default:
      return false;
  }
}

/** Marker icon and tone: scan the rail for solves (green) and trouble (amber/red). */
function eventStyle(entry: Entry): {Icon: typeof CircleIcon; status: TimelineStatus} {
  const puzzle = entry.puzzle_activity_log_entry;
  const round = entry.round_activity_log_entry;
  if (entry.workspace_activity_log_entry) return {Icon: LogInIcon, status: "default"};
  if (round?.subType === "delete" || puzzle?.subType === "delete") {
    return {Icon: TrashIcon, status: "muted"};
  }
  if (round?.subType === "create" || puzzle?.subType === "create") {
    return {Icon: PlusIcon, status: "default"};
  }
  if (puzzle?.subType === "updateAnswer") return {Icon: KeyRoundIcon, status: "current"};
  if (puzzle?.subType === "updateImportance") return {Icon: SignalIcon, status: "muted"};
  if (puzzle?.subType === "updateStatus") {
    const tone = statusTone(puzzle.field);
    if (tone === "success") return {Icon: CircleCheckIcon, status: "success"};
    if (tone === "warning") return {Icon: TriangleAlertIcon, status: "warning"};
    if (tone === "danger") return {Icon: OctagonAlertIcon, status: "danger"};
  }
  return {Icon: CircleIcon, status: "default"};
}

function PuzzleName({workspaceSlug, entry}: {workspaceSlug: string; entry: Entry}) {
  const puzzle = entry.puzzle_activity_log_entry!;
  return puzzle.puzzleId ? (
    <Link
      to="/$workspaceSlug/puzzles/$puzzleId"
      params={{workspaceSlug, puzzleId: puzzle.puzzleId}}
      className="text-foreground font-medium hover:underline">
      {puzzle.puzzleName}
    </Link>
  ) : (
    <span className="text-foreground font-medium">{puzzle.puzzleName}</span>
  );
}

/** "solved X", "changed the answer of X to ABC", … with values as chips. */
function EventText({workspaceSlug, entry}: {workspaceSlug: string; entry: Entry}) {
  const puzzle = entry.puzzle_activity_log_entry;
  const round = entry.round_activity_log_entry;
  if (entry.workspace_activity_log_entry) return <>joined the workspace</>;
  if (round) {
    return (
      <>
        {round.subType === "delete" ? "deleted round" : "created round"}{" "}
        <span className="text-foreground font-medium">{round.roundName}</span>
      </>
    );
  }
  if (!puzzle) return null;
  const name = <PuzzleName workspaceSlug={workspaceSlug} entry={entry} />;
  switch (puzzle.subType) {
    case "create":
      return <>added {name}</>;
    case "delete":
      return <>deleted {name}</>;
    case "updateAnswer":
      return (
        <>
          set the answer of {name} to{" "}
          <Chip size="sm" variant="secondary" className="font-mono uppercase">
            {puzzle.field}
          </Chip>
        </>
      );
    case "updateImportance":
      return (
        <>
          marked {name}{" "}
          <Chip size="sm" variant="secondary">
            {puzzle.field ?? "normal"}
          </Chip>
        </>
      );
    case "updateStatus":
      return isSolved(puzzle.field) ? (
        <>
          {puzzle.field === "backsolved" ? "backsolved" : "solved"} {name}
        </>
      ) : (
        <>
          moved {name} to{" "}
          <Chip size="sm" variant="soft" color={statusTone(puzzle.field)}>
            {statusLabel(puzzle.field)}
          </Chip>
        </>
      );
    default:
      return <>updated {name}</>;
  }
}

function FeedItem({
  workspaceSlug,
  entry,
  mountedAt,
}: {
  workspaceSlug: string;
  entry: Entry;
  mountedAt: number;
}) {
  const format = useFormatter();
  const {Icon, status} = eventStyle(entry);
  const createdAt = new Date(entry.activity_log_entry.createdAt);
  const user = entry.user;
  return (
    <Timeline.Item
      align="center"
      status={status}
      className={createdAt.getTime() > mountedAt ? ARRIVE_FROM_TOP : undefined}>
      <Timeline.Marker aria-hidden="true">
        <Icon />
      </Timeline.Marker>
      <Timeline.Content>
        <div className="flex min-w-0 items-center justify-between gap-4">
          <p className="text-muted m-0 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            {user && (
              <UserHoverCard user={user}>
                <span className="text-foreground inline-flex cursor-default items-center gap-1.5 font-medium">
                  <Avatar className="size-5" size="sm">
                    <Avatar.Image
                      alt=""
                      src={user.image ?? gravatarUrl(user.email ?? "", {size: 64, d: "identicon"})}
                    />
                    <Avatar.Fallback className="text-[10px]">
                      {user.name.slice(0, 1)}
                    </Avatar.Fallback>
                  </Avatar>
                  {user.name}
                </span>
              </UserHoverCard>
            )}
            <EventText workspaceSlug={workspaceSlug} entry={entry} />
          </p>
          <Tooltip delay={300}>
            <Tooltip.Trigger>
              <time
                dateTime={createdAt.toISOString()}
                className="text-muted shrink-0 text-xs tabular-nums">
                {format.dateTime(createdAt, {hour: "numeric", minute: "2-digit"})}
              </time>
            </Tooltip.Trigger>
            <Tooltip.Content>
              {format.dateTime(createdAt, {dateStyle: "full", timeStyle: "short"})} ·{" "}
              <RelativeTime date={createdAt} />
            </Tooltip.Content>
          </Tooltip>
        </div>
      </Timeline.Content>
    </Timeline.Item>
  );
}

/** A multi-select menu's keys as strings ("all" expands to every option). */
const selected = (keys: Selection, all: string[]) => (keys === "all" ? all : [...keys].map(String));

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Today / Yesterday / weekday + date, for the sticky day headings. */
function useDayLabel() {
  const format = useFormatter();
  const now = useNow({updateInterval: 60_000});
  return (date: Date) => {
    const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
    if (daysAgo === 0) return "Today";
    if (daysAgo === 1) return "Yesterday";
    return format.dateTime(date, {weekday: "long", month: "short", day: "numeric"});
  };
}

/** The paged activity log; shared with the route loader, which prefetches the first page. */
export function activityLogQueryOptions(workspaceSlug: string) {
  return orpc.workspaces.activityLog.infiniteOptions({
    input: (cursor: ActivityLogCursor | null) => ({workspaceSlug, cursor}),
    initialPageParam: null,
    getNextPageParam: page => page.nextCursor,
  });
}

/** Shown only when the first page is slow (the route loader usually has it ready). */
export function ActivityFeedSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
      aria-busy="true"
      aria-label="Loading">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-4 w-24 rounded-lg" />
      {Array.from({length: 8}, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1 rounded-lg" />
          <Skeleton className="h-4 w-14 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed() {
  const {workspaceSlug} = useParams({from: "/_workspace/$workspaceSlug"});
  const dayLabel = useDayLabel();
  const mountedAt = useMountedAt();
  // Remembered per browser, like the blackboard's filters. Empty means "everything".
  const [types, setTypes] = useLocalStorage<Filter[]>("activityTypes", []);
  const [people, setPeople] = useLocalStorage<string[]>("activityPeople", []);
  // The room state carries the newest entries live; older ones load page by page as you scroll.
  const recent = useWorkspace().activityLogEntries;
  const {data, fetchNextPage, hasNextPage, isFetchingNextPage} = useSuspenseInfiniteQuery(
    activityLogQueryOptions(workspaceSlug)
  );
  // TanStack Query's infinite-scroll pattern: load the next page when the end comes into view.
  const {ref: endRef} = useInView({
    rootMargin: "400px",
    onChange: inView => {
      if (inView && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    },
  });

  const seen = new Set<string>();
  const time = (entry: Entry) => new Date(entry.activity_log_entry.createdAt).getTime();
  // Live entries and fetched pages overlap and can interleave: de-duplicate, newest first.
  const entries = [...recent, ...data.pages.flatMap(page => page.entries)]
    .filter(entry => {
      if (seen.has(entry.activity_log_entry.id)) return false;
      seen.add(entry.activity_log_entry.id);
      return true;
    })
    .toSorted((a, b) => time(b) - time(a));
  const days: {label: string; entries: Entry[]}[] = [];
  const isVisible = (entry: Entry) =>
    (types.length === 0 || types.some(type => matchesFilter(entry, type))) &&
    (people.length === 0 || (entry.user !== null && people.includes(entry.user.id)));
  // Everyone who appears in the loaded activity, for the People filter.
  const actors = [
    ...new Map(entries.flatMap(e => (e.user ? [[e.user.id, e.user] as const] : []))).values(),
  ].toSorted((x, y) => x.name.localeCompare(y.name));
  const filterCount = (types.length > 0 ? 1 : 0) + (people.length > 0 ? 1 : 0);

  for (const entry of entries.filter(isVisible)) {
    const label = dayLabel(new Date(entry.activity_log_entry.createdAt));
    if (days.at(-1)?.label === label) days.at(-1)!.entries.push(entry);
    else days.push({label, entries: [entry]});
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <Dropdown>
          <Button variant="outline">
            <FunnelIcon />
            Filter
            {filterCount > 0 && (
              <Chip className="ml-1 rounded-full" size="sm" variant="secondary">
                {filterCount}
              </Chip>
            )}
          </Button>
          <Dropdown.Popover className="w-fit" placement="bottom end">
            <Dropdown.Menu
              onAction={(key: Key) => {
                if (key === "reset") {
                  setTypes([]);
                  setPeople([]);
                }
              }}>
              <Dropdown.Section
                aria-label="Event types"
                selectionMode="multiple"
                selectedKeys={new Set<Key>(types)}
                onSelectionChange={keys =>
                  setTypes(
                    selected(
                      keys,
                      EVENT_TYPES.map(type => type.id)
                    ).flatMap(key => EVENT_TYPES.filter(type => type.id === key).map(t => t.id))
                  )
                }>
                {EVENT_TYPES.map(type => (
                  <Dropdown.Item key={type.id} id={type.id} textValue={type.label}>
                    <Dropdown.ItemIndicator />
                    <Label>{type.label}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Section>
              <Separator />
              <Dropdown.SubmenuTrigger>
                <Dropdown.Item id="people-submenu" textValue="People">
                  <UsersIcon />
                  <Label>People</Label>
                  <Dropdown.SubmenuIndicator />
                </Dropdown.Item>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    aria-label="People"
                    selectionMode="multiple"
                    selectedKeys={new Set<Key>(people)}
                    onSelectionChange={keys =>
                      setPeople(
                        selected(
                          keys,
                          actors.map(actor => actor.id)
                        )
                      )
                    }>
                    {actors.map(actor => (
                      <Dropdown.Item key={actor.id} id={actor.id} textValue={actor.name}>
                        <Dropdown.ItemIndicator />
                        <Label>{actor.name}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.SubmenuTrigger>
              <Separator />
              <Dropdown.Item id="reset" textValue="Reset filters">
                <Label>Reset filters</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
      {days.map(day => (
        <section key={day.label} className="flex flex-col gap-3">
          <div className="bg-background sticky top-0 z-10 flex items-center gap-3 py-1">
            <h2 className="text-muted m-0 shrink-0 text-xs font-medium tracking-wide uppercase">
              {day.label}
            </h2>
            <div className="bg-separator h-px flex-1" />
          </div>
          <Timeline density="compact" size="sm">
            {day.entries.map(entry => (
              <FeedItem
                key={entry.activity_log_entry.id}
                workspaceSlug={workspaceSlug}
                entry={entry}
                mountedAt={mountedAt}
              />
            ))}
          </Timeline>
        </section>
      ))}
      <div ref={endRef} className="flex justify-center py-4">
        {isFetchingNextPage && <Spinner size="sm" />}
        {!isFetchingNextPage && !hasNextPage && days.length === 0 && (
          <span className="text-muted text-sm">
            {filterCount === 0 ? "No activity yet." : "No matching activity."}
          </span>
        )}
      </div>
    </div>
  );
}
