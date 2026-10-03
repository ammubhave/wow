import {ChartTooltip} from "@heroui-pro/react";
import {AreaChart} from "@heroui-pro/react/area-chart";
import {Card} from "@heroui/react";
import NumberFlow from "@number-flow/react";
import {useQuery} from "@tanstack/react-query";
import {useParams} from "@tanstack/react-router";
import {ReferenceDot} from "recharts";
import {useNow} from "use-intl";

import {useWorkspace} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";

const isSolved = (status: string | null | undefined) =>
  status === "solved" || status === "backsolved";

type Point = {time: number; solved: number; puzzle: string};

const hoverTime = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});
const dayTick = new Intl.DateTimeFormat(undefined, {weekday: "short", hour: "numeric"});
const hourTick = new Intl.DateTimeFormat(undefined, {hour: "numeric", minute: "2-digit"});

/** Cumulative puzzles solved over the hunt, above the activity feed. */
export default function SolvesChart() {
  const {workspaceSlug} = useParams({from: "/_workspace/$workspaceSlug"});
  const now = useNow({updateInterval: 60_000}).getTime();
  const workspace = useWorkspace();
  const {data: solves} = useQuery(orpc.workspaces.solves.queryOptions({input: {workspaceSlug}}));

  const puzzles = workspace.rounds.flatMap(round => round.puzzles);
  const solved = puzzles.filter(puzzle => isSolved(puzzle.status));
  // When each puzzle was last marked solved: the server's full history, plus solves that arrived
  // live since it was fetched.
  const solvedAt = new Map(solves?.map(solve => [solve.puzzleId, solve.solvedAt]));
  for (const entry of workspace.activityLogEntries) {
    const log = entry.puzzle_activity_log_entry;
    if (log?.subType !== "updateStatus" || !log.puzzleId || !isSolved(log.field)) continue;
    const time = new Date(entry.activity_log_entry.createdAt).getTime();
    if (time > (solvedAt.get(log.puzzleId) ?? 0)) solvedAt.set(log.puzzleId, time);
  }
  // Only puzzles that are still solved count; ones solved before the log began start the line.
  const timed = solved
    .flatMap(puzzle => {
      const time = solvedAt.get(puzzle.id);
      return time === undefined ? [] : [{time, puzzle: puzzle.name, isMeta: puzzle.isMetaPuzzle}];
    })
    .toSorted((a, b) => a.time - b.time);
  const untimed = solved.length - timed.length;

  if (solves === undefined || solved.length === 0) return null;

  // With hunt times set (they're optional), the chart covers the hunt: from its start, to now
  // (or its end, once it's over).
  const huntStart = workspace.huntStartsAt ? new Date(workspace.huntStartsAt).getTime() : undefined;
  const huntEnd = workspace.huntEndsAt ? new Date(workspace.huntEndsAt).getTime() : undefined;
  const firstSolve = timed[0]?.time ?? now;
  const start = huntStart !== undefined ? Math.min(huntStart, firstSolve) : firstSolve;
  const lastSolve = timed.at(-1)?.time ?? now;
  const end = Math.max(lastSolve, huntEnd !== undefined ? Math.min(now, huntEnd) : now);
  const points: Point[] = [
    {time: start, solved: untimed, puzzle: ""},
    ...timed.map(({time, puzzle}, i) => ({time, puzzle, solved: untimed + i + 1})),
    // Carry the line on to now, so a quiet stretch shows as flat.
    {time: end, solved: solved.length, puzzle: ""},
  ];
  // Metas solved: marked on the line.
  const metaSolves = timed.flatMap((solve, i) =>
    solve.isMeta ? [{time: solve.time, solved: untimed + i + 1, puzzle: solve.puzzle}] : []
  );
  const spansDays = points.at(-1)!.time - start > 1000 * 60 * 60 * 20;
  // A handful of evenly spaced ticks (Recharts would otherwise label every solve).
  const span = points.at(-1)!.time - start;
  const ticks = Array.from({length: 5}, (_, i) => start + (span * i) / 4);
  const tickLabel = (time: number) => (spansDays ? dayTick : hourTick).format(time);
  const metas = solved.filter(puzzle => puzzle.isMetaPuzzle).length;

  return (
    <Card>
      <Card.Header className="flex-row items-baseline justify-between gap-4">
        <Card.Title className="text-base">Solves</Card.Title>
        <p className="text-muted m-0 text-sm tabular-nums">
          <span className="text-foreground text-lg font-semibold">
            <NumberFlow value={solved.length} />
          </span>{" "}
          of {puzzles.length}
          {metas > 0 && ` · ${metas} ${metas === 1 ? "meta" : "metas"}`}
        </p>
      </Card.Header>
      {timed.length > 0 && (
        <Card.Content>
          <AreaChart data={points} height={160} margin={{top: 8, right: 8, bottom: 0, left: -16}}>
            <defs>
              <linearGradient id="solves-fill" x1="0" x2="0" y1="0" y2="1">
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
              tickFormatter={tickLabel}
              tickMargin={8}
              minTickGap={24}
            />
            <AreaChart.YAxis allowDecimals={false} width={40} />
            <AreaChart.Area
              dataKey="solved"
              name="Solved"
              type="stepAfter"
              dot={false}
              fill="url(#solves-fill)"
              stroke="var(--color-success)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            {metaSolves.map(meta => (
              <ReferenceDot
                key={meta.time}
                x={meta.time}
                y={meta.solved}
                r={5}
                fill="var(--color-warning)"
                stroke="var(--surface)"
                strokeWidth={2}
                label={{value: "★", position: "top", fill: "var(--color-warning)", fontSize: 12}}
              />
            ))}
            <AreaChart.Tooltip content={<SolveTooltip points={points} />} />
          </AreaChart>
        </Card.Content>
      )}
    </Card>
  );
}

/** Hovered step: when, which puzzle was solved, and the running count. */
function SolveTooltip({
  points,
  active,
  label,
}: {
  points: Point[];
  // Filled in by Recharts.
  active?: boolean;
  label?: unknown;
}) {
  const point = points.findLast(p => p.time === Number(label));
  if (!active || !point) return null;
  return (
    <ChartTooltip>
      <ChartTooltip.Header>{hoverTime.format(point.time)}</ChartTooltip.Header>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--color-success)" />
        <ChartTooltip.Label>{point.puzzle || "Solved"}</ChartTooltip.Label>
        <ChartTooltip.Value>{point.solved}</ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}
