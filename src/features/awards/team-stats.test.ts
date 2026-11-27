import {describe, expect, it} from "vite-plus/test";

import {computeTeamStats, formatDuration, HOUR, median} from "./team-stats";

const MIN = 60_000;
const T0 = Date.UTC(2027, 0, 15, 17); // hunt start

const rounds = [
  {id: "r1", name: "Round 1"},
  {id: "r2", name: "Round 2"},
];
const puzzles = [
  {id: "a", name: "Alpha", status: "solved", isMetaPuzzle: false, roundId: "r1"},
  {id: "b", name: "Bravo", status: "backsolved", isMetaPuzzle: false, roundId: "r1"},
  {id: "c", name: "Charlie", status: "stuck", isMetaPuzzle: false, roundId: "r2"},
  {id: "m", name: "Meta", status: "solved", isMetaPuzzle: true, roundId: "r1"},
];
const events = [
  {at: T0, type: "create", puzzleId: "a", field: null},
  {at: T0, type: "create", puzzleId: "b", field: null},
  {at: T0 + 10 * MIN, type: "create", puzzleId: "m", field: null},
  {at: T0 + 30 * MIN, type: "updateStatus", puzzleId: "a", field: "solved"},
  {at: T0 + HOUR, type: "create", puzzleId: "c", field: null},
  {at: T0 + 2 * HOUR, type: "updateStatus", puzzleId: "m", field: "solved"},
  {at: T0 + 2 * HOUR + 5 * MIN, type: "updateStatus", puzzleId: "b", field: "backsolved"},
  // A deleted puzzle's events are ignored.
  {at: T0 + 3 * HOUR, type: "create", puzzleId: "gone", field: null},
];

describe("computeTeamStats", () => {
  const stats = computeTeamStats({
    events,
    puzzles,
    rounds,
    huntStartsAt: T0,
    huntEndsAt: T0 + 48 * HOUR,
    now: T0 + 4 * HOUR,
  });

  it("counts solves, backsolves and open puzzles", () => {
    expect(stats).toMatchObject({
      puzzles: 4,
      solved: 3,
      backsolved: 1,
      forward: 2,
      open: 1,
      metasSolved: 1,
    });
  });

  it("works out rates over the hunt so far and recently", () => {
    expect(stats.perHour).toBeCloseTo(3 / 4);
    // Last 3 hours (after T0+1h): the meta and the backsolve.
    expect(stats.recentPerHour).toBeCloseTo(2 / 3);
  });

  it("times each solve from unlock, leaving backsolves out of the median", () => {
    expect(stats.timed.map(s => [s.puzzleId, s.took])).toEqual([
      ["a", 30 * MIN],
      ["m", 110 * MIN],
      ["b", 125 * MIN],
    ]);
    expect(stats.medianTook).toBe(70 * MIN);
    expect(stats.metas.map(s => s.puzzleId)).toEqual(["m"]);
  });

  it("breaks the board down by round", () => {
    expect(stats.rounds).toEqual([
      {id: "r1", name: "Round 1", solved: 3, total: 3, medianTook: 70 * MIN},
      {id: "r2", name: "Round 2", solved: 0, total: 1, medianTook: null},
    ]);
  });

  it("draws unlocks and solves over time, on to now", () => {
    expect(stats.pace[0]).toEqual({time: T0, unlocked: 2, solved: 0});
    expect(stats.pace.at(-1)).toEqual({time: T0 + 4 * HOUR, unlocked: 4, solved: 3});
  });

  it("has no recent rate once the hunt is over", () => {
    const over = computeTeamStats({
      events,
      puzzles,
      rounds,
      huntStartsAt: T0,
      huntEndsAt: T0 + 3 * HOUR,
      now: T0 + 10 * HOUR,
    });
    expect(over.recentPerHour).toBeNull();
    expect(over.perHour).toBeCloseTo(3 / 3);
  });

  it("gives no rate until enough time has passed", () => {
    const early = computeTeamStats({
      events: events.slice(0, 4),
      puzzles,
      rounds,
      huntStartsAt: null,
      huntEndsAt: null,
      now: T0 + 5 * MIN,
    });
    expect(early.perHour).toBeNull();
  });
});

describe("helpers", () => {
  it("median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("formatDuration", () => {
    expect(formatDuration(20_000)).toBe("<1m");
    expect(formatDuration(45 * MIN)).toBe("45m");
    expect(formatDuration(200 * MIN)).toBe("3h 20m");
    expect(formatDuration(28 * HOUR)).toBe("1d 4h");
  });
});
