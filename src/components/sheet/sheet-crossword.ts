import type {FWorksheet} from "@univerjs/preset-sheets-core";
import {BorderStyleTypes, BorderType, type FUniver} from "@univerjs/presets";

import type {SheetRange} from "@/server/do/sheet";

/**
 * Crossword grids in the built-in sheet: a range of square, bordered cells where typing `#` or
 * `.` makes a black square, with clue numbers drawn in the corners (by CrosswordOverlay).
 *
 * A grid is remembered as a hidden defined name (`crossword_…`) scoped to its sheet, so it syncs
 * and is saved like any other edit, and moves with rows and columns inserted above or beside it.
 */
export const CROSSWORD_NAME_PREFIX = "crossword_";

/** Cell size of a crossword grid, in pixels. */
const CELL_SIZE = 30;

/** A black square: `#` or `.` (what solvers type for one). */
export const isBlackSquare = (value: unknown) => value === "#" || value === ".";

/**
 * Clue numbers, as in a printed crossword: in reading order, every open cell that starts an
 * across word (no open cell to its left, one to its right) or a down word gets the next number.
 */
export function clueNumbers(open: boolean[][]): (number | null)[][] {
  let next = 1;
  return open.map((row, r) =>
    row.map((isOpen, c) => {
      if (!isOpen) return null;
      const across = !row[c - 1] && Boolean(row[c + 1]);
      const down = !open[r - 1]?.[c] && Boolean(open[r + 1]?.[c]);
      return across || down ? next++ : null;
    })
  );
}

const columnIndex = (letters: string) =>
  letters
    .toUpperCase()
    .split("")
    .reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** A defined name's range ("Sheet1!$A$1:$O$15", sheet name optional), or null if it isn't one. */
export function parseRangeRef(ref: string): SheetRange | null {
  const match = /^(?:.*!)?\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(ref.trim());
  if (!match) return null;
  const [, c1, r1, c2, r2] = match;
  const rows = [Number(r1) - 1, Number(r2) - 1];
  const cols = [columnIndex(c1!), columnIndex(c2!)];
  return {
    startRow: Math.min(...rows),
    endRow: Math.max(...rows),
    startColumn: Math.min(...cols),
    endColumn: Math.max(...cols),
  };
}

export type CrosswordGrid = {name: string; sheetId: string; range: SheetRange};

/** The workbook's crossword grids. */
export function crosswordGrids(api: FUniver): CrosswordGrid[] {
  const workbook = api.getActiveWorkbook();
  if (!workbook) return [];
  return workbook.getDefinedNames().flatMap(definedName => {
    const name = definedName.getName();
    const sheetId = definedName.getLocalSheetId();
    const range = parseRangeRef(definedName.getFormulaOrRefString());
    return name.startsWith(CROSSWORD_NAME_PREFIX) && sheetId && range
      ? [{name, sheetId, range}]
      : [];
  });
}

const overlaps = (a: SheetRange, b: SheetRange) =>
  a.startRow <= b.endRow &&
  b.startRow <= a.endRow &&
  a.startColumn <= b.endColumn &&
  b.startColumn <= a.endColumn;

/** Grids on `sheet` that overlap `range`. */
export function gridsAt(api: FUniver, sheet: FWorksheet, range: SheetRange) {
  return crosswordGrids(api).filter(
    grid => grid.sheetId === sheet.getSheetId() && overlaps(grid.range, range)
  );
}

/**
 * Turns `range` into a crossword grid: square cells with borders, big centred letters, `#` and `.`
 * as black squares (conditional formatting, so it stays in step with what's typed), and the grid
 * remembered for clue numbering. A grid it overlaps is replaced.
 */
export function makeCrosswordGrid(api: FUniver, sheet: FWorksheet, range: SheetRange) {
  const workbook = api.getActiveWorkbook();
  if (!workbook) return;
  const rows = range.endRow - range.startRow + 1;
  const cols = range.endColumn - range.startColumn + 1;
  for (const old of gridsAt(api, sheet, range)) workbook.deleteDefinedName(old.name);

  sheet.setColumnWidths(range.startColumn, cols, CELL_SIZE);
  sheet.setRowHeights(range.startRow, rows, CELL_SIZE);
  const cells = sheet.getRange(range.startRow, range.startColumn, rows, cols);
  cells
    .setBorder(BorderType.ALL, BorderStyleTypes.THIN, "#808080")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("bottom")
    .setFontWeight("bold")
    .setFontSize(13);
  for (const text of ["#", "."]) {
    sheet.addConditionalFormattingRule(
      sheet
        .newConditionalFormattingRule()
        .whenTextEqualTo(text)
        .setRanges([cells.getRange()])
        .setBackground("#000000")
        .setFontColor("#000000")
        .build()
    );
  }
  workbook.insertDefinedNameBuilder(
    workbook
      .newDefinedNameBuilder()
      .setName(`${CROSSWORD_NAME_PREFIX}${crypto.randomUUID().slice(0, 8)}`)
      .setRefByRange(range.startRow, range.startColumn, rows, cols)
      .setScopeToWorksheet(sheet)
      .setHidden(true)
      .build()
  );
}

/** Stops numbering the grids that overlap `range` (their cells keep their look and letters). */
export function removeCrosswordGrids(api: FUniver, sheet: FWorksheet, range: SheetRange) {
  const workbook = api.getActiveWorkbook();
  const grids = gridsAt(api, sheet, range);
  for (const grid of grids) workbook?.deleteDefinedName(grid.name);
  return grids.length;
}
