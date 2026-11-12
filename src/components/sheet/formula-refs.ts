import {type IRange, RANGE_TYPE} from "@univerjs/presets";

/**
 * Moving the cell references inside a formula, for an edit made at the same moment as a teammate
 * inserted, deleted or moved rows or columns: `=SUM(A5:A9)` typed while someone inserted a row
 * above row 5 becomes `=SUM(A6:A10)`, the way Univer (and Google Sheets) update formulas that
 * already existed. A reference whose cells were all deleted becomes #REF!.
 */

const colToIndex = (letters: string) =>
  letters
    .toUpperCase()
    .split("")
    .reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function indexToCol(index: number) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// An optional sheet ('Name with spaces'! or Name!), then A1, A1:B2, A:C (columns) or 1:5 (rows),
// each part optionally $-anchored. Not inside a word or before "(" (so LOG10( or A1Z26( aren't
// references), and not part of a longer name.
const SHEET = String.raw`(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!`;
const CELL = String.raw`(\$?)([A-Za-z]{1,3})(\$?)(\d+)`;
const REFERENCE = new RegExp(
  String.raw`(?<![\w.$'!])(?:${SHEET})?(?:${CELL}(?::${CELL})?|(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})|(\$?)(\d+):(\$?)(\d+))(?![\w(])`,
  "g"
);

/** A cell reference, keeping its $ anchors. */
const cell = (col: number, row: number, col$: string, row$: string) =>
  `${col$}${indexToCol(col)}${row$}${row + 1}`;

type Anchors = {col1: string; row1: string; col2: string; row2: string};

/**
 * Rewrites the references in `formula` (a formula in a cell on sheet `cellSheet`) that point at
 * sheet `movedSheet`, through `map` (null: the referenced cells are gone). `sheetIdOf` turns a
 * sheet name written in the formula into its id.
 */
export function shiftFormula(
  formula: string,
  cellSheet: string,
  movedSheet: string,
  map: (range: IRange) => IRange | null,
  sheetIdOf: (name: string) => string | undefined
): string {
  // Text in double quotes isn't references: only rewrite the parts between string literals.
  return formula
    .split(/("(?:[^"]|"")*")/)
    .map((part, i) => (i % 2 === 1 ? part : shiftPart(part)))
    .join("");

  function shiftPart(text: string) {
    return text.replace(REFERENCE, (match, ...groups: (string | undefined)[]) => {
      const [quoted, bare] = groups;
      const sheetName = quoted?.replaceAll("''", "'") ?? bare;
      const sheet = sheetName === undefined ? cellSheet : sheetIdOf(sheetName);
      if (sheet !== movedSheet) return match;
      const prefix = sheetName === undefined ? "" : match.slice(0, match.indexOf("!") + 1);

      let range: IRange;
      let anchors: Anchors;
      let kind: "cells" | "single" | "cols" | "rows";
      const [, , c1$, c1, r1$, r1, c2$, c2, r2$, r2, kc1$, kc1, kc2$, kc2, kr1$, kr1, kr2$, kr2] =
        groups;
      if (c1 !== undefined && r1 !== undefined) {
        kind = c2 === undefined ? "single" : "cells";
        range = {
          startColumn: colToIndex(c1),
          startRow: Number(r1) - 1,
          endColumn: colToIndex(c2 ?? c1),
          endRow: Number(r2 ?? r1) - 1,
        };
        anchors = {col1: c1$ ?? "", row1: r1$ ?? "", col2: c2$ ?? "", row2: r2$ ?? ""};
      } else if (kc1 !== undefined && kc2 !== undefined) {
        kind = "cols";
        range = {
          startColumn: colToIndex(kc1),
          endColumn: colToIndex(kc2),
          startRow: 0,
          endRow: 0,
          rangeType: RANGE_TYPE.COLUMN,
        };
        anchors = {col1: kc1$ ?? "", row1: "", col2: kc2$ ?? "", row2: ""};
      } else if (kr1 !== undefined && kr2 !== undefined) {
        kind = "rows";
        range = {
          startRow: Number(kr1) - 1,
          endRow: Number(kr2) - 1,
          startColumn: 0,
          endColumn: 0,
          rangeType: RANGE_TYPE.ROW,
        };
        anchors = {col1: "", row1: kr1$ ?? "", col2: "", row2: kr2$ ?? ""};
      } else {
        return match;
      }

      const moved = map(range);
      if (!moved) return "#REF!";
      switch (kind) {
        case "single":
          return prefix + cell(moved.startColumn, moved.startRow, anchors.col1, anchors.row1);
        case "cells":
          return `${prefix}${cell(moved.startColumn, moved.startRow, anchors.col1, anchors.row1)}:${cell(moved.endColumn, moved.endRow, anchors.col2, anchors.row2)}`;
        case "cols":
          return `${prefix}${anchors.col1}${indexToCol(moved.startColumn)}:${anchors.col2}${indexToCol(moved.endColumn)}`;
        default:
          return `${prefix}${anchors.row1}${moved.startRow + 1}:${anchors.row2}${moved.endRow + 1}`;
      }
    });
  }
}
