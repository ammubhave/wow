import type {IWorkbookData} from "@univerjs/presets";
import {expect, test} from "vite-plus/test";

import {fingerprintContent} from "./sheet-fingerprint";

// Workbook JSON as each browser stores it (only the fields the fingerprint reads).
const workbook = (sheet: object, styles: object = {}): Partial<IWorkbookData> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a partial workbook for tests.
  ({
    sheetOrder: ["s"],
    sheets: {s: {id: "s", name: "Sheet1", ...sheet}},
    styles,
  }) as Partial<IWorkbookData>;

test("the same content gives the same fingerprint, whatever the style ids", () => {
  const a = workbook({cellData: {0: {0: {v: "x", s: "abc"}}}}, {abc: {bl: 1}});
  const b = workbook({cellData: {0: {0: {v: "x", s: "zz9"}}}}, {zz9: {bl: 1}});
  expect(fingerprintContent(a)).toBe(fingerprintContent(b));
});

test("key order doesn't matter", () => {
  const a = workbook({cellData: {0: {0: {v: 1}, 1: {v: 2}}}, rowCount: 10});
  const b = workbook({rowCount: 10, cellData: {0: {1: {v: 2}, 0: {v: 1}}}});
  expect(fingerprintContent(a)).toBe(fingerprintContent(b));
});

test("a formula cell counts by its formula, not its (computed) value", () => {
  const a = workbook({cellData: {0: {0: {f: "=NOW()", v: 1}}}});
  const b = workbook({cellData: {0: {0: {f: "=NOW()", v: 2}}}});
  expect(fingerprintContent(a)).toBe(fingerprintContent(b));
});

test("automatic row heights (measured by each browser) don't count", () => {
  const a = workbook({rowData: {0: {h: 24, ia: 1}}});
  const b = workbook({rowData: {0: {h: 31, ia: 1}}});
  expect(fingerprintContent(a)).toBe(fingerprintContent(b));
});

test("different content gives different fingerprints", () => {
  const a = workbook({cellData: {0: {0: {v: "x"}}}});
  const b = workbook({cellData: {0: {0: {v: "y"}}}});
  const moved = workbook({cellData: {1: {0: {v: "x"}}}});
  expect(fingerprintContent(a)).not.toBe(fingerprintContent(b));
  expect(fingerprintContent(a)).not.toBe(fingerprintContent(moved));
});
