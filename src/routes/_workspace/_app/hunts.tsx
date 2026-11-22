import {
  Button,
  buttonVariants,
  Card,
  Chip,
  EmptyState,
  SearchField,
  Skeleton,
  Tabs,
} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GlobeIcon,
  MapPinIcon,
  SparklesIcon,
} from "lucide-react";
import {useState} from "react";
import {cn} from "tailwind-variants";
import {z} from "zod";

import {Page} from "@/components/page";
import {when, where} from "@/hooks/use-hunt-suggestions";
import {orpc} from "@/lib/orpc";
import type {RouterOutputs} from "@/server/router";

export const Route = createFileRoute("/_workspace/_app/hunts")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Puzzle hunts | WOW"}]}),
  // The view and filters live in the URL, so a link shows what you saw.
  validateSearch: z.object({
    view: z.enum(["list", "calendar"]).optional(),
    kind: z.enum(["all", "online", "in-person"]).optional(),
  }),
});

type Hunt = RouterOutputs["huntListings"]["range"][number];
type Kind = "all" | "online" | "in-person";

const DAY_MS = 24 * 60 * 60 * 1000;
/** The list shows hunts that ended this recently, and up to this far ahead. */
const LIST_BEHIND_MS = 3 * DAY_MS;
const LIST_AHEAD_MS = 400 * DAY_MS;

const pad = (n: number) => String(n).padStart(2, "0");
/** A local calendar day, as "2026-11-27" (sorts as text). */
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const utcDay = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** The first and last calendar days a hunt runs (all-day dates are UTC midnights, end exclusive). */
function huntDays(hunt: Hunt) {
  return hunt.allDay
    ? {first: utcDay(hunt.startsAt), last: utcDay(new Date(hunt.endsAt.getTime() - DAY_MS))}
    : {first: localDay(hunt.startsAt), last: localDay(new Date(hunt.endsAt.getTime() - 1))};
}

/** In person somewhere (hybrid hunts count as both). */
const isInPerson = (hunt: Hunt) => hunt.location !== null && !/^\s*online\s*$/i.test(hunt.location);

function matches(hunt: Hunt, kind: Kind, query: string) {
  if (kind === "online" && !hunt.isOnline) return false;
  if (kind === "in-person" && !isInPerson(hunt)) return false;
  const q = query.trim().toLowerCase();
  return !q || [hunt.name, hunt.note, hunt.location].some(text => text?.toLowerCase().includes(q));
}

function PlaceIcon({hunt, className}: {hunt: Hunt; className?: string}) {
  return isInPerson(hunt) && !/\bonline\b/i.test(hunt.location ?? "") ? (
    <MapPinIcon className={className} aria-hidden="true" />
  ) : (
    <GlobeIcon className={className} aria-hidden="true" />
  );
}

