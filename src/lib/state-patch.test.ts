import {describe, expect, it} from "vite-plus/test";

import {
  applyPatch,
  diffState,
  type Json,
  jsonEqual,
  type Patch,
  PatchMismatchError,
  stateChecksum,
} from "./state-patch";

/** Round-trips through JSON, like the websocket does. */
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** `a` patched to `b`, sent over the wire, applied, and checked to serialize exactly like `b`. */
function roundTrip(a: Json, b: Json) {
  const patch = diffState(a, b);
  const result = patch ? applyPatch(wire(a), wire(patch)) : wire(a);
  expect(JSON.stringify(result)).toBe(JSON.stringify(b));
  expect(stateChecksum(JSON.stringify(result))).toBe(stateChecksum(JSON.stringify(b)));
  return {patch, result};
}

// A small, seeded PRNG so failures reproduce.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T>(r: Rand, items: readonly T[]) => items[Math.floor(r() * items.length)]!;
const KEYS = ["name", "status", "answer", "tags", "1", "0", "__proto__", "constructor", "x", "é"];
const STRINGS = ["", "a", "Solved", "ünïcödé", " ", "🥞", '"quoted"', "back\\slash"];

function randomScalar(r: Rand): Json {
  return pick(r, [
    () => null,
    () => r() < 0.5,
    () => Math.floor(r() * 1000) - 500,
    () => r() * 1e6,
    () => pick(r, STRINGS),
    () => new Date(1.7e12 + Math.floor(r() * 1e10)).toISOString(),
  ])();
}

function randomValue(r: Rand, depth: number): Json {
  if (depth <= 0 || r() < 0.3) return randomScalar(r);
  const kind = r();
  if (kind < 0.35) return randomItems(r, depth - 1);
  if (kind < 0.55)
    return Array.from({length: Math.floor(r() * 4)}, () => randomValue(r, depth - 1));
  return randomObject(r, depth - 1);
}

function randomObject(r: Rand, depth: number): {[key: string]: Json} {
  const entries: [string, Json][] = [];
  for (let i = Math.floor(r() * 5); i > 0; i--)
    entries.push([pick(r, KEYS), randomValue(r, depth)]);
  return Object.fromEntries(entries);
}

let nextId = 0;
function randomItems(r: Rand, depth: number): Json[] {
  const joined = r() < 0.3; // rows like an activity log entry: the id is in the first field
  return Array.from({length: Math.floor(r() * 6)}, (): Json => {
    const id = r() < 0.9 ? `id${nextId++ % 40}` : `id${Math.floor(r() * 3)}`; // sometimes duplicates
    if (joined) {
      return r() < 0.95
        ? {row: {id, ...randomObject(r, depth)}, user: randomObject(r, depth)}
        : {user: randomObject(r, depth), row: {id}}; // first field without an id
    }
    return {id, ...randomObject(r, depth)};
  });
}

/** A random edit of `value`, the kinds a board goes through (and some it never does). */
function mutate(r: Rand, value: Json, depth = 4): Json {
  if (depth <= 0 || r() < 0.15) return randomValue(r, 2);
  if (Array.isArray(value)) {
    const items = [...value];
    const op = r();
    if (op < 0.2 && items.length > 0) items.splice(Math.floor(r() * items.length), 1);
    else if (op < 0.4) items.splice(Math.floor(r() * (items.length + 1)), 0, ...randomItems(r, 2));
    else if (op < 0.55) items.reverse();
    else if (op < 0.65) items.sort(() => r() - 0.5);
    else if (items.length > 0) {
      const i = Math.floor(r() * items.length);
      items[i] = mutate(r, items[i]!, depth - 1);
    }
    return items;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    const op = r();
    if (op < 0.15 && entries.length > 0) entries.splice(Math.floor(r() * entries.length), 1);
    else if (op < 0.3) entries.push([pick(r, KEYS), randomValue(r, 2)]);
    else if (op < 0.4) entries.reverse();
    else if (entries.length > 0) {
      const i = Math.floor(r() * entries.length);
      entries[i] = [entries[i]![0], mutate(r, entries[i]![1], depth - 1)];
    }
    return Object.fromEntries(entries);
  }
  return randomValue(r, 2);
}

