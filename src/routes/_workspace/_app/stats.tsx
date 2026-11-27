import {ChartTooltip, KPIGroup} from "@heroui-pro/react";
import {BarChart} from "@heroui-pro/react/bar-chart";
import {KPI} from "@heroui-pro/react/kpi";
import {Avatar, Card} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {cn} from "tailwind-variants";

import {Page, READING_WIDTH} from "@/components/page";
import {StatsBodySkeleton, StatsSkeleton} from "@/components/page-skeletons";
import {userAvatarSrc, userInitials} from "@/components/user-hover-card";
import {formatPuzzleTime} from "@/hooks/use-puzzle-time";
import {orpc} from "@/lib/orpc";
import type {RouterOutputs} from "@/server/router";

export const Route = createFileRoute("/_workspace/_app/stats")({
  // Fetched before the page shows (and on link hover); a failure is still the page's to show.
  loader: ({context: {queryClient}}) => queryClient.prefetchQuery(orpc.me.stats.queryOptions()),
  pendingComponent: StatsSkeleton,
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
    <Page title="My stats">
      <div className={cn(READING_WIDTH, "flex flex-col gap-4")}>
        {data ? <StatsBody stats={data} /> : <StatsBodySkeleton />}
      </div>
    </Page>
  );
}

/** A bar's tooltip: what it is (hour or tag) and the time spent. */
function MinutesTooltip({
  title,
  active,
  payload,
  label,
}: {
  title: (label: unknown) => string;
  // Filled in by Recharts.
  active?: boolean;
  payload?: {value?: unknown}[];
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltip>
      <ChartTooltip.Header>{title(label)}</ChartTooltip.Header>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--accent)" />
        <ChartTooltip.Label>On puzzles</ChartTooltip.Label>
        <ChartTooltip.Value>{formatHours(Number(payload[0]?.value ?? 0) * 60)}</ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}

function StatsBody({stats}: {stats: Stats}) {
  const s = computeStats(stats);
  if (s.total === 0 && s.solved === 0) {
    return (
      <p className="text-muted py-8 text-center text-sm">
        Nothing here yet. Open a puzzle and start solving: your time on puzzles and the puzzles you
        mark &ldquo;I helped&rdquo; show up here.
      </p>
    );
  }
  return (
    <>
      {/* Two by two on phones, one row from sm up. */}
      <KPIGroup className="grid grid-cols-2 sm:flex">
        <KPI>
          <KPI.Header>
            <KPI.Title>Puzzles helped solve</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={s.solved} />
          </KPI.Content>
        </KPI>
        <KPIGroup.Separator className="max-sm:hidden" />
        <KPI>
          <KPI.Header>
            <KPI.Title>Metas</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={s.metas} />
          </KPI.Content>
        </KPI>
        <KPIGroup.Separator className="max-sm:hidden" />
        <KPI>
          <KPI.Header>
            <KPI.Title>Time on puzzles</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            {/* Minutes under an hour; hours (to a tenth) above. */}
            {s.total < 3600 ? (
              <KPI.Value value={Math.round(s.total / 60)} style="unit" unit="minute" />
            ) : (
              <KPI.Value
                value={s.total / 3600}
                style="unit"
                unit="hour"
                maximumFractionDigits={1}
              />
            )}
          </KPI.Content>
        </KPI>
        <KPIGroup.Separator className="max-sm:hidden" />
        <KPI>
          <KPI.Header>
            <KPI.Title>Hunts</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={s.hunts} />
          </KPI.Content>
        </KPI>
      </KPIGroup>

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
            <BarChart
              data={s.byHour.map(({hour, seconds}) => ({hour, minutes: Math.round(seconds / 60)}))}
              height={160}>
              <BarChart.Grid vertical={false} />
              <BarChart.XAxis
                dataKey="hour"
                tickFormatter={(hour: number) => hourLabel(hour)}
                ticks={[0, 6, 12, 18, 23]}
                interval={0}
                tickMargin={8}
              />
              <BarChart.YAxis width={32} allowDecimals={false} />
              <BarChart.Bar
                dataKey="minutes"
                name="Minutes"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <BarChart.Tooltip
                content={<MinutesTooltip title={hour => hourLabel(Number(hour))} />}
              />
            </BarChart>
          </Card.Content>
        </Card>
      )}

      {s.tags.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Favourite puzzle types</Card.Title>
          </Card.Header>
          <Card.Content>
            <BarChart
              data={s.tags.map(([tag, seconds]) => ({tag, minutes: Math.round(seconds / 60)}))}
              height={Math.max(80, s.tags.length * 32)}
              layout="vertical"
              // Room for the time labels at the end of the bars.
              margin={{top: 0, right: 56, bottom: 0, left: 0}}>
              <BarChart.XAxis type="number" hide />
              <BarChart.YAxis dataKey="tag" type="category" width={96} tickMargin={4} />
              <BarChart.Bar
                dataKey="minutes"
                name="Minutes"
                fill="var(--accent)"
                barSize={14}
                radius={[0, 8, 8, 0]}
                isAnimationActive={false}
                label={{
                  position: "right",
                  fill: "var(--muted)",
                  fontSize: 11,
                  formatter: (minutes: unknown) => formatHours(Number(minutes) * 60),
                }}
              />
              <BarChart.Tooltip content={<MinutesTooltip title={tag => String(tag)} />} />
            </BarChart>
          </Card.Content>
        </Card>
      )}

      {stats.teammates.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Who you solve with</Card.Title>
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