/** What to do about a hunt: open your workspace for it, or set one up; and its website. */
function HuntActions({hunt}: {hunt: Hunt}) {
  return (
    <div className="ms-16 flex shrink-0 items-center gap-1.5 sm:ms-0">
      {hunt.mySlug ? (
        <Link
          to="/$workspaceSlug"
          params={{workspaceSlug: hunt.mySlug}}
          className={buttonVariants({size: "sm", variant: "secondary"})}>
          Your workspace
          <ArrowRightIcon />
        </Link>
      ) : (
        <Link
          to="/workspaces/create"
          search={{hunt: hunt.id, event: hunt.name}}
          aria-label={`Set up workspace: ${hunt.name}`}
          className={buttonVariants({size: "sm", variant: "secondary"})}>
          <SparklesIcon />
          Set up workspace
        </Link>
      )}
      {hunt.url && (
        <a
          href={hunt.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${hunt.name} website`}
          title="Hunt website"
          className={buttonVariants({size: "sm", variant: "ghost", isIconOnly: true})}>
          <ArrowUpRightIcon />
        </a>
      )}
    </div>
  );
}

/** A hunt as a row: a date tile, its name and details, and what to do about it. */
function HuntRow({hunt, now}: {hunt: Hunt; now: number}) {
  const isLive = hunt.startsAt.getTime() <= now && now < hunt.endsAt.getTime();
  const start = hunt.startsAt;
  const tz = hunt.allDay ? "UTC" : undefined;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap">
      <div
        className={cn(
          "flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none",
          isLive ? "bg-success/15 text-success" : "bg-default text-foreground"
        )}
        aria-hidden="true">
        <span className="text-[10px] font-semibold tracking-wide uppercase">
          {start.toLocaleDateString(undefined, {month: "short", timeZone: tz})}
        </span>
        <span className="text-lg font-bold tabular-nums">
          {start.toLocaleDateString(undefined, {day: "numeric", timeZone: tz})}
        </span>
      </div>
      {/* At least this wide, so on a phone the actions wrap below instead of squeezing it. */}
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5 sm:basis-auto">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-semibold">{hunt.name}</span>
          {isLive && (
            <Chip size="sm" color="success" variant="soft">
              Live
            </Chip>
          )}
        </div>
        <p className="text-muted flex min-w-0 items-center gap-1.5 text-xs">
          <PlaceIcon hunt={hunt} className="size-3.5 shrink-0" />
          <span className="truncate">
            {[when(hunt), where(hunt), hunt.note].filter(Boolean).join(" · ")}
          </span>
        </p>
      </div>
      <HuntActions hunt={hunt} />
    </div>
  );
}

const monthTitle = (d: Date, tz?: string) =>
  d.toLocaleDateString(undefined, {month: "long", year: "numeric", timeZone: tz});

/** Running now first, then the months in order, then what just ended. */
const groupOrder = (title: string) =>
  title === "Happening now" ? 0 : title === "Just ended" ? 2 : 1;

/** Upcoming hunts, a group per month (what's running now first). */
function ListView({hunts, now}: {hunts: Hunt[]; now: number}) {
  const groups: {title: string; hunts: Hunt[]}[] = [];
  for (const hunt of hunts) {
    const title =
      hunt.startsAt.getTime() <= now && now < hunt.endsAt.getTime()
        ? "Happening now"
        : hunt.endsAt.getTime() <= now
          ? "Just ended"
          : monthTitle(hunt.startsAt, hunt.allDay ? "UTC" : undefined);
    const group = groups.find(g => g.title === title);
    if (group) group.hunts.push(hunt);
    else groups.push({title, hunts: [hunt]});
  }
  return (
    <div className="flex flex-col gap-6">
      {groups
        .toSorted((a, b) => groupOrder(a.title) - groupOrder(b.title))
        .map(group => (
          <section key={group.title} className="flex flex-col gap-2">
            <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">
              {group.title}
            </h2>
            <Card className="divide-separator gap-0 divide-y p-0">
              {group.hunts.map(hunt => (
                <HuntRow key={hunt.id} hunt={hunt} now={now} />
              ))}
            </Card>
          </section>
        ))}
    </div>
  );
}

const WEEKDAYS = Array.from({length: 7}, (_, i) =>
  new Date(2026, 10, 1 + i).toLocaleDateString(undefined, {weekday: "short"})
);
/** At most this many hunts named in a day; the rest are "+N more". */
const PER_DAY = 3;
/** Longer than this, a hunt (a months-long trail, say) goes above the grid, not in every day. */
const LONG_RUNNING_DAYS = 14;

/** Its pill colours: online (or online too) in the accent, in person only in teal. */
const pillTone = (hunt: Hunt) =>
  hunt.isOnline ? "bg-accent/20 text-accent" : "bg-teal-500/20 text-teal-700 dark:text-teal-300";

/** A month grid: each day lists the hunts running then; pick one to see it below. */
function CalendarView({month, hunts, now}: {month: Date; hunts: Hunt[] | undefined; now: number}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const weeks = Math.ceil(
    (first.getDay() + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7
  );
  const days = Array.from(
    {length: weeks * 7},
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
  );
  const isLong = (hunt: Hunt) =>
    hunt.endsAt.getTime() - hunt.startsAt.getTime() > LONG_RUNNING_DAYS * DAY_MS;
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  // Only the ones running during this month (the grid's spill-over days don't count).
  const longRunning = (hunts ?? []).filter(
    hunt =>
      isLong(hunt) && hunt.startsAt.getTime() < monthEnd && hunt.endsAt.getTime() > month.getTime()
  );
  const spans = (hunts ?? [])
    .filter(hunt => !isLong(hunt))
    .map(hunt => Object.assign({hunt}, huntDays(hunt)));
  const today = localDay(new Date(now));
  const selected = hunts?.find(hunt => hunt.id === selectedId);
  return (
    <div className="flex flex-col gap-4">
      {longRunning.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Also this month:</span>
          {longRunning.map(hunt => (
            <button
              key={hunt.id}
              type="button"
              onClick={() => setSelectedId(hunt.id)}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-opacity hover:opacity-80",
                pillTone(hunt),
                selectedId === hunt.id && "ring-foreground ring-1"
              )}>
              {hunt.name} <span className="opacity-70">· {when(hunt)}</span>
            </button>
          ))}
        </div>
      )}
      <Card className="overflow-hidden p-0">
        <div className="border-separator text-muted grid grid-cols-7 border-b text-center text-xs font-medium">
          {WEEKDAYS.map(day => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = localDay(day);
            const running = spans.filter(span => span.first <= key && key <= span.last);
            const inMonth = day.getMonth() === month.getMonth();
            return (
              <div
                key={key}
                className={cn(
                  "border-separator flex min-h-24 min-w-0 flex-col gap-1 border-t p-1 sm:min-h-28 sm:p-1.5",
                  i % 7 !== 0 && "border-l",
                  i < 7 && "border-t-0",
                  !inMonth && "bg-default/30"
                )}>
                <span
                  className={cn(
                    "self-end text-xs tabular-nums",
                    key === today
                      ? "bg-accent text-accent-foreground flex size-5 items-center justify-center rounded-full font-semibold"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted"
                  )}>
                  {day.getDate()}
                </span>
                {running.slice(0, PER_DAY).map(({hunt, first: start, last}) => (
                  <button
                    key={hunt.id}
                    type="button"
                    onClick={() => setSelectedId(hunt.id)}
                    title={hunt.name}
                    className={cn(
                      "truncate rounded px-1.5 py-0.5 text-start text-[11px] leading-tight font-medium transition-opacity hover:opacity-80",
                      pillTone(hunt),
                      selectedId === hunt.id && "ring-foreground ring-1",
                      // Carried on from the day before (not the hunt's first day, nor a new week).
                      key !== start && i % 7 !== 0 && "rounded-s-none",
                      key !== last && i % 7 !== 6 && "rounded-e-none"
                    )}>
                    {hunt.name}
                  </button>
                ))}
                {running.length > PER_DAY && (
                  <span className="text-muted px-1 text-[11px]">
                    +{running.length - PER_DAY} more
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <div className="text-muted flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-accent/40 size-2.5 rounded-sm" aria-hidden="true" />
          Online (or online too)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-teal-500/40" aria-hidden="true" />
          In person only
        </span>
        {!hunts && <span>Loading…</span>}
      </div>
      {selected && (
        <Card className="p-0">
          <HuntRow hunt={selected} now={now} />
        </Card>
      )}
    </div>
  );
}

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const view = search.view ?? "list";
  const kind = search.kind ?? "all";
  const [query, setQuery] = useState("");
  const [now] = useState(() => Date.now());
  const [month, setMonth] = useState(() => {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // The list: what's on now and coming up. The calendar: the shown month (past ones too).
  const range =
    view === "list"
      ? {from: now - LIST_BEHIND_MS, to: now + LIST_AHEAD_MS}
      : {
          // A week either side covers the grid's spill-over days.
          from: month.getTime() - 7 * DAY_MS,
          to: new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime() + 7 * DAY_MS,
        };
  const {data} = useQuery({
    ...orpc.huntListings.range.queryOptions({input: range}),
    staleTime: 10 * 60 * 1000,
    placeholderData: previous => previous,
  });
  const hunts = data?.filter(hunt => matches(hunt, kind, query));

  return (
    <Page
      title="Puzzle hunts"
      actions={
        <Tabs
          selectedKey={view}
          onSelectionChange={key =>
            void navigate({
              search: prev => ({...prev, view: key === "calendar" ? "calendar" : undefined}),
            })
          }>
          <Tabs.ListContainer>
            <Tabs.List aria-label="View">
              <Tabs.Tab id="list" className="h-8 px-3 text-sm">
                List
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="calendar" className="h-8 px-3 text-sm">
                Calendar
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      }>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchField
            aria-label="Search hunts"
            value={query}
            onChange={setQuery}
            variant="secondary"
            className="w-full sm:w-64">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search hunts" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Tabs
            selectedKey={kind}
            onSelectionChange={key =>
              void navigate({
                search: prev => ({
                  ...prev,
                  kind: key === "online" || key === "in-person" ? key : undefined,
                }),
              })
            }>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Where">
                {(
                  [
                    ["all", "All"],
                    ["online", "Online"],
                    ["in-person", "In person"],
                  ] as const
                ).map(([id, label]) => (
                  <Tabs.Tab key={id} id={id} className="h-8 px-3 text-sm whitespace-nowrap">
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </div>
        {view === "calendar" && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label="Previous month"
              onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <ChevronLeftIcon />
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold">{monthTitle(month)}</span>
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label="Next month"
              onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
              <ChevronRightIcon />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                const d = new Date();
                setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
              }}>
              Today
            </Button>
          </div>
        )}
      </div>
      {view === "calendar" ? (
        <CalendarView month={month} hunts={hunts} now={now} />
      ) : !hunts ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : hunts.length === 0 ? (
        <EmptyState className="border-separator rounded-2xl border border-dashed py-12">
          No hunts match. Try another search, or All.
        </EmptyState>
      ) : (
        <ListView hunts={hunts} now={now} />
      )}
      <p className="text-muted text-xs">
        Listings from the{" "}
        <a
          href="https://puzzlehuntcalendar.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground underline">
          Puzzle Hunt Calendar
        </a>
        , refreshed every few hours. Running a hunt? Send it to them to be listed.
      </p>
    </Page>
  );
}
