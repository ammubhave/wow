import {formatPuzzleTime} from "@/hooks/use-puzzle-time";
import type {RouterOutputs} from "@/server/router";

/**
 * The leaderboard's awards (MVP, Night Owl…) and standings, worked out from the recap query. Shared
 * by the Leaderboard page and the badges people wear around the workspace (see awards-provider).
 */

export type Recap = RouterOutputs["workspaces"]["recap"];
export type User = Recap["users"][number];
export type Award = {emoji: string; title: string; user: User; stat: string};
/** One award's race: everyone with any of it, most first. */
export type Standing = {
  emoji: string;
  title: string;
  ranked: {user: User; value: number}[];
  stat: (n: number) => string;
  /** The number alone, for a standings row ("12 puzzles", "3h 20m"). */
  short: (n: number) => string;
};

export const isSolve = (field: string | null) => field === "solved" || field === "backsolved";
export const HOUR = 3_600_000;

const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

/** Time awards need at least this much (seconds), so a few stray minutes don't win one. */
const MIN_AWARD_SECONDS = 10 * 60;

const sumBy = (map: Map<string, number>, key: string, amount: number) =>
  map.set(key, (map.get(key) ?? 0) + amount);

/**
 * The recap's numbers and awards. Solving is a team effort, so nothing here credits whoever marked
 * a puzzle solved: people are credited for what they say they helped solve (the honor code), for
 * their active time (in their own time zone), and for keeping the board up to date.
 */
export function computeRecap(recap: Recap, solvedNow: Set<string>, metaIds: Set<string>) {
  const users = new Map(recap.users.map(user => [user.id, user]));

  // The team's numbers: the latest solve of each puzzle that's still solved.
  const solves = new Map<string, Recap["events"][number]>();
  // Keeping the board up to date: adding puzzles and rounds, statuses, answers, importance.
  const boardUpdates = new Map<string, number>();
  for (const event of recap.events) {
    bump(boardUpdates, event.userId);
    if (event.type === "updateStatus" && event.puzzleId && isSolve(event.field)) {
      solves.set(event.puzzleId, event);
    }
  }
  for (const {userId, count} of recap.roundsCreated) sumBy(boardUpdates, userId, count);
  const finalSolves = [...solves.values()].filter(s => s.puzzleId && solvedNow.has(s.puzzleId));
  const byHour = new Map<number, number>();
  for (const solve of finalSolves) {
    const hour = Math.floor(solve.at / HOUR);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }

  // Who helped solve what (self-reported), counting puzzles that are solved.
  const helped = new Map<string, number>();
  const metasHelped = new Map<string, number>();
  for (const {puzzleId, userId} of recap.contributions) {
    if (!solvedNow.has(puzzleId)) continue;
    bump(helped, userId);
    if (metaIds.has(puzzleId)) bump(metasHelped, userId);
  }

  // Active time on puzzles, by the hour of day where each person was.
  const activeTotal = new Map<string, number>();
  const night = new Map<string, number>();
  const early = new Map<string, number>();
  for (const {userId, localHour, seconds} of recap.activeTime) {
    sumBy(activeTotal, userId, seconds);
    if (localHour < 6) sumBy(night, userId, seconds);
    else if (localHour < 10) sumBy(early, userId, seconds);
  }

  // The awards, each a race: the leader wins it (time ones need a real amount, so a few stray
  // minutes don't), and the standings show everyone's place, live during the hunt.
  const races: {
    emoji: string;
    title: string;
    counts: Map<string, number>;
    stat: (n: number) => string;
    short: (n: number) => string;
    min?: number;
  }[] = [
    {
      emoji: "🏆",
      title: "MVP",
      counts: helped,
      stat: n => `helped solve ${n} ${n === 1 ? "puzzle" : "puzzles"}`,
      short: n => `${n} ${n === 1 ? "puzzle" : "puzzles"}`,
    },
    {
      emoji: "👑",
      title: "Meta Maestro",
      counts: metasHelped,
      stat: n => `helped solve ${n} ${n === 1 ? "meta" : "metas"}`,
      short: n => `${n} ${n === 1 ? "meta" : "metas"}`,
    },
    {
      emoji: "🦉",
      title: "Night Owl",
      counts: night,
      stat: n => `${formatPuzzleTime(n)} puzzling between midnight and 6am`,
      short: formatPuzzleTime,
      min: MIN_AWARD_SECONDS,
    },
    {
      emoji: "🌅",
      title: "Early Bird",
      counts: early,
      stat: n => `${formatPuzzleTime(n)} puzzling between 6 and 10am`,
      short: formatPuzzleTime,
      min: MIN_AWARD_SECONDS,
    },
    {
      emoji: "🏃",
      title: "Marathoner",
      counts: activeTotal,
      stat: n => `${formatPuzzleTime(n)} actively puzzling`,
      short: formatPuzzleTime,
      min: MIN_AWARD_SECONDS,
    },
    {
      emoji: "📋",
      title: "Board Keeper",
      counts: boardUpdates,
      stat: n => `kept the board current: ${n} updates`,
      short: n => `${n} ${n === 1 ? "update" : "updates"}`,
    },
  ];
  const standings: Standing[] = races.map(race => ({
    emoji: race.emoji,
    title: race.title,
    stat: race.stat,
    short: race.short,
    // Most first; ties keep whoever got there first (the map's order).
    ranked: [...race.counts]
      .flatMap(([id, value]) => {
        const user = users.get(id);
        return user && value > 0 ? [{user, value}] : [];
      })
      .toSorted((x, y) => y.value - x.value),
  }));
  const awards: Award[] = standings.flatMap((standing, i) => {
    const top = standing.ranked[0];
    const min = races[i]?.min ?? 1;
    return top && top.value >= min
      ? [
          {
            emoji: standing.emoji,
            title: standing.title,
            user: top.user,
            stat: standing.stat(top.value),
          },
        ]
      : [];
  });

  const firstAt = recap.events[0]?.at;
  const lastSolveAt = finalSolves.reduce((max, s) => Math.max(max, s.at), 0);
  const busiest = [...byHour].toSorted((a, b) => b[1] - a[1])[0];
  return {
    awards,
    standings,
    solves: finalSolves.length,
    metas: finalSolves.filter(s => s.puzzleId && metaIds.has(s.puzzleId)).length,
    // Everyone who helped solve something (or, without any marks yet, who was active).
    solvers: (helped.size > 0 ? helped : activeTotal).size,
    span: firstAt !== undefined && lastSolveAt > firstAt ? lastSolveAt - firstAt : 0,
    busiest: busiest && {at: busiest[0] * HOUR, count: busiest[1]},
    you: (id: string | undefined) =>
      id
        ? {
            helped: helped.get(id) ?? 0,
            activeSeconds: activeTotal.get(id) ?? 0,
            boardUpdates: boardUpdates.get(id) ?? 0,
            awards: awards.filter(a => a.user.id === id),
          }
        : undefined,
  };
}
