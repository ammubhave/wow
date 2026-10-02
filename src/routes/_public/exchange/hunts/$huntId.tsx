import {Breadcrumbs, Button, buttonVariants, Chip, Code} from "@heroui/react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, PlusIcon} from "lucide-react";

import {AddNewExchangePuzzleDialog} from "@/components/add-new-exchange-puzzle-dialog";
import {ChangeExchangeHuntDraftSwitch} from "@/components/change-exchange-hunt-draft-switch";
import {ExchangeCover} from "@/components/exchange-cover";
import {HuntListSkeleton} from "@/components/exchange-skeletons";
import {huntDate, issueNumbers, sortHunts} from "@/lib/exchange-hunts";
import {monthColors} from "@/lib/month-colors";
import {orpc} from "@/lib/orpc";

// The month's colours, set on the page and used by the puzzle tiles.
declare module "react" {
  interface CSSProperties {
    "--month-light"?: string;
    "--month-mid"?: string;
  }
}

export const Route = createFileRoute("/_public/exchange/hunts/$huntId")({
  // Prefetch so the page renders with data instead of suspending (and flashing) on mount. The
  // hunt list gives the issue number and the previous/next months.
  loader: async ({context: {queryClient}, params: {huntId}}) => {
    const [hunt] = await Promise.all([
      queryClient.ensureQueryData(orpc.exchange.hunts.get.queryOptions({input: {huntId}})),
      queryClient.ensureQueryData(orpc.exchange.hunts.list.queryOptions()),
      queryClient.ensureQueryData(orpc.exchange.isAdmin.queryOptions()),
    ]);
    return {title: hunt.name};
  },
  head: ({loaderData}) => ({
    meta: [{title: `${loaderData?.title ?? "Hunt"} | Wafflehaüs Puzzle Exchange`}],
  }),
  pendingComponent: HuntListSkeleton,
  component: RouteComponent,
});

function RouteComponent() {
  const {huntId} = Route.useParams();
  const hunt = useSuspenseQuery(orpc.exchange.hunts.get.queryOptions({input: {huntId}})).data;
  const allHunts = useSuspenseQuery(orpc.exchange.hunts.list.queryOptions()).data;
  const isAdmin = useSuspenseQuery(orpc.exchange.isAdmin.queryOptions()).data;

  // Neighbouring published months with puzzles, newest first, for browsing month to month.
  const months = sortHunts(allHunts.filter(h => !h.draft && h.hunt_puzzles.length > 0));
  const index = months.findIndex(h => h.id === huntId);
  const newer = index > 0 ? months[index - 1] : undefined;
  const older = index >= 0 ? months[index + 1] : undefined;
  const isLatest = sortHunts(allHunts.filter(h => !h.draft))[0]?.id === huntId;
  const [light, mid] = monthColors(huntDate(hunt));
  const count = hunt.hunt_puzzles.length;

  return (
    <div
      className="flex flex-col gap-8"
      // The month's colour, for the puzzle numbers and tile highlights below.
      style={{"--month-light": light, "--month-mid": mid}}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/exchange">Puzzle Exchange</Breadcrumbs.Item>
          <Breadcrumbs.Item>{hunt.name}</Breadcrumbs.Item>
        </Breadcrumbs>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <ChangeExchangeHuntDraftSwitch huntId={huntId} />
            <AddNewExchangePuzzleDialog huntId={huntId}>
              <Button size="sm">
                <PlusIcon />
                Create Puzzle
              </Button>
            </AddNewExchangePuzzleDialog>
          </div>
        )}
      </div>

      <ExchangeCover
        hunt={hunt}
        issue={issueNumbers(allHunts).get(huntId)}
        badge={hunt.draft ? "Draft" : isLatest ? "Latest" : undefined}>
        <p className="text-white/80 tabular-nums">
          {count === 0 ? "Puzzles coming soon." : `${count} ${count === 1 ? "puzzle" : "puzzles"}`}
        </p>
      </ExchangeCover>

      {count > 0 && (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hunt.hunt_puzzles.map((puzzle, i) => (
            <li key={puzzle.id}>
              <Link
                to={
                  puzzle.needsSetup
                    ? "/exchange/puzzles/$huntPuzzleId/edit"
                    : "/exchange/puzzles/$huntPuzzleId"
                }
                params={{huntPuzzleId: puzzle.id}}
                className="group bg-surface hover:bg-surface-secondary flex h-full min-h-40 flex-col justify-between gap-6 border border-transparent p-6 transition-colors hover:border-[var(--month-mid)]">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-4xl font-bold text-[var(--month-mid)] tabular-nums dark:text-[var(--month-light)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <ArrowUpRightIcon className="text-muted size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-lg font-semibold text-balance">{puzzle.title}</span>
                  {puzzle.draft && (
                    <Chip size="sm" className="w-fit">
                      Draft
                    </Chip>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <p className="text-muted text-sm">
        Solving with friends? Use the shared{" "}
        <a
          href="https://www.wafflehaus.io/wpe"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-4">
          WPE workspace
        </a>{" "}
        (password <Code>sumhint</Code>), and react to the puzzle's Discord message once you've
        solved it.
      </p>

      {(newer || older) && (
        <nav
          aria-label="Other months"
          className="border-separator flex justify-between gap-4 border-t pt-6">
          {older ? <MonthLink hunt={older} direction="older" /> : <span />}
          {newer && <MonthLink hunt={newer} direction="newer" />}
        </nav>
      )}
    </div>
  );
}

function MonthLink({
  hunt,
  direction,
}: {
  hunt: {id: string; name: string; createdAt: Date};
  direction: "older" | "newer";
}) {
  const isNewer = direction === "newer";
  return (
    <Link
      to="/exchange/hunts/$huntId"
      params={{huntId: hunt.id}}
      className={buttonVariants({variant: "ghost", className: "gap-3"})}>
      {!isNewer && <ArrowLeftIcon />}
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full"
        style={{backgroundColor: monthColors(huntDate(hunt))[1]}}
      />
      {hunt.name}
      {isNewer && <ArrowRightIcon />}
    </Link>
  );
}
