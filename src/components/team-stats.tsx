import {ChartTooltip, KPIGroup} from "@heroui-pro/react";
import {AreaChart} from "@heroui-pro/react/area-chart";
import {KPI} from "@heroui-pro/react/kpi";
import {Card} from "@heroui/react";
import {Link} from "@tanstack/react-router";
import {StarIcon} from "lucide-react";

import {
  formatDuration,
  RECENT_HOURS,
  type PacePoint,
  type TeamStats,
  type TimedSolve,
} from "@/features/awards/team-stats";

const hoverTime = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});
const dayTick = new Intl.DateTimeFormat(undefined, {weekday: "short", hour: "numeric"});
const hourTick = new Intl.DateTimeFormat(undefined, {hour: "numeric", minute: "2-digit"});

const rate = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1));

/** How many quickest and longest solves to list. */
const LIST = 5;

/**
 * The team's pace on the Stats page: solve rate, time from unlock to solve, unlocks against solves
 * over the hunt, and how each round is going.
 */
export function TeamStatsSection({
  stats,
  workspaceSlug,
  isLive,
}: {
  stats: TeamStats;
  workspaceSlug: string;
  isLive: boolean;
}) {
  if (stats.puzzles === 0) return null;
  const quickest = stats.timed.filter(solve => !solve.isBacksolve).slice(0, LIST);
  const longest = stats.timed
    .filter(solve => !solve.isBacksolve)
    .toReversed()
    .slice(0, LIST);
  return (
    <section aria-label="Team stats" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Team stats</h2>
      <Card>
        <Card.Content className="flex flex-col gap-4">
          <KPIGroup>
            <KPI>
              <KPI.Header>
                <KPI.Title>Solves an hour</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold tabular-nums">
                    {stats.perHour === null ? "—" : rate(stats.perHour)}
                  </span>
                  {isLive && stats.recentPerHour !== null && (
                    <span className="text-muted text-xs tabular-nums">
                      {rate(stats.recentPerHour)} in the last {RECENT_HOURS}h
                    </span>
                  )}
                </div>
              </KPI.Content>
            </KPI>
            <KPIGroup.Separator />
            <KPI>
              <KPI.Header>
                <KPI.Title>Median time to solve</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold tabular-nums">
                    {stats.medianTook === null ? "—" : formatDuration(stats.medianTook)}
                  </span>
                  <span className="text-muted text-xs">from unlock, not counting backsolves</span>
                </div>
              </KPI.Content>
            </KPI>
            <KPIGroup.Separator />
            <KPI>
              <KPI.Header>
                <KPI.Title>Solved</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold tabular-nums">
                    {stats.solved}
                    <span className="text-muted text-base font-normal"> of {stats.puzzles}</span>
                  </span>
                  <span className="text-muted text-xs tabular-nums">
                    {stats.forward} forward · {stats.backsolved} backsolved
                  </span>
                </div>
              </KPI.Content>
            </KPI>
            <KPIGroup.Separator />
            <KPI>
              <KPI.Header>
                <KPI.Title>Still open</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <span className="text-2xl font-semibold tabular-nums">{stats.open}</span>
              </KPI.Content>
            </KPI>
          </KPIGroup>
          <PaceChart pace={stats.pace} />
        </Card.Content>
      </Card>

      {(quickest.length > 0 || stats.metas.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {quickest.length > 0 && (
            <SolveList title="Quickest solves" solves={quickest} workspaceSlug={workspaceSlug} />
          )}
          {longest.length > 1 && (
            <SolveList title="Longest solves" solves={longest} workspaceSlug={workspaceSlug} />
          )}
          {stats.metas.length > 0 && (
            <SolveList
              title="Metas, in the order solved"
              solves={stats.metas}
              workspaceSlug={workspaceSlug}
            />
          )}
        </div>
      )}

      {stats.rounds.length > 1 && (
        <Card>
          <Card.Header>
            <Card.Title>By round</Card.Title>
          </Card.Header>
          <Card.Content className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left text-xs">
                  <th className="py-1 pe-3 font-normal">Round</th>
                  <th className="py-1 pe-3 text-right font-normal">Solved</th>
                  <th className="py-1 text-right font-normal">Median time</th>
                </tr>
              </thead>
              <tbody>
                {stats.rounds.map(round => (
                  <tr key={round.id} className="border-separator border-t">
                    <td className="max-w-0 truncate py-1.5 pe-3">{round.name}</td>
                    <td className="py-1.5 pe-3 text-right whitespace-nowrap tabular-nums">
                      {round.solved}/{round.total}
                    </td>
                    <td className="text-muted py-1.5 text-right whitespace-nowrap tabular-nums">
                      {round.medianTook === null ? "—" : formatDuration(round.medianTook)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card.Content>
        </Card>
      )}
    </section>
  );
}

function SolveList({
  title,
  solves,
  workspaceSlug,
}: {
  title: string;
  solves: TimedSolve[];
  workspaceSlug: string;
}) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
      </Card.Header>
      <Card.Content>
        <ol className="flex flex-col gap-1.5 text-sm">
          {solves.map(solve => (
            <li key={solve.puzzleId} className="flex items-center gap-2">
              {solve.isMeta && (
                <StarIcon className="text-warning size-3.5 shrink-0" aria-label="Meta" />
              )}
              <Link
                to="/$workspaceSlug/puzzles/$puzzleId"
                params={{workspaceSlug, puzzleId: solve.puzzleId}}
                className="min-w-0 flex-1 truncate hover:underline">
                {solve.name}
              </Link>
              <span
                className="text-muted shrink-0 tabular-nums"
                title={`Unlocked ${hoverTime.format(solve.unlockedAt)}, solved ${hoverTime.format(solve.solvedAt)}`}>
                {formatDuration(solve.took)}
              </span>
            </li>
          ))}
        </ol>
      </Card.Content>
    </Card>
  );
}

/** Puzzles unlocked and solved over the hunt: the gap between the lines is the open work. */
function PaceChart({pace}: {pace: PacePoint[]}) {
  if (pace.length < 2) return null;
  const start = pace[0]!.time;
  const span = pace.at(-1)!.time - start;
  const spansDays = span > 20 * 3_600_000;
  const ticks = Array.from({length: 5}, (_, i) => start + (span * i) / 4);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted flex flex-wrap items-center gap-4 text-xs">
        <span>Unlocked and solved over the hunt</span>
        <span className="flex items-center gap-1.5">
          <span className="bg-accent inline-block h-0.5 w-3" aria-hidden="true" />
          Unlocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-success inline-block h-0.5 w-3" aria-hidden="true" />
          Solved
        </span>
      </div>
      <AreaChart data={pace} height={180} margin={{top: 8, right: 8, bottom: 0, left: -16}}>
        <defs>
          <linearGradient id="pace-solved-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <AreaChart.Grid vertical={false} />
        <AreaChart.XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          ticks={ticks}
          tickFormatter={(time: number) => (spansDays ? dayTick : hourTick).format(time)}
          tickMargin={8}
          minTickGap={24}
        />
        <AreaChart.YAxis allowDecimals={false} width={40} />
        <AreaChart.Area
          dataKey="unlocked"
          name="Unlocked"
          type="stepAfter"
          dot={false}
          fill="transparent"
          stroke="var(--accent)"
          strokeWidth={2}
          isAnimationActive={false}
        />
        <AreaChart.Area
          dataKey="solved"
          name="Solved"
          type="stepAfter"
          dot={false}
          fill="url(#pace-solved-fill)"
          stroke="var(--color-success)"
          strokeWidth={2}
          isAnimationActive={false}
        />
        <AreaChart.Tooltip content={<PaceTooltip pace={pace} />} />
      </AreaChart>
    </div>
  );
}

function PaceTooltip({
  pace,
  active,
  label,
}: {
  pace: PacePoint[];
  // Filled in by Recharts.
  active?: boolean;
  label?: unknown;
}) {
  const point = pace.findLast(p => p.time === Number(label));
  if (!active || !point) return null;
  return (
    <ChartTooltip>
      <ChartTooltip.Header>{hoverTime.format(point.time)}</ChartTooltip.Header>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--accent)" />
        <ChartTooltip.Label>Unlocked</ChartTooltip.Label>
        <ChartTooltip.Value>{point.unlocked}</ChartTooltip.Value>
      </ChartTooltip.Item>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--color-success)" />
        <ChartTooltip.Label>Solved</ChartTooltip.Label>
        <ChartTooltip.Value>{point.solved}</ChartTooltip.Value>
      </ChartTooltip.Item>
      <ChartTooltip.Item>
        <ChartTooltip.Label>Open</ChartTooltip.Label>
        <ChartTooltip.Value>{point.unlocked - point.solved}</ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}
