import {
  Accordion,
  Button,
  buttonVariants,
  Card,
  Code,
  Kbd,
  Link as HeroLink,
  SearchField,
} from "@heroui/react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, useNavigate} from "@tanstack/react-router";
import {PlusIcon} from "lucide-react";
import {useEffect, useRef} from "react";
import {z} from "zod";

import {AddNewExchangeHuntDialog} from "@/components/add-new-exchange-hunt-dialog";
import {HuntListSkeleton} from "@/components/exchange-skeletons";
import {Grainient} from "@/components/grainient";
import {monthColors} from "@/lib/month-colors";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/")({
  // The search and the expanded archive years live in the URL, so links and Back keep them.
  // `years` is comma-separated, so shared links read ?years=2026,2019.
  validateSearch: z.object({q: z.string().optional(), years: z.string().optional()}),
  // Prefetch so the page renders with data instead of suspending (and flashing) on mount.
  loader: ({context: {queryClient}}) =>
    Promise.all([
      queryClient.ensureQueryData(orpc.exchange.hunts.list.queryOptions()),
      queryClient.ensureQueryData(orpc.exchange.isAdmin.queryOptions()),
    ]),
  pendingComponent: HuntListSkeleton,
  component: RouteComponent,
});

type Hunt = ReturnType<typeof useHunts>[number];
const useHunts = () => useSuspenseQuery(orpc.exchange.hunts.list.queryOptions()).data;

const yearOf = (hunt: Hunt) => String(new Date(hunt.createdAt).getFullYear());
/** Accent- and case-insensitive, so "eulogy" finds "Éulogy" and "march" finds "March 2026". */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function RouteComponent() {
  const hunts = useHunts();
  const isAdmin = useSuspenseQuery(orpc.exchange.isAdmin.queryOptions()).data;
  const {q = ""} = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});
  const setQuery = (value: string) =>
    void navigate({search: prev => ({...prev, q: value || undefined}), replace: true});

  // Drafts get their own admin-only section; the newest published hunt is featured; the rest
  // (minus empty months, which only matter while they're the latest) is the archive.
  const published = hunts.filter(hunt => !hunt.draft);
  const drafts = hunts.filter(hunt => hunt.draft);
  const [latest, ...older] = published;
  const archive = older.filter(hunt => hunt.hunt_puzzles.length > 0);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-2xl flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Wafflehaüs Puzzle Exchange</h1>
            <p className="text-muted">
              Every month, Wafflehaüs releases a small number of approachable, short, Hunt-length
              puzzles written by team members, as well as spotlighting puzzles from other hunts.
            </p>
          </div>
          {isAdmin && (
            <AddNewExchangeHuntDialog>
              <Button>
                <PlusIcon />
                Create Hunt
              </Button>
            </AddNewExchangeHuntDialog>
          )}
        </div>
        <PuzzleSearch value={q} onChange={setQuery} />
      </header>

      {q.trim() ? (
        <SearchResults hunts={isAdmin ? hunts : published} query={q} />
      ) : (
        <>
          {isAdmin && drafts.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Drafts</h2>
              <HuntRows hunts={drafts} />
            </section>
          )}
          {latest && <LatestHunt hunt={latest} issue={published.length} />}
          {archive.length > 0 && <Archive hunts={archive} />}
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="secondary" className="gap-3 p-6">
          <Card.Header>
            <Card.Title className="text-base font-semibold">Interested in solving?</Card.Title>
          </Card.Header>
          <Card.Content className="text-muted gap-3 text-sm">
            <p>
              Feel free to solve by yourself or with friends! Once you've solved the puzzle, go
              react to the corresponding Discord message!
            </p>
            <p>
              There has been a WOW workspace set up for your convenience called{" "}
              <HeroLink
                target="_blank"
                rel="noopener noreferrer"
                href="https://www.wafflehaus.io/wpe">
                WPE
              </HeroLink>
              . The password is <Code>sumhint</Code>. Please be courteous! You're sharing this
              workspace with the whole team. See instructions on the workspace itself.
            </p>
          </Card.Content>
        </Card>
        <Card variant="secondary" className="gap-3 p-6">
          <Card.Header>
            <Card.Title className="text-base font-semibold">Interested in writing?</Card.Title>
          </Card.Header>
          <Card.Content className="text-muted gap-3 text-sm">
            <p>Reach out to Allen on Discord!</p>
          </Card.Content>
          <Card.Footer>
            <Link to="/exchange/writing" className={buttonVariants({variant: "outline"})}>
              Learn about writing WPE puzzles
            </Link>
          </Card.Footer>
        </Card>
      </div>
    </div>
  );
}

