import {describe, expect, test} from "vite-plus/test";

import type {SheetMutation} from "@/server/do/sheet";

import {setSheetNameResolver, transform} from "./sheet-ot";

const U = {unitId: "u", subUnitId: "s"};
const row = (r: number, n = 1) => ({
  startRow: r,
  endRow: r + n - 1,
  startColumn: 0,
  endColumn: 25,
  rangeType: 1,
});
const col = (c: number, n = 1) => ({
  startRow: 0,
  endRow: 999,
  startColumn: c,
  endColumn: c + n - 1,
  rangeType: 2,
});
const insRow = (r: number, n = 1, sheet = "s"): SheetMutation => ({
  id: "sheet.mutation.insert-row",
  params: {unitId: "u", subUnitId: sheet, range: row(r, n)},
});
const delRow = (r: number, n = 1): SheetMutation => ({
  id: "sheet.mutation.remove-rows",
  params: {...U, range: row(r, n)},
});
const insCol = (c: number): SheetMutation => ({
  id: "sheet.mutation.insert-col",
  params: {...U, range: col(c)},
});
const set = (r: number, c: number, cell: object, sheet = "s"): SheetMutation => ({
  id: "sheet.mutation.set-range-values",
  params: {unitId: "u", subUnitId: sheet, cellValue: {[r]: {[c]: cell}}},
});

/** A mutation's written cells, by row then column. */
function cellsOf(m: SheetMutation | undefined): Record<string, Record<string, {f?: string}>> {
  const params = m?.params;
  if (typeof params !== "object" || params === null || !("cellValue" in params)) return {};
  const cells = params.cellValue;
  return typeof cells === "object" && cells !== null
    ? Object.fromEntries(
        Object.entries(cells).map(([r, cellsInRow]) => [
          r,
          typeof cellsInRow === "object" && cellsInRow !== null
            ? Object.fromEntries(Object.entries(cellsInRow))
            : {},
        ])
      )
    : {};
}

/** The single formula a transformed set-range-values writes. */
const formulaOf = (mutations: SheetMutation[]) =>
  Object.values(Object.values(cellsOf(mutations[0]))[0] ?? {})[0]?.f;

const merge = (r: number): SheetMutation => ({
  id: "sheet.mutation.add-worksheet-merge",
  params: {...U, ranges: [{startRow: r, endRow: r + 1, startColumn: 1, endColumn: 2}]},
});

const shifted = (formula: string, by: SheetMutation, sheet = "s") =>
  formulaOf(transform([set(0, 1, {f: formula}, sheet)], [by], false)[0]);

describe("values and structure", () => {
  test("a value below an inserted row moves down", () => {
    expect(transform([set(4, 0, {v: "x"})], [insRow(2)], false)[0]).toEqual([set(5, 0, {v: "x"})]);
  });
  test("a value above an inserted row stays", () => {
    expect(transform([set(4, 0, {v: "x"})], [insRow(6)], false)[0]).toEqual([set(4, 0, {v: "x"})]);
  });
  test("a row inserted at the value's row pushes it down", () => {
    expect(transform([set(4, 0, {v: "x"})], [insRow(4)], false)[0]).toEqual([set(5, 0, {v: "x"})]);
  });
  test("a value in a deleted row is dropped", () => {
    const [[result]] = transform([set(4, 0, {v: "x"})], [delRow(4)], false);
    expect(result?.params).toMatchObject({cellValue: {}});
  });
  test("a value below deleted rows moves up", () => {
    expect(transform([set(4, 0, {v: "x"})], [delRow(1, 2)], false)[0]).toEqual([
      set(2, 0, {v: "x"}),
    ]);
  });
  test("two inserts at the same row: the room's order decides, and both sides agree", () => {
    const [a, b] = transform([insRow(3)], [insRow(3, 2)], false);
    expect(a).toEqual([insRow(5)]);
    expect(b).toEqual([insRow(3, 2)]);
  });
  test("overlapping deletes remove each row once", () => {
    expect(transform([delRow(2, 4)], [delRow(4, 4)], false)[0]).toEqual([delRow(2, 2)]);
    expect(transform([delRow(3)], [delRow(2, 3)], false)[0]).toEqual([]);
  });
  test("deleting around a teammate's inserted rows keeps them", () => {
    expect(transform([delRow(2, 4)], [insRow(4, 2)], false)[0]).toEqual([
      delRow(6, 2),
      delRow(2, 2),
    ]);
  });
  test("merges move", () => {
    expect(transform([merge(5)], [insRow(0, 3)], false)[0]).toEqual([merge(8)]);
  });
  test("another sheet is unaffected", () => {
    const other = set(4, 0, {v: "y"}, "t");
    expect(transform([other], [insRow(0)], false)[0]).toEqual([other]);
  });
});

