/**
 * The team's pace, from the recap query and the board: how fast puzzles get solved, how long each
 * took from unlock to solve, and how unlocks and solves grew over the hunt. Pure, so it's tested
 * without a browser (team-stats.test.ts).
 *
 * "Unlocked" is when the puzzle was added to WOW, the closest thing to the hunt releasing it that
 * WOW knows. "Solved" is the last time a puzzle that's solved now was marked Solved or Backsolved.
 */

export const HOUR = 3_600_000;

/** Solves in the last this-many hours make the "recent" rate. */
export const RECENT_HOURS = 3;

export type StatsEvent = {at: number; type: string; puzzleId: string | null; field: string | null};

export type StatsPuzzle = {
  id: string;
  name: string;
  status: string | null;
  isMetaPuzzle: boolean;
  roundId: string;
};

export type StatsRound = {id: string; name: string};

export type TimedSolve = {
  puzzleId: string;
  name: string;
  isMeta: boolean;
  isBacksolve: boolean;
  unlockedAt: number;
  solvedAt: number;
  /** Unlock to solve, in milliseconds. */
  took: number;
};

export type PacePoint = {time: number; unlocked: number; solved: number};

export type RoundStats = {
  id: string;
  name: string;
  solved: number;
  total: number;
  /** Median unlock-to-solve time of its puzzles solved forward, or null with none. */
  medianTook: number | null;
};

export type TeamStats = {
  puzzles: number;
  solved: number;
  backsolved: number;
  forward: number;
  open: number;
  metasSolved: number;
  /** Solves per hour since the hunt began (null until there's enough time to say). */
  perHour: number | null;
  /** Solves per hour over the last RECENT_HOURS (only while the hunt is on). */
  recentPerHour: number | null;
  /** Median unlock-to-solve time over forward solves, or null with none. */
  medianTook: number | null;
  /** Solves timed from unlock to solve, quickest first. */
  timed: TimedSolve[];
  metas: TimedSolve[];
  rounds: RoundStats[];
  pace: PacePoint[];
};