/** Something shaped like the workspace room state. */
function board(r: Rand, rounds = 4, puzzlesPerRound = 8): Json {
  return {
    id: "ws",
    name: "Hunt",
    tags: ["a", "b"],
    links: [{name: "Hunt", url: "https://example.com"}],
    theme: {emoji: {"1": "x", b: "y"}},
    guesses: Array.from({length: 5}, (_, i) => ({id: `g${i}`, answer: `ANSWER${i}`})),
    activityLogEntries: Array.from({length: 5}, (_, i) => ({
      activity_log_entry: {id: `log${i}`, createdAt: new Date(1.7e12 + i).toISOString()},
      user: {id: "u1", name: "Pat"},
    })),
    rounds: Array.from({length: rounds}, (_, ri) => ({
      id: `r${ri}`,
      name: `Round ${ri}`,
      puzzles: Array.from({length: puzzlesPerRound}, (_, pi) => ({
        id: `r${ri}p${pi}`,
        name: `Puzzle ${pi}`,
        status: pick(r, [null, "solved", "stuck"]),
        answer: null,
        contributorIds: [],
        tags: [],
      })),
    })),
  };
}

describe("diffState / applyPatch", () => {
  it("returns no patch for equal states", () => {
    const r = rng(1);
    const a = board(r);
    expect(diffState(a, wire(a))).toBeUndefined();
  });

  it("sends only the changed puzzle", () => {
    const a = board(rng(2));
    const b = wire(a) as {rounds: {puzzles: {status: Json}[]}[]};
    b.rounds[2]!.puzzles[5]!.status = "solved";
    const {patch} = roundTrip(a, b as Json);
    expect(JSON.stringify(patch)).toBe(
      JSON.stringify({
        t: "o",
        c: [
          [
            "rounds",
            {
              t: "a",
              u: [
                [
                  "r2",
                  {
                    t: "o",
                    c: [
                      [
                        "puzzles",
                        {t: "a", u: [["r2p5", {t: "o", c: [["status", {t: "v", v: "solved"}]]}]]},
                      ],
                    ],
                  },
                ],
              ],
            },
          ],
        ],
      })
    );
    expect(JSON.stringify(patch).length).toBeLessThan(200);
  });

  it("keeps the identity of everything unchanged", () => {
    const a = board(rng(3)) as {rounds: {puzzles: Json[]}[]; guesses: Json};
    const b = wire(a);
    b.rounds[1]!.puzzles[0] = {...(b.rounds[1]!.puzzles[0] as object), name: "Renamed"};
    const result = applyPatch(a as Json, diffState(a as Json, b as Json)!) as typeof a;
    expect(result).not.toBe(a);
    expect(result.guesses).toBe(a.guesses);
    expect(result.rounds[0]).toBe(a.rounds[0]);
    expect(result.rounds[1]!.puzzles[1]).toBe(a.rounds[1]!.puzzles[1]);
    expect(result.rounds[1]!.puzzles[0]).not.toBe(a.rounds[1]!.puzzles[0]);
  });

  it("handles adds, removals, moves and reorders by id", () => {
    const a = board(rng(4)) as {rounds: {id: string; puzzles: {id: string}[]}[]};
    const b = wire(a);
    const moved = b.rounds[0]!.puzzles.splice(3, 1)[0]!;
    b.rounds[3]!.puzzles.unshift(moved); // moved to another round
    b.rounds[1]!.puzzles.reverse();
    b.rounds.splice(2, 1); // round deleted
    b.rounds.push({id: "r9", puzzles: []}); // round added
    roundTrip(a as Json, b as Json);
  });

  it("keeps key order, including integer-like and odd keys", () => {
    roundTrip({b: 1, a: 2}, {a: 2, b: 1});
    roundTrip({"2": 1, "1": 2, x: 3}, {x: 3, "10": 1});
    roundTrip(
      JSON.parse('{"__proto__": {"x": 1}, "a": 1}'),
      JSON.parse('{"a": 1, "__proto__": {"x": 2}}')
    );
    const result = applyPatch({}, diffState({}, JSON.parse('{"__proto__": {"polluted": true}}'))!);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(({} as {polluted?: boolean}).polluted).toBeUndefined();
  });

  it("keys joined rows by their first field's id", () => {
    const entry = (id: string, name: string) => ({
      activity_log_entry: {id, name},
      user: {id: "u1"},
    });
    const a = [entry("e2", "b"), entry("e1", "a")];
    const b = [entry("e3", "c"), entry("e2", "b"), entry("e1", "a")];
    const {patch} = roundTrip(a, b);
    expect(patch).toEqual({t: "a", ids: ["e3", "e2", "e1"], u: [["e3", {t: "v", v: b[0]}]]});
    // Not keyed when an item has a non-string `id` of its own, or no id anywhere.
    roundTrip([{id: 1, row: {id: "x"}}], [{id: 2, row: {id: "x"}}]);
    roundTrip([{row: {name: "x"}}], [{row: {name: "y"}}]);
  });

  it("replaces values that change type, and lists without unique ids", () => {
    roundTrip([1, 2, 3], [3, 2, 1]);
    roundTrip([{id: "a"}, {id: "a"}], [{id: "a"}]);
    roundTrip([{id: "a"}], [{id: 1}]);
    roundTrip([{id: "a"}], []);
    roundTrip([], [{id: "a"}]);
    roundTrip({a: [1]}, {a: {0: 1}});
    roundTrip(null, {a: 1});
    roundTrip({a: null}, {a: false});
    roundTrip({a: 0}, {a: -0});
    roundTrip("x", "y");
  });

  it("round-trips thousands of random edits exactly", () => {
    for (let seed = 0; seed < 3000; seed++) {
      const r = rng(seed);
      const a = seed % 3 === 0 ? board(r, 3, 5) : randomValue(r, 5);
      let current = a;
      // A run of edits, each patched onto the result of the last (as a client would).
      for (let step = 0; step < 5; step++) {
        const next = wire(mutate(r, current));
        const {result} = roundTrip(current, next);
        expect(jsonEqual(result, next)).toBe(true);
        current = result;
      }
    }
  });

  it("refuses or fails the checksum when applied to the wrong state", () => {
    let caught = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const r = rng(seed + 10_000);
      const a = board(r, 3, 4);
      const b = wire(mutate(r, a));
      const patch = diffState(a, b);
      if (!patch) continue;
      // A client that missed an edit: its state differs from the patch's base.
      const stale = wire(mutate(r, a));
      if (jsonEqual(stale, a)) continue;
      const expected = stateChecksum(JSON.stringify(b));
      let ok = false;
      try {
        const result = applyPatch(stale, wire(patch));
        ok = stateChecksum(JSON.stringify(result)) === expected;
        // Only acceptable when the stale edit was overwritten by the patch anyway.
        if (ok) expect(JSON.stringify(result)).toBe(JSON.stringify(b));
      } catch (error) {
        expect(error).toBeInstanceOf(PatchMismatchError);
      }
      if (!ok) caught++;
    }
    expect(caught).toBeGreaterThan(1000);
  });

  it("throws on patches that don't fit", () => {
    const bad: [Json, Patch][] = [
      [{a: 1}, {t: "a", u: []}],
      [[1], {t: "a", u: []}],
      [[{id: "a"}], {t: "a", ids: ["b"], u: []}],
      [[{id: "a"}], {t: "a", ids: ["a", "b"], u: [["b", {t: "o", c: []}]]}],
      [[], {t: "o", c: []}],
      [{a: 1}, {t: "o", keys: ["a", "b"], c: []}],
      [{a: 1}, {t: "o", keys: ["b"], c: [["b", {t: "o", c: []}]]}],
      [{a: 1}, {t: "nope"} as unknown as Patch],
    ];
    for (const [state, patch] of bad) {
      expect(() => applyPatch(state, patch)).toThrow(PatchMismatchError);
    }
  });
});

describe("stateChecksum", () => {
  it("differs for different states, including same-length ones", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(stateChecksum(JSON.stringify({n: i})));
    expect(seen.size).toBe(5000);
    expect(stateChecksum('{"a":1}')).not.toBe(stateChecksum('{"a":2}'));
    expect(stateChecksum('{"a":1}')).toBe(stateChecksum('{"a":1}'));
  });
});
