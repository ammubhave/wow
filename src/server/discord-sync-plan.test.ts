import {describe, expect, it} from "vite-plus/test";

import {
  channelName,
  desiredRounds,
  type ExistingChannel,
  planSync,
  retryAfterSeconds,
  type SyncRound,
} from "./discord-sync-plan";

const puzzle = (name: string, extra: Partial<SyncRound["puzzles"][number]> = {}) => ({
  name,
  status: null,
  importance: null,
  isMetaPuzzle: false,
  ...extra,
});
const category = (id: string, name: string): ExistingChannel => ({
  id,
  name,
  type: 4,
  parentId: null,
});
const voice = (id: string, name: string, parentId: string | null): ExistingChannel => ({
  id,
  name,
  type: 2,
  parentId,
});

describe("desiredRounds", () => {
  it("drops done puzzles and empty rounds, prefixes metas, merges same-named rounds", () => {
    expect(
      desiredRounds([
        {
          name: "A",
          puzzles: [
            puzzle("one"),
            puzzle("solved", {status: "solved"}),
            puzzle("back", {status: "backsolved"}),
            puzzle("gone", {importance: "obsolete"}),
            puzzle("meta", {isMetaPuzzle: true, id: "m"}),
          ],
        },
        {name: "Done", puzzles: [puzzle("x", {status: "solved"})]},
        {name: "A", puzzles: [puzzle("two")]},
      ])
    ).toEqual([
      {
        name: "A",
        puzzles: [
          {id: undefined, name: "one"},
          {id: "m", name: "[META] meta"},
          {id: undefined, name: "two"},
        ],
      },
    ]);
  });

  it("truncates names Discord would reject", () => {
    expect(channelName("x".repeat(200))).toHaveLength(90);
    expect(channelName("🧩".repeat(100))).toBe("🧩".repeat(90));
    expect(channelName("  short ")).toBe("short");
  });
});