describe("formula references", () => {
  setSheetNameResolver(name => ({Sheet1: "s", "Other Sheet": "t"})[name]);

  test("a range below an insert moves", () => {
    expect(shifted("=SUM(A5:A9)", insRow(2))).toBe("=SUM(A6:A10)");
  });
  test("references above an insert stay", () => {
    expect(shifted("=A1+A2", insRow(2))).toBe("=A1+A2");
  });
  test("a range spanning an insert grows", () => {
    expect(shifted("=SUM(A2:A5)", insRow(2))).toBe("=SUM(A2:A6)");
  });
  test("$ anchors are kept", () => {
    expect(shifted("=$A$5*2", insRow(2))).toBe("=$A$6*2");
  });
  test("a deleted cell becomes #REF!", () => {
    expect(shifted("=A3+1", delRow(2))).toBe("=#REF!+1");
  });
  test("text in quotes is left alone", () => {
    expect(shifted('=A5&"A5"', insRow(2))).toBe('=A6&"A5"');
  });
  test("function names that look like cells are left alone", () => {
    expect(shifted("=LOG10(A5)+A1Z26(B5)", insRow(2))).toBe("=LOG10(A6)+A1Z26(B6)");
  });
  test("columns move on a column insert", () => {
    expect(shifted("=C1+SUM(B:D)", insCol(1))).toBe("=D1+SUM(C:E)");
  });
  test("whole rows move", () => {
    expect(shifted("=SUM(5:7)", insRow(2))).toBe("=SUM(6:8)");
  });
  test("a reference to another sheet moves with that sheet", () => {
    expect(shifted("='Other Sheet'!A5+A5", insRow(2, 1, "t"))).toBe("='Other Sheet'!A6+A5");
  });
  test("a reference naming its own sheet moves", () => {
    expect(shifted("=Sheet1!A5", insRow(2))).toBe("=Sheet1!A6");
  });
  test("the formula's cell moves too", () => {
    const [[result]] = transform([set(4, 1, {f: "=A5"})], [insRow(2)], false);
    expect(Object.keys(cellsOf(result))).toEqual(["5"]);
  });
});

/** A set-range-values writing `cellValue` (with more params in `extra`). */
const write = (cellValue: object, extra: object = {}): SheetMutation => ({
  id: "sheet.mutation.set-range-values",
  params: {...U, cellValue, ...extra},
});

