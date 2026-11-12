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
