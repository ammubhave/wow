import {Avatar, buttonVariants, Card, Skeleton} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";

import {userAvatarSrc, userInitials} from "@/components/user-hover-card";
import {formatPuzzleTime} from "@/hooks/use-puzzle-time";
import {orpc} from "@/lib/orpc";
import type {RouterOutputs} from "@/server/router";

export const Route = createFileRoute("/_workspace/_app/stats")({
  component: RouteComponent,
  head: () => ({meta: [{title: "My stats | WOW"}]}),
});

type Stats = RouterOutputs["me"]["stats"];

const isSolved = (status: string | null) => status === "solved" || status === "backsolved";

/** Hours and minutes, for totals: "12h 05m", "42m". */
function formatHours(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

const hourLabel = (hour: number) =>
  new Intl.DateTimeFormat(undefined, {hour: "numeric"}).format(new Date(2000, 0, 1, hour));

function computeStats(stats: Stats) {
  const puzzles = new Map(stats.puzzles.map(p => [p.id, p]));
  const helped = new Set(stats.helped);
  const solvedByMe = stats.puzzles.filter(p => helped.has(p.id) && isSolved(p.status));

  const byHour = Array.from({length: 24}, () => 0);
  const byPuzzle = new Map<string, number>();
  const byWorkspace = new Map<string, number>();
  let total = 0;
  for (const row of stats.time) {
    total += row.seconds;
    byHour[row.localHour] = (byHour[row.localHour] ?? 0) + row.seconds;
    byPuzzle.set(row.puzzleId, (byPuzzle.get(row.puzzleId) ?? 0) + row.seconds);
    byWorkspace.set(row.workspaceId, (byWorkspace.get(row.workspaceId) ?? 0) + row.seconds);
  }

  // Time by puzzle tag; untagged puzzles aren't a "type", so they're left out.
  const byTag = new Map<string, number>();
  for (const [puzzleId, seconds] of byPuzzle) {
    for (const tag of puzzles.get(puzzleId)?.tags ?? []) {
      byTag.set(tag, (byTag.get(tag) ?? 0) + seconds);
    }
  }

  const longest = [...byPuzzle]
    .filter(([id]) => puzzles.has(id))
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, seconds]) => ({puzzle: puzzles.get(id)!, seconds}));

  const workspaces = stats.workspaces
    .map(w => ({
      ...w,
      seconds: byWorkspace.get(w.id) ?? 0,
      solved: solvedByMe.filter(p => p.workspaceId === w.id).length,
    }))
    .filter(w => w.seconds > 0 || w.solved > 0)
    .toSorted((a, b) => b.createdAt - a.createdAt);

  const peakHour = total > 0 ? byHour.indexOf(Math.max(...byHour)) : null;

  return {
    total,
    solved: solvedByMe.length,
    metas: solvedByMe.filter(p => p.isMetaPuzzle).length,
    hunts: workspaces.length,
    byHour: byHour.map((seconds, hour) => ({hour, seconds})),
    peakHour,
    tags: [...byTag].toSorted((a, b) => b[1] - a[1]).slice(0, 6),
    longest,
    workspaces,
  };
}

function RouteComponent() {
  const {data} = useQuery(orpc.me.stats.queryOptions());
  return (
    <div className="flex w-full flex-1 justify-center">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <div>
          <Link to="/workspaces" className={buttonVariants({variant: "ghost", size: "sm"})}>
            <ArrowLeftIcon /> Back
          </Link>
        </div>
        <h1 className="text-2xl font-semibold">My stats</h1>
        {data ? (
          <StatsBody stats={data} />
        ) : (
          <>
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </>
        )}
      </div>
    </div>
  );
}