describe("two writes of the same cells", () => {
  test("the room's order wins: the earlier write gives way, the later one keeps its cell", () => {
    // Teammate's Y was ordered first; ours (X, still unconfirmed) comes after it.
    const ours = write({0: {0: {v: "X"}}});
    const theirs = write({0: {0: {v: "Y"}}});
    const [oursAfter, theirsAfter] = transform([ours], [theirs], false);
    expect(oursAfter).toEqual([ours]);
    expect(theirsAfter).toEqual([]);
  });
  test("both sides agree whichever list is passed first", () => {
    const x = write({0: {0: {v: "X"}}});
    const y = write({0: {0: {v: "Y"}}});
    const [yAfter, xAfter] = transform([y], [x], true);
    expect(yAfter).toEqual([]);
    expect(xAfter).toEqual([x]);
  });
  test("only the overlapping cells are dropped", () => {
    const ours = write({0: {0: {v: "a"}, 1: {v: "b"}}, 1: {0: {v: "c"}}});
    const theirs = write({0: {1: {v: "B"}, 2: {v: "C"}}, 1: {0: {v: "D"}}, 2: {0: {v: "E"}}});
    const [oursAfter, theirsAfter] = transform([ours], [theirs], false);
    expect(oursAfter).toEqual([ours]);
    expect(theirsAfter).toEqual([write({0: {2: {v: "C"}}, 2: {0: {v: "E"}}})]);
  });
  test("a style write and a value write of the same cell both stay", () => {
    const ours = write({0: {0: {v: "X"}}});
    const theirs = write({0: {0: {s: {bl: 1}}}});
    expect(transform([ours], [theirs], false)[1]).toEqual([theirs]);
  });
  test("a value-and-style write gives way only where the later write overlaps", () => {
    const ours = write({0: {0: {v: "X"}}});
    const theirs = write({0: {0: {v: "Y", s: {bl: 1}}}});
    expect(transform([ours], [theirs], false)[1]).toEqual([write({0: {0: {s: {bl: 1}}}})]);
  });
  test("styles give way key by key, borders side by side", () => {
    const ours = write({0: {0: {s: {bl: 0, bd: {t: {s: 1}}}}}});
    const theirs = write({0: {0: {s: {bl: 1, it: 1, bd: {t: {s: 2}, b: {s: 2}}}}}});
    expect(transform([ours], [theirs], false)[1]).toEqual([
      write({0: {0: {s: {it: 1, bd: {b: {s: 2}}}}}}),
    ]);
  });
  test("a later style that replaces the whole style wins outright", () => {
    const ours = write({0: {0: {s: {bl: 1}}}}, {isOverrideStyle: true});
    const theirs = write({0: {0: {v: "Y", s: {it: 1}}}});
    expect(transform([ours], [theirs], false)[1]).toEqual([write({0: {0: {v: "Y"}}})]);
  });
  test("an earlier whole-style write keeps what the later write doesn't set", () => {
    const ours = write({0: {0: {s: {bl: 1}}}});
    const theirs = write({0: {0: {s: {it: 1, bl: 0}}}}, {isOverrideStyle: true});
    expect(transform([ours], [theirs], false)[1]).toEqual([
      write({0: {0: {s: {it: 1, bl: 1}}}}, {isOverrideStyle: true}),
    ]);
  });
  test("a later delete of the cell drops the earlier write", () => {
    const ours = write({0: {0: null}});
    const theirs = write({0: {0: {v: "Y"}, 1: {v: "Z"}}});
    expect(transform([ours], [theirs], false)[1]).toEqual([write({0: {1: {v: "Z"}}})]);
  });
  test("an earlier delete clears only what the later write doesn't set", () => {
    const ours = write({0: {0: {v: "X"}}});
    const theirs = write({0: {0: null}});
    expect(transform([ours], [theirs], false)[1]).toEqual([
      write({0: {0: {custom: null, s: null}}}),
    ]);
  });
  test("writes on different sheets don't interact", () => {
    const ours = set(0, 0, {v: "X"});
    const theirs = set(0, 0, {v: "Y"}, "t");
    expect(transform([ours], [theirs], false)[1]).toEqual([theirs]);
  });
  test("several pending writes: the teammate's write gives way to each", () => {
    const ours = [write({0: {0: {v: "X"}}}), write({1: {0: {v: "X2"}}})];
    const theirs = write({0: {0: {v: "Y"}}, 1: {0: {v: "Y2"}}, 2: {0: {v: "Y3"}}});
    const [oursAfter, theirsAfter] = transform(ours, [theirs], false);
    expect(oursAfter).toEqual(ours);
    expect(theirsAfter).toEqual([write({2: {0: {v: "Y3"}}})]);
  });
});

const moveRows = (from: number, n: number, to: number): SheetMutation => ({
  id: "sheet.mutation.move-rows",
  params: {...U, sourceRange: row(from, n), targetRange: row(to, n)},
});
const delCol = (c: number, n = 1): SheetMutation => ({
  id: "sheet.mutation.remove-col",
  params: {...U, range: col(c, n)},
});

/** A number in a mutation's params (or in an object in them, `inner`). */
function numberIn(m: SheetMutation | undefined, key: string, inner?: string): number {
  let value: unknown = m?.params;
  for (const k of inner === undefined ? [key] : [key, inner]) {
    value =
      typeof value === "object" && value !== null
        ? Object.entries(value).find(([name]) => name === k)?.[1]
        : undefined;
  }
  if (typeof value !== "number") throw new Error(`no ${key} in ${m?.id}`);
  return value;
}

/** A range's span along the rows. */
const rowSpan = (m: SheetMutation, key: string) => ({
  start: numberIn(m, key, "startRow"),
  end: numberIn(m, key, "endRow"),
});

/**
 * A sheet's rows by identity, with row inserts, removes and moves applied the way Univer applies
 * them (a move takes its rows out and puts them back before the row that was at its target).
 */
function applyRows(rows: string[], mutations: SheetMutation[], label: string): string[] {
  let out = [...rows];
  for (const m of mutations) {
    if (m.id === "sheet.mutation.insert-row") {
      const {start, end} = rowSpan(m, "range");
      out.splice(start, 0, ...Array.from({length: end - start + 1}, (_, i) => `${label}${i}`));
    } else if (m.id === "sheet.mutation.remove-rows") {
      const {start, end} = rowSpan(m, "range");
      out.splice(start, end - start + 1);
    } else if (m.id === "sheet.mutation.move-rows") {
      const from = rowSpan(m, "sourceRange");
      const to = rowSpan(m, "targetRange").start;
      const count = from.end - from.start + 1;
      // Univer throws on a move into itself (see moveMatrixArray).
      if (to >= from.start && to <= from.end) throw new Error("move into itself");
      const block = out.splice(from.start, count);
      out.splice(to < from.start ? to : to - count, 0, ...block);
    }
  }
  return out;
}