describe("planSync", () => {
  it("creates everything on an empty guild", () => {
    const plan = planSync([{name: "R", puzzles: [{name: "P"}, {name: "Q"}]}], []);
    expect(plan.createCategories).toEqual(["R"]);
    expect(plan.voices).toEqual([
      {kind: "create", puzzleId: undefined, name: "P", round: "R"},
      {kind: "create", puzzleId: undefined, name: "Q", round: "R"},
    ]);
    expect(plan.retireVoices).toEqual([]);
    expect(plan.deleteVoices).toEqual([]);
    expect(plan.deleteCategories).toEqual([]);
  });

  it("is a no-op when the guild already matches", () => {
    const plan = planSync(
      [{name: "R", puzzles: [{name: "P"}]}],
      [category("c", "R"), voice("v", "P", "c")]
    );
    expect(plan.createCategories).toEqual([]);
    expect(plan.voices).toEqual([{kind: "keep", puzzleId: undefined, channelId: "v"}]);
    expect(plan.retireVoices).toEqual([]);
    expect(plan.deleteVoices).toEqual([]);
    expect(plan.deleteCategories).toEqual([]);
  });

  it("lets a round and a puzzle share a name", () => {
    const plan = planSync(
      [{name: "Same", puzzles: [{name: "Same"}]}],
      [category("c", "Same"), voice("v", "Same", "c")]
    );
    expect(plan.voices).toEqual([{kind: "keep", puzzleId: undefined, channelId: "v"}]);
    expect(plan.deleteVoices).toEqual([]);
    expect(plan.deleteCategories).toEqual([]);
  });

  it("gives same-named puzzles in different rounds a channel each, and keeps them put", () => {
    const rounds = [
      {name: "A", puzzles: [{name: "TBD"}]},
      {name: "B", puzzles: [{name: "TBD"}]},
    ];
    const first = planSync(rounds, []);
    expect(first.voices.map(action => action.kind)).toEqual(["create", "create"]);

    // Listed in the "wrong" order: each still matches the one already in its category.
    const second = planSync(rounds, [
      category("a", "A"),
      category("b", "B"),
      voice("vb", "TBD", "b"),
      voice("va", "TBD", "a"),
    ]);
    expect(second.voices).toEqual([
      {kind: "keep", puzzleId: undefined, channelId: "va"},
      {kind: "keep", puzzleId: undefined, channelId: "vb"},
    ]);
    expect(second.deleteVoices).toEqual([]);
  });

  it("moves a puzzle's channel to its new round and drops the old round's category", () => {
    const plan = planSync(
      [{name: "B", puzzles: [{name: "P"}]}],
      [category("a", "A"), voice("v", "P", "a")]
    );
    expect(plan.createCategories).toEqual(["B"]);
    expect(plan.voices).toEqual([
      {kind: "update", puzzleId: undefined, channelId: "v", round: "B"},
    ]);
    expect(plan.deleteCategories).toEqual(["a"]);
  });

  it("retires channels of done puzzles and deletes surplus duplicates", () => {
    const plan = planSync(
      [{name: "R", puzzles: [{name: "P"}]}],
      [
        category("c", "R"),
        voice("v1", "P", "c"),
        voice("v2", "P", "c"),
        voice("done", "Solved", "c"),
      ]
    );
    expect(plan.voices).toEqual([{kind: "keep", puzzleId: undefined, channelId: "v1"}]);
    expect(plan.deleteVoices).toEqual(["v2"]);
    expect(plan.retireVoices).toEqual([{id: "done", name: "Solved", parentId: "c"}]);
  });

  it("keeps the duplicate category holding channels and deletes the other", () => {
    const plan = planSync(
      [{name: "R", puzzles: [{name: "P"}]}],
      [category("empty", "R"), category("full", "R"), voice("v", "P", "full")]
    );
    expect(plan.categories.get("R")).toBe("full");
    expect(plan.voices).toEqual([{kind: "keep", puzzleId: undefined, channelId: "v"}]);
    expect(plan.deleteCategories).toEqual(["empty"]);
  });

  it("follows a stored puzzle id across renames", () => {
    const plan = planSync(
      [
        {
          name: "R",
          puzzles: [
            {id: "p1", name: "Real name"},
            {id: "p2", name: "TBD"},
          ],
        },
      ],
      [category("c", "R"), voice("v", "TBD", "c")],
      {p1: "v"}
    );
    expect(plan.voices).toEqual([
      {kind: "update", puzzleId: "p1", channelId: "v", name: "Real name"},
      {kind: "create", puzzleId: "p2", name: "TBD", round: "R"},
    ]);
    expect(plan.deleteVoices).toEqual([]);
    expect(plan.retireVoices).toEqual([]);
  });

  it("falls back to names when the stored channel is gone", () => {
    const plan = planSync(
      [{name: "R", puzzles: [{id: "p1", name: "P"}]}],
      [category("c", "R"), voice("v", "P", "c")],
      {p1: "deleted"}
    );
    expect(plan.voices).toEqual([{kind: "keep", puzzleId: "p1", channelId: "v"}]);
  });

  it("ignores other 🧩 channel types", () => {
    const plan = planSync(
      [{name: "R", puzzles: [{name: "P"}]}],
      [category("c", "R"), voice("v", "P", "c"), {id: "t", name: "P", type: 0, parentId: "c"}]
    );
    expect(plan.deleteVoices).toEqual([]);
    expect(plan.retireVoices).toEqual([]);
  });
});

describe("retryAfterSeconds", () => {
  it("prefers the body, then the header, then a second", () => {
    expect(retryAfterSeconds({retry_after: 2.5, global: false}, "3")).toBe(2.5);
    expect(retryAfterSeconds(undefined, "3")).toBe(3);
    expect(retryAfterSeconds({message: "x"}, null)).toBe(1);
  });
});