function StatsBody({stats}: {stats: Stats}) {
  const s = computeStats(stats);
  if (s.total === 0 && s.solved === 0) {
    return (
      <Card>
        <Card.Content className="text-muted py-8 text-center text-sm">
          Nothing here yet. Open a puzzle and start solving: your time on puzzles and the puzzles
          you mark &ldquo;I helped&rdquo; show up here.
        </Card.Content>
      </Card>
    );
  }
  const maxHour = Math.max(...s.byHour.map(h => h.seconds), 1);
  const maxTag = s.tags[0]?.[1] ?? 1;
  return (
    <>
      <Card>
        <Card.Content>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              [String(s.solved), s.solved === 1 ? "puzzle helped solve" : "puzzles helped solve"],
              [String(s.metas), s.metas === 1 ? "meta" : "metas"],
              [formatHours(s.total), "on puzzles"],
              [String(s.hunts), s.hunts === 1 ? "hunt" : "hunts"],
            ].map(([value, label]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-muted order-2 text-xs">{label}</dt>
                <dd className="order-1 text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </Card.Content>
      </Card>

      {s.total > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>When you puzzle</Card.Title>
            {s.peakHour !== null && (
              <Card.Description>
                Most active around {hourLabel(s.peakHour)}, your local time.
              </Card.Description>
            )}
          </Card.Header>
          <Card.Content>
            <div className="flex h-24 items-end gap-0.5" aria-hidden>
              {s.byHour.map(({hour, seconds}) => (
                <div
                  key={hour}
                  title={`${hourLabel(hour)}: ${formatHours(seconds)}`}
                  className="bg-accent min-h-px flex-1 rounded-t-sm"
                  style={{height: `${(seconds / maxHour) * 100}%`, opacity: seconds ? 1 : 0.15}}
                />
              ))}
            </div>
            <div className="text-muted mt-1 flex justify-between text-xs">
              <span>{hourLabel(0)}</span>
              <span>{hourLabel(6)}</span>
              <span>{hourLabel(12)}</span>
              <span>{hourLabel(18)}</span>
              <span>{hourLabel(23)}</span>
            </div>
          </Card.Content>
        </Card>
      )}

      {s.tags.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Favourite puzzle types</Card.Title>
            <Card.Description>Time on puzzles, by tag.</Card.Description>
          </Card.Header>
          <Card.Content>
            <ul className="flex flex-col gap-2 text-sm">
              {s.tags.map(([tag, seconds]) => (
                <li key={tag} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate">{tag}</span>
                  <div className="bg-default h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-accent h-full rounded-full"
                      style={{width: `${(seconds / maxTag) * 100}%`}}
                    />
                  </div>
                  <span className="text-muted w-16 text-right tabular-nums">
                    {formatHours(seconds)}
                  </span>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      )}

      {stats.teammates.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Who you solve with</Card.Title>
            <Card.Description>Teammates who helped solve the same puzzles.</Card.Description>
          </Card.Header>
          <Card.Content>
            <ul className="flex flex-col gap-2 text-sm">
              {stats.teammates.map(teammate => (
                <li key={teammate.id} className="flex items-center gap-2">
                  <Avatar size="sm" className="size-6">
                    <Avatar.Image src={userAvatarSrc(teammate)} alt="" />
                    <Avatar.Fallback>{userInitials(teammate.name)}</Avatar.Fallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate">{teammate.name}</span>
                  <span className="text-muted tabular-nums">
                    {teammate.puzzles} {teammate.puzzles === 1 ? "puzzle" : "puzzles"}
                  </span>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      )}

      {s.longest.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Where your time went</Card.Title>
          </Card.Header>
          <Card.Content>
            <ol className="flex flex-col gap-1.5 text-sm">
              {s.longest.map(({puzzle, seconds}) => {
                const workspace = stats.workspaces.find(w => w.id === puzzle.workspaceId);
                return (
                  <li key={puzzle.id} className="flex items-center gap-3">
                    <span className="flex min-w-0 flex-1 flex-col">
                      {workspace ? (
                        <Link
                          to="/$workspaceSlug/puzzles/$puzzleId"
                          params={{workspaceSlug: workspace.slug, puzzleId: puzzle.id}}
                          className="truncate hover:underline">
                          {puzzle.name}
                        </Link>
                      ) : (
                        <span className="truncate">{puzzle.name}</span>
                      )}
                      {workspace && (
                        <span className="text-muted truncate text-xs">{workspace.name}</span>
                      )}
                    </span>
                    <span className="text-muted tabular-nums">{formatPuzzleTime(seconds)}</span>
                  </li>
                );
              })}
            </ol>
          </Card.Content>
        </Card>
      )}

      {s.workspaces.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>By hunt</Card.Title>
          </Card.Header>
          <Card.Content>
            <ul className="flex flex-col gap-2 text-sm">
              {s.workspaces.map(w => (
                <li key={w.id} className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Link
                      to="/$workspaceSlug"
                      params={{workspaceSlug: w.slug}}
                      className="truncate hover:underline">
                      {w.name}
                    </Link>
                    {w.eventName && (
                      <span className="text-muted truncate text-xs">{w.eventName}</span>
                    )}
                  </span>
                  <span className="text-muted text-right text-xs tabular-nums">
                    {w.solved} solved · {formatHours(w.seconds)}
                  </span>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      )}
    </>
  );
}