const ROWS = Array.from({length: 16}, (_, i) => `r${i}`);

/** Both orders of two concurrent edits end with the same rows. */
function expectConverges(a: SheetMutation, b: SheetMutation) {
  for (const aFirst of [true, false]) {
    const [a2, b2] = transform([a], [b], aFirst);
    const viaA = applyRows(applyRows(ROWS, [a], "a"), b2, "b");
    const viaB = applyRows(applyRows(ROWS, [b], "b"), a2, "a");
    expect(viaB).toEqual(viaA);
  }
}

describe("moving rows while a teammate inserts or deletes rows", () => {
  test("rows moved onto rows a teammate deleted land where those rows were", () => {
    const move = moveRows(1, 2, 10);
    const del = delRow(10, 2);
    const [moveAfter, delAfter] = transform([move], [del], false);
    expect(moveAfter).toEqual([moveRows(1, 2, 10)]);
    expect(delAfter).toEqual([delRow(10, 2)]);
    expectConverges(move, del);
  });
  test("the same, with the teammate's delete passed first", () => {
    const [delAfter, moveAfter] = transform([delRow(10, 2)], [moveRows(1, 2, 10)], true);
    expect(moveAfter).toEqual([moveRows(1, 2, 10)]);
    expect(delAfter).toEqual([delRow(10, 2)]);
  });
  test("a delete spanning the moved rows and their old place is split in two", () => {
    // Rows 9-11 deleted while rows 1-2 move to before row 10: after the move, row 9 sits above
    // the moved rows and rows 10-11 below them.
    const [delAfter] = transform([delRow(9, 3)], [moveRows(1, 2, 10)], false);
    expect(delAfter).toEqual([delRow(10, 2), delRow(7)]);
    expectConverges(moveRows(1, 2, 10), delRow(9, 3));
  });
  test("moving rows a teammate deleted does nothing", () => {
    expect(transform([moveRows(3, 2, 10)], [delRow(2, 4)], false)[0]).toEqual([]);
    expectConverges(moveRows(3, 2, 10), delRow(2, 4));
  });
  test("a move whose rows end up where they'd go is dropped, not sent into itself", () => {
    // Rows 3-4 deleted: rows 5-6 are then right where they were moving to (before old row 3).
    expect(transform([moveRows(5, 2, 3)], [delRow(3, 2)], false)[0]).toEqual([]);
    expectConverges(moveRows(5, 2, 3), delRow(3, 2));
  });
  test("a row inserted at the move's target stays below the moved rows", () => {
    expectConverges(moveRows(1, 2, 10), insRow(10));
    expectConverges(moveRows(8, 2, 3), insRow(3));
  });
  test("a row inserted inside the moved rows moves with them", () => {
    const [moveAfter] = transform([moveRows(2, 3, 10)], [insRow(3)], false);
    expect(moveAfter).toEqual([
      {
        id: "sheet.mutation.move-rows",
        params: {...U, sourceRange: row(2, 4), targetRange: row(11, 4)},
      },
    ]);
    expectConverges(moveRows(2, 3, 10), insRow(3));
  });
  test("every move against every insert and delete converges", () => {
    const moves: SheetMutation[] = [];
    for (let from = 0; from < 8; from++) {
      for (const n of [1, 2, 3]) {
        for (let to = 0; to <= 12; to++) {
          if (to < from || to > from + n) moves.push(moveRows(from, n, to));
        }
      }
    }
    const others: SheetMutation[] = [];
    for (let r = 0; r < 13; r++) {
      for (const n of [1, 2, 4]) others.push(insRow(r, n), delRow(r, n));
    }
    for (const move of moves) for (const other of others) expectConverges(move, other);
  });
});

/** A note added (or changed) at a cell. */
const note = (r: number, c: number): SheetMutation => ({
  id: "sheet.mutation.update-note",
  params: {unitId: "u", sheetId: "s", row: r, col: c, note: {id: "n", note: "hi"}},
});
const link = (r: number, c: number): SheetMutation => ({
  id: "sheets.mutation.add-hyper-link",
  params: {...U, link: {id: "l", row: r, column: c, payload: "https://example.com", display: ""}},
});
const rowHeight = (r: number, h: number): SheetMutation => ({
  id: "sheet.mutation.set-worksheet-row-height",
  params: {...U, ranges: [row(r)], rowHeight: {[r]: h}},
});
const autoHeight = (r: number, h: number): SheetMutation => ({
  id: "sheet.mutation.set-worksheet-row-auto-height",
  params: {...U, rowsAutoHeightInfo: [{row: r, autoHeight: h}]},
});
const colWidth = (c: number, w: number): SheetMutation => ({
  id: "sheet.mutation.set-worksheet-col-width",
  params: {...U, ranges: [col(c)], colWidth: {[c]: w}},
});