export const isSolve = (status: string | null) => status === "solved" || status === "backsolved";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function computeTeamStats({
  events,
  puzzles,
  rounds,
  huntStartsAt,
  huntEndsAt,
  now,
}: {
  /** In time order, as the recap query returns them. */
  events: StatsEvent[];
  puzzles: StatsPuzzle[];
  rounds: StatsRound[];
  huntStartsAt: number | null;
  huntEndsAt: number | null;
  now: number;
}): TeamStats {
  const byId = new Map(puzzles.map(puzzle => [puzzle.id, puzzle]));
  const unlockedAt = new Map<string, number>();
  const solvedAt = new Map<string, number>();
  for (const event of events) {
    if (!event.puzzleId || !byId.has(event.puzzleId)) continue;
    if (event.type === "create" && !unlockedAt.has(event.puzzleId)) {
      unlockedAt.set(event.puzzleId, event.at);
    } else if (event.type === "updateStatus" && isSolve(event.field)) {
      solvedAt.set(event.puzzleId, event.at);
    }
  }

  const solvedPuzzles = puzzles.filter(puzzle => isSolve(puzzle.status));
  const backsolved = solvedPuzzles.filter(puzzle => puzzle.status === "backsolved").length;

  const timed: TimedSolve[] = solvedPuzzles
    .flatMap(puzzle => {
      const unlocked = unlockedAt.get(puzzle.id);
      const solved = solvedAt.get(puzzle.id);
      if (unlocked === undefined || solved === undefined || solved < unlocked) return [];
      return [
        {
          puzzleId: puzzle.id,
          name: puzzle.name,
          isMeta: puzzle.isMetaPuzzle,
          isBacksolve: puzzle.status === "backsolved",
          unlockedAt: unlocked,
          solvedAt: solved,
          took: solved - unlocked,
        },
      ];
    })
    .toSorted((a, b) => a.took - b.took);
  // Backsolves say little about how long a puzzle takes, so the medians leave them out.
  const forwardTook = (list: TimedSolve[]) => list.filter(s => !s.isBacksolve).map(s => s.took);

  // The hunt so far: from its start (or the first thing added) to now, or to its end once over.
  const firstAt = events[0]?.at;
  const start =
    huntStartsAt !== null && (firstAt === undefined || huntStartsAt <= firstAt)
      ? huntStartsAt
      : firstAt;
  const end = huntEndsAt !== null ? Math.min(now, huntEndsAt) : now;
  const isLive =
    (huntStartsAt === null || now >= huntStartsAt) && (huntEndsAt === null || now < huntEndsAt);
  // Solves with a time (all of them, unless some predate the log) within the hunt so far.
  const solveTimes = solvedPuzzles.flatMap(puzzle => {
    const at = solvedAt.get(puzzle.id);
    return at === undefined ? [] : [at];
  });
  const hours = start !== undefined ? (end - start) / HOUR : 0;
  // Under a quarter of an hour, a rate means little ("40 an hour" after one quick solve).
  const perHour = hours >= 0.25 && solvedPuzzles.length > 0 ? solvedPuzzles.length / hours : null;
  const recentFrom = now - RECENT_HOURS * HOUR;
  const recentPerHour =
    isLive && start !== undefined && start <= recentFrom
      ? solveTimes.filter(at => at > recentFrom && at <= now).length / RECENT_HOURS
      : null;

  // Unlocks and solves over time. Puzzles added before the log began start the lines.
  const changes: {time: number; unlocked: number; solved: number}[] = [];
  let unlockedBefore = 0;
  for (const puzzle of puzzles) {
    const at = unlockedAt.get(puzzle.id);
    if (at === undefined) unlockedBefore++;
    else changes.push({time: at, unlocked: 1, solved: 0});
  }
  let solvedBefore = 0;
  for (const puzzle of solvedPuzzles) {
    const at = solvedAt.get(puzzle.id);
    if (at === undefined) solvedBefore++;
    else changes.push({time: at, unlocked: 0, solved: 1});
  }
  changes.sort((a, b) => a.time - b.time);
  const pace: PacePoint[] = [];
  if (changes.length > 0) {
    const paceStart = Math.min(start ?? changes[0]!.time, changes[0]!.time);
    let unlocked = unlockedBefore;
    let solved = solvedBefore;
    pace.push({time: paceStart, unlocked, solved});
    for (const change of changes) {
      unlocked += change.unlocked;
      solved += change.solved;
      // One point per moment: a puzzle added and solved together lands on one step.
      const last = pace.at(-1)!;
      if (last.time === change.time) Object.assign(last, {unlocked, solved});
      else pace.push({time: change.time, unlocked, solved});
    }
    // Carry the lines on to now (or the end), so a quiet stretch shows as flat.
    const paceEnd = Math.max(end, pace.at(-1)!.time);
    if (paceEnd > pace.at(-1)!.time) pace.push({time: paceEnd, unlocked, solved});
  }

  const roundStats: RoundStats[] = rounds.map(round => {
    const inRound = puzzles.filter(puzzle => puzzle.roundId === round.id);
    const ids = new Set(inRound.map(puzzle => puzzle.id));
    return {
      id: round.id,
      name: round.name,
      solved: inRound.filter(puzzle => isSolve(puzzle.status)).length,
      total: inRound.length,
      medianTook: median(forwardTook(timed.filter(solve => ids.has(solve.puzzleId)))),
    };
  });

  return {
    puzzles: puzzles.length,
    solved: solvedPuzzles.length,
    backsolved,
    forward: solvedPuzzles.length - backsolved,
    open: puzzles.length - solvedPuzzles.length,
    metasSolved: solvedPuzzles.filter(puzzle => puzzle.isMetaPuzzle).length,
    perHour,
    recentPerHour,
    medianTook: median(forwardTook(timed)),
    timed,
    metas: timed.filter(solve => solve.isMeta).toSorted((a, b) => a.solvedAt - b.solvedAt),
    rounds: roundStats,
    pace,
  };
}

/** "45m", "3h 20m", "1d 4h": a duration at a glance. */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return hours % 24 === 0 ? `${days}d` : `${days}d ${hours % 24}h`;
}