function PuzzleSearch({value, onChange}: {value: string; onChange: (value: string) => void}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // "/" jumps to the search, as on the blackboard.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const isTyping = target?.closest("input, textarea, [contenteditable=true]");
      if (e.key === "/" && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return (
    <SearchField
      aria-label="Search puzzles"
      className="w-full max-w-md"
      value={value}
      onChange={onChange}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input ref={inputRef} placeholder="Search puzzles by title or month…" />
        <SearchField.ClearButton />
        {!value && (
          <Kbd className="me-2 hidden sm:inline-flex" aria-hidden="true">
            <Kbd.Content>/</Kbd.Content>
          </Kbd>
        )}
      </SearchField.Group>
    </SearchField>
  );
}

function SearchResults({hunts, query}: {hunts: Hunt[]; query: string}) {
  const needle = fold(query.trim());
  const results = hunts.flatMap(hunt => {
    const huntMatches = fold(hunt.name).includes(needle);
    return hunt.hunt_puzzles
      .filter(puzzle => huntMatches || fold(puzzle.title).includes(needle))
      .map(puzzle => ({puzzle, hunt}));
  });
  return (
    <section className="flex flex-col gap-2" aria-live="polite">
      <h2 className="text-muted text-sm">
        {results.length === 0
          ? `No puzzles match “${query.trim()}”.`
          : `${results.length} ${results.length === 1 ? "puzzle" : "puzzles"}`}
      </h2>
      {results.length > 0 && (
        <ul className="flex flex-col">
          {results.map(({puzzle, hunt}) => (
            <li key={puzzle.id}>
              <Link
                to="/exchange/puzzles/$huntPuzzleId"
                params={{huntPuzzleId: puzzle.id}}
                className={buttonVariants({
                  variant: "ghost",
                  fullWidth: true,
                  className: "h-auto justify-between gap-4 px-3 py-2.5 font-normal",
                })}>
                <span className="flex min-w-0 items-center gap-3">
                  <MonthDot date={hunt.createdAt} />
                  <span className="truncate font-medium">{puzzle.title}</span>
                </span>
                <span className="text-muted shrink-0 text-sm">{hunt.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "September 2026" → month and year at different weights; other names as they are. */
function splitHuntName(name: string) {
  const match = /^(.*\S)\s+(\d{4})$/.exec(name);
  return match ? {title: match[1]!, year: match[2]} : {title: name, year: undefined};
}

/** The newest month, with its puzzles one click away. */
function LatestHunt({hunt, issue}: {hunt: Hunt; issue: number}) {
  const {title, year} = splitHuntName(hunt.name);
  return (
    // The month's "cover": its colours as a slowly moving grainy gradient, like a magazine issue.
    // The whole cover opens the hunt (the title link is stretched over it); the puzzle pills sit
    // above that and open their puzzles.
    <section className="group relative isolate overflow-hidden rounded-3xl text-white">
      <Grainient colors={monthColors(hunt.createdAt)} className="absolute inset-0 -z-10" />
      {/* Keeps white text readable on the lightest parts of any month's gradient. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/35 to-black/10 transition-opacity group-hover:opacity-80" />
      <div className="flex min-h-72 flex-col justify-between gap-8 p-6 md:p-10">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-medium text-white/80 tabular-nums">No. {issue}</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            Latest
          </span>
        </div>
        <div className="flex flex-col gap-5">
          <Link
            to="/exchange/hunts/$huntId"
            params={{huntId: hunt.id}}
            className="flex w-fit flex-col after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-white">
            <span className="text-5xl font-bold tracking-tight group-hover:underline md:text-6xl">
              {title}
            </span>
            {year && <span className="text-lg text-white/80 tabular-nums">{year}</span>}
          </Link>
          {hunt.hunt_puzzles.length === 0 ? (
            <p className="text-white/80">Puzzles coming soon.</p>
          ) : (
            <ul className="relative z-10 flex flex-wrap gap-2">
              {hunt.hunt_puzzles.map(puzzle => (
                <li key={puzzle.id}>
                  <Link
                    to="/exchange/puzzles/$huntPuzzleId"
                    params={{huntPuzzleId: puzzle.id}}
                    className="block rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur transition-colors hover:bg-white/25">
                    {puzzle.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** Older months, one compact row each, grouped by year; only the newest year starts open. */
function Archive({hunts}: {hunts: Hunt[]}) {
  const {years} = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});
  const groups = Map.groupBy(hunts, yearOf);
  const allYears = [...groups.keys()];
  const expanded = years !== undefined ? years.split(",").filter(Boolean) : allYears.slice(0, 1);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Archive</h2>
      <Accordion
        allowsMultipleExpanded
        expandedKeys={new Set(expanded)}
        onExpandedChange={keys =>
          void navigate({
            search: prev => ({...prev, years: [...keys].map(String).join(",")}),
            replace: true,
          })
        }>
        {allYears.map(year => {
          const yearHunts = groups.get(year) ?? [];
          return (
            <Accordion.Item key={year} id={year}>
              {/* Stays in view while scrolling through a long year. */}
              <Accordion.Heading className="bg-background sticky top-0 z-10">
                <Accordion.Trigger>
                  <span className="flex items-baseline gap-2">
                    {year}
                    <span className="text-muted text-sm font-normal tabular-nums">
                      {yearHunts.length} {yearHunts.length === 1 ? "month" : "months"}
                    </span>
                  </span>
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body>
                  <HuntRows hunts={yearHunts} year={year} />
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </section>
  );
}

/** One row per hunt; under a year heading, "March 2026" shows as just "March". */
function HuntRows({hunts, year}: {hunts: Hunt[]; year?: string}) {
  return (
    <ul className="flex flex-col">
      {hunts.map(hunt => {
        const count = hunt.hunt_puzzles.length;
        return (
          <li key={hunt.id}>
            <Link
              to="/exchange/hunts/$huntId"
              params={{huntId: hunt.id}}
              className={buttonVariants({
                variant: "ghost",
                fullWidth: true,
                className: "h-auto justify-between gap-4 px-3 py-2.5 font-normal",
              })}>
              <span className="flex min-w-0 items-center gap-3">
                <MonthDot date={hunt.createdAt} />
                <span className="truncate font-medium">
                  {year && splitHuntName(hunt.name).year === year
                    ? splitHuntName(hunt.name).title
                    : hunt.name}
                </span>
              </span>
              <span className="text-muted shrink-0 text-sm tabular-nums">
                {count} {count === 1 ? "puzzle" : "puzzles"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** A small swatch of the month's colour, tying rows and results to their month. */
function MonthDot({date}: {date: Date}) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full"
      style={{backgroundColor: monthColors(date)[1]}}
    />
  );
}
