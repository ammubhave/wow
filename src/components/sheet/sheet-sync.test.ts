import {describe, expect, test} from "vite-plus/test";

import type {SheetEntry, SheetMutation} from "@/server/do/sheet";

import {rebasePending} from "./sheet-sync";

const U = {unitId: "u", subUnitId: "s"};
const insRow = (r: number): SheetMutation => ({
  id: "sheet.mutation.insert-row",
  params: {...U, range: {startRow: r, endRow: r, startColumn: 0, endColumn: 25, rangeType: 1}},
});
const set = (r: number, v: string): SheetMutation => ({
  id: "sheet.mutation.set-range-values",
  params: {...U, cellValue: {[r]: {0: {v}}}},
});
const entry = (seq: number, batchId: string, mutations: SheetMutation[]): SheetEntry => ({
  seq,
  batchId,
  mutations,
});

describe("edits kept through a resync", () => {
  test("unsent edits move over the entries this client hadn't seen", () => {
    // Made on top of entry 5; the room has 4-7 after its snapshot at 3.
    const result = rebasePending({inflight: null, buffer: [set(4, "x")], since: 5}, 3, [
      entry(4, "t1", [set(0, "a")]),
      entry(5, "t2", [set(1, "b")]),
      entry(6, "t3", [insRow(0)]),
    ]);
    expect(result).toEqual({mutations: [set(5, "x")], exact: true});
  });
  test("the batch in flight is dropped if the room has it, and later edits move over the rest", () => {
    const result = rebasePending(
      {inflight: {batchId: "mine", mutations: [set(2, "sent")]}, buffer: [set(4, "x")], since: 5},
      0,
      [entry(6, "t1", [insRow(0)]), entry(7, "mine", [set(3, "sent")]), entry(8, "t2", [insRow(0)])]
    );
    expect(result).toEqual({mutations: [set(6, "x")], exact: true});
  });
  test("a batch the room doesn't have is kept, ahead of later edits", () => {
    const result = rebasePending(
      {inflight: {batchId: "mine", mutations: [set(2, "sent")]}, buffer: [set(4, "x")], since: 5},
      0,
      [entry(6, "t1", [insRow(0)])]
    );
    expect(result).toEqual({mutations: [set(3, "sent"), set(5, "x")], exact: true});
  });
  test("a teammate's write of the same cell ordered first gives way to ours", () => {
    const result = rebasePending({inflight: null, buffer: [set(0, "mine")], since: 1}, 0, [
      entry(2, "t1", [set(0, "theirs")]),
    ]);
    expect(result.mutations).toEqual([set(0, "mine")]);
  });
  test("offline past the snapshot: the edits are redone as made, and flagged", () => {
    const result = rebasePending({inflight: null, buffer: [set(4, "x")], since: 2}, 10, [
      entry(11, "t1", [insRow(0)]),
    ]);
    expect(result).toEqual({mutations: [set(5, "x")], exact: false});
  });
  test("nothing pending: nothing to redo", () => {
    expect(rebasePending({inflight: null, buffer: [], since: 0}, 0, [])).toEqual({
      mutations: [],
      exact: true,
    });
  });
});