describe("notes, links and sizes follow teammates' inserts and deletes", () => {
  test("a note below an inserted row moves down", () => {
    expect(transform([note(4, 1)], [insRow(0)], false)[0]).toEqual([note(5, 1)]);
  });
  test("an inserted row moves the note whichever list is passed first", () => {
    expect(transform([insRow(0)], [note(4, 1)], true)[1]).toEqual([note(5, 1)]);
  });
  test("a note in a deleted row is dropped", () => {
    expect(transform([note(4, 1)], [delRow(3, 2)], false)[0]).toEqual([]);
  });
  test("a note below deleted rows moves up", () => {
    expect(transform([note(4, 1)], [delRow(0, 2)], false)[0]).toEqual([note(2, 1)]);
  });
  test("a note right of an inserted column moves right", () => {
    expect(transform([note(4, 1)], [insCol(0)], false)[0]).toEqual([note(4, 2)]);
    expect(transform([note(4, 1)], [delCol(0)], false)[0]).toEqual([note(4, 0)]);
  });
  test("a note on another sheet stays", () => {
    expect(transform([note(4, 1)], [insRow(0, 1, "t")], false)[0]).toEqual([note(4, 1)]);
  });
  test("a note follows its row through a teammate's move", () => {
    // Rows 1-2 move to before row 10: row 4 moves up two.
    expect(transform([note(4, 1)], [moveRows(1, 2, 10)], false)[0]).toEqual([note(2, 1)]);
  });
  test("a note moved by a teammate's insert follows it", () => {
    const move: SheetMutation = {
      id: "sheet.mutation.update-note-position",
      params: {unitId: "u", sheetId: "s", noteId: "n", newPosition: {row: 4, col: 1}},
    };
    expect(transform([move], [insRow(0)], false)[0]).toEqual([
      {
        id: "sheet.mutation.update-note-position",
        params: {unitId: "u", sheetId: "s", noteId: "n", newPosition: {row: 5, col: 1}},
      },
    ]);
  });
  test("a link moves with its cell", () => {
    expect(transform([link(4, 1)], [insRow(2)], false)[0]).toEqual([link(5, 1)]);
    expect(transform([link(4, 1)], [insCol(1)], false)[0]).toEqual([link(4, 2)]);
    expect(transform([link(4, 1)], [delRow(4)], false)[0]).toEqual([]);
  });
  test("a row height moves with its row", () => {
    expect(transform([rowHeight(5, 40)], [insRow(0)], false)[0]).toEqual([rowHeight(6, 40)]);
    expect(transform([autoHeight(5, 40)], [insRow(0)], false)[0]).toEqual([autoHeight(6, 40)]);
    expect(transform([rowHeight(5, 40)], [delRow(0, 2)], false)[0]).toEqual([rowHeight(3, 40)]);
  });
  test("a row height on a deleted row is dropped", () => {
    expect(transform([autoHeight(5, 40)], [delRow(5)], false)[0]).toEqual([
      {id: "sheet.mutation.set-worksheet-row-auto-height", params: {...U, rowsAutoHeightInfo: []}},
    ]);
  });
  test("a column width moves with its column", () => {
    expect(transform([colWidth(3, 120)], [insCol(1)], false)[0]).toEqual([colWidth(4, 120)]);
    expect(transform([colWidth(3, 120)], [delCol(0, 2)], false)[0]).toEqual([colWidth(1, 120)]);
  });
  test("a note ends up on the same row for everyone", () => {
    // Where this note is attaches to a row; teammates' inserts and deletes carry it along (Univer
    // moves notes it already has itself). Both orders must put it on the same row.
    for (const other of [insRow(0), insRow(4), insRow(5, 2), delRow(0, 2), delRow(2, 2)]) {
      for (const aFirst of [true, false]) {
        const [[noteAfter]] = transform([note(4, 1)], [other], aFirst);
        const rowsAfter = applyRows(ROWS, [other], "b");
        expect(rowsAfter[numberIn(noteAfter, "row")]).toBe(ROWS[4]);
      }
    }
  });
});
