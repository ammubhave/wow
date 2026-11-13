import {describe, expect, test} from "vite-plus/test";

import {clueNumbers, isBlackSquare, parseRangeRef} from "./sheet-crossword";

/** A grid from rows of text: `#` or `.` is a black square, a letter an open cell. */
const grid = (...rows: string[]) => rows.map(row => row.split("").map(ch => !isBlackSquare(ch)));

describe("clueNumbers", () => {
  test("numbers across and down starts in reading order", () => {
    expect(clueNumbers(grid("ABC#", "DEFG", ".HIJ"))).toEqual([
      [1, 2, 3, null],
      [4, null, null, 5],
      [null, 6, null, null],
    ]);
  });
  test("a lone open cell gets no number", () => {
    expect(clueNumbers(grid("A#", "#B"))).toEqual([
      [null, null],
      [null, null],
    ]);
  });
});

describe("parseRangeRef", () => {
  test("reads a sheet-qualified absolute range", () =>
    expect(parseRangeRef("Sheet1!$A$1:$O$15")).toEqual({
      startRow: 0,
      endRow: 14,
      startColumn: 0,
      endColumn: 14,
    }));
  test("reads quoted sheet names and multi-letter columns", () =>
    expect(parseRangeRef("'My grid'!AA10:AB12")).toEqual({
      startRow: 9,
      endRow: 11,
      startColumn: 26,
      endColumn: 27,
    }));
  test("rejects anything else", () => expect(parseRangeRef("=SUM(A1:B2)")).toBeNull());
});
