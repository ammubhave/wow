import {adjustRangeOnMutation} from "@univerjs/preset-sheets-core";
import {type IRange, RANGE_TYPE} from "@univerjs/presets";

import type {SheetRange} from "@/server/do/sheet";
import type {SheetMutation} from "@/server/do/sheet";

import {shiftFormula} from "./formula-refs";

type MoveMutation = Parameters<typeof adjustRangeOnMutation>[1];

/**
 * Operational transformation for Univer mutations, so concurrent edits converge.
 *
 * `transform(a, b, aFirst)` rewrites `a` so it can be applied *after* `b`, when both were made
 * against the same sheet: e.g. a value typed into A5 while a teammate inserted a row above it
 * lands in A6. Only structural mutations (inserting, removing or moving rows, columns or ranges,
 * and removing a sheet) move things; every other mutation just has its positions mapped through
 * them. `aFirst` breaks ties (two inserts at the same row, two writes of the same cell): the
 * room's order decides.
 */

const INSERT_ROW = "sheet.mutation.insert-row";
const INSERT_COL = "sheet.mutation.insert-col";
const REMOVE_ROWS = "sheet.mutation.remove-rows";
const REMOVE_COL = "sheet.mutation.remove-col";
const MOVE_ROWS = "sheet.mutation.move-rows";
const MOVE_COLS = "sheet.mutation.move-columns";
const MOVE_RANGE = "sheet.mutation.move-range";
const REMOVE_SHEET = "sheet.mutation.remove-sheet";

type Axis = "row" | "col";
type Span = {start: number; end: number};

type Structural =
  | {kind: "insert"; axis: Axis; at: number; count: number}
  | {kind: "remove"; axis: Axis; start: number; end: number}
  | {kind: "move"; mutation: MoveMutation; rows?: RowMove}
  | {kind: "removeSheet"};

/**
 * A move of whole rows (or columns): the ones in `from` are taken out and put back before the row
 * that was at `to` (as Univer's moveMatrixArray does), so `to` is outside `from`.
 */
type RowMove = {axis: Axis; from: Span; to: number};

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isRange(value: unknown): value is IRange {
  return (
    isObj(value) &&
    typeof value.startRow === "number" &&
    typeof value.endRow === "number" &&
    typeof value.startColumn === "number" &&
    typeof value.endColumn === "number"
  );
}

const paramsOf = (m: SheetMutation): Obj => (isObj(m.params) ? m.params : {});
const subUnitOf = (m: SheetMutation) => {
  const params = paramsOf(m);
  if (typeof params.subUnitId === "string") return params.subUnitId;
  // move-range names its sheets inside `from`/`to`.
  if (isObj(params.from) && typeof params.from.subUnitId === "string") return params.from.subUnitId;
  // Notes name their sheet `sheetId`.
  if (typeof params.sheetId === "string") return params.sheetId;
  return undefined;
};

function rangeParam(m: SheetMutation): IRange | undefined {
  const range = paramsOf(m).range;
  return isRange(range) ? range : undefined;
}

const spanOf = (range: IRange, axis: Axis): Span =>
  axis === "row"
    ? {start: range.startRow, end: range.endRow}
    : {start: range.startColumn, end: range.endColumn};

/** How `m` moves positions, if it does. */
function structural(m: SheetMutation): Structural | undefined {
  const range = rangeParam(m);
  switch (m.id) {
    case INSERT_ROW:
    case INSERT_COL: {
      if (!range) return undefined;
      const axis = m.id === INSERT_ROW ? "row" : "col";
      const span = spanOf(range, axis);
      return {kind: "insert", axis, at: span.start, count: span.end - span.start + 1};
    }
    case REMOVE_ROWS:
    case REMOVE_COL: {
      if (!range) return undefined;
      const axis = m.id === REMOVE_ROWS ? "row" : "col";
      return {kind: "remove", axis, ...spanOf(range, axis)};
    }
    case MOVE_ROWS:
    case MOVE_COLS:
    case MOVE_RANGE: {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Univer's own mutation JSON.
      const move: Structural = {kind: "move", mutation: m as MoveMutation};
      const {sourceRange, targetRange} = paramsOf(m);
      if (m.id === MOVE_RANGE || !isRange(sourceRange) || !isRange(targetRange)) return move;
      const axis = m.id === MOVE_ROWS ? "row" : "col";
      return {
        ...move,
        rows: {axis, from: spanOf(sourceRange, axis), to: spanOf(targetRange, axis).start},
      };
    }
    case REMOVE_SHEET:
      return {kind: "removeSheet"};
    default:
      return undefined;
  }
}

/** A span after `b` (insert or remove along the same axis); null if it was removed entirely. */
function mapSpan(span: Span, b: Structural & {kind: "insert" | "remove"}): Span | null {
  if (b.kind === "insert") {
    if (b.at <= span.start) return {start: span.start + b.count, end: span.end + b.count};
    // Inserted inside the span: the span grows to include it (like a formula reference does).
    if (b.at <= span.end) return {start: span.start, end: span.end + b.count};
    return span;
  }
  const removedBefore = (p: number) => Math.max(0, Math.min(b.end, p) - b.start + 1);
  const start = span.start - removedBefore(span.start - 1);
  const end = span.end - removedBefore(span.end);
  return end < start ? null : {start, end};
}

/** Where row (or column) `p` ends up after `move`. */
function movedIndex(p: number, {from, to}: RowMove): number {
  const count = from.end - from.start + 1;
  if (p >= from.start && p <= from.end) {
    return (to < from.start ? to : to - count) + p - from.start;
  }
  if (to < from.start) return p >= to && p < from.start ? p + count : p;
  return p > from.end && p < to ? p - count : p;
}

/** Whether `move` leaves every row where it was (its rows go back where they came from). */
const movesNothing = ({from, to}: RowMove) => to >= from.start && to <= from.end + 1;

/**
 * Rows inserted before row `at`, after `move`. They stay before the row they were inserted
 * above, so rows inserted inside the moved rows go with them. Rows inserted right above the moved
 * rows stay where those were, like rows inserted right below them, rather than going along.
 */
function insertedAt(at: number, move: RowMove): number {
  const {from} = move;
  if (at > from.start && at <= from.end) return movedIndex(at, move);
  return movedIndex(at === from.start ? from.end + 1 : at, move);
}

/**
 * Rows `start`..`end` after `move`, as runs of adjacent rows from the bottom up (so removing them
 * in order doesn't shift the ones still to remove): the move may have split them up.
 */
function movedRuns(start: number, end: number, move: RowMove): Span[] {
  const rows: number[] = [];
  for (let r = start; r <= end; r++) rows.push(movedIndex(r, move));
  rows.sort((x, y) => y - x);
  const runs: Span[] = [];
  for (const r of rows) {
    const last = runs.at(-1);
    if (last && last.start === r + 1) last.start = r;
    else runs.push({start: r, end: r});
  }
  return runs;
}

/** A range after `b`; null if every cell of it was removed. */
export function mapRange(range: IRange, b: Structural): IRange | null {
  if (b.kind === "removeSheet") return null;
  if (b.kind === "move") return adjustRangeOnMutation(range, b.mutation) ?? null;
  const type = range.rangeType ?? RANGE_TYPE.NORMAL;
  // A whole row isn't changed by inserting columns (and a whole column by inserting rows).
  if (type === RANGE_TYPE.ALL) return range;
  if (b.axis === "row" && type === RANGE_TYPE.COLUMN) return range;
  if (b.axis === "col" && type === RANGE_TYPE.ROW) return range;
  const span = mapSpan(spanOf(range, b.axis), b);
  if (!span) return null;
  return b.axis === "row"
    ? {...range, startRow: span.start, endRow: span.end}
    : {...range, startColumn: span.start, endColumn: span.end};
}

const isIndexKey = (key: string) => /^\d+$/.test(key);

/** `{row: {col: value}}`, as Univer's cell matrices are stored. */
function isMatrix(value: unknown): value is Record<string, Obj> {
  if (!isObj(value)) return false;
  const rows = Object.entries(value);
  return rows.length > 0 && rows.every(([key, row]) => isIndexKey(key) && isObj(row));
}

/** Moves every cell of a matrix through `b`, dropping cells that were removed. */
function mapMatrix(matrix: Record<string, Obj>, b: Structural): Record<string, Obj> {
  const out: Record<string, Obj> = {};
  for (const [rowKey, row] of Object.entries(matrix)) {
    for (const [colKey, cell] of Object.entries(row)) {
      const r = Number(rowKey);
      const c = Number(colKey);
      const mapped = mapRange({startRow: r, endRow: r, startColumn: c, endColumn: c}, b);
      if (!mapped) continue;
      (out[mapped.startRow] ??= {})[mapped.startColumn] = cell;
    }
  }
  return out;
}

/** Row (or column) `index` after `b`; null if it was removed. */
function mapIndex(index: number, axis: Axis, b: Structural): number | null {
  const mapped = mapRange(
    axis === "row"
      ? {startRow: index, endRow: index, startColumn: 0, endColumn: 0, rangeType: RANGE_TYPE.ROW}
      : {
          startRow: 0,
          endRow: 0,
          startColumn: index,
          endColumn: index,
          rangeType: RANGE_TYPE.COLUMN,
        },
    b
  );
  if (!mapped) return null;
  return axis === "row" ? mapped.startRow : mapped.startColumn;
}

/**
 * Params keyed by row (or column) number, e.g. set-worksheet-row-height's `rowHeight: {5: 40}`
 * (a single number applies to every row in its `ranges`, which are mapped anyway).
 */
const INDEX_KEYED: Record<string, Axis> = {
  rowHeight: "row",
  autoHeightInfo: "row",
  rowData: "row",
  colWidth: "col",
  columnData: "col",
};

function mapIndexKeys(value: Obj, axis: Axis, b: Structural): Obj {
  const out: Obj = {};
  for (const [key, v] of Object.entries(value)) {
    const mapped = mapIndex(Number(key), axis, b);
    if (mapped !== null) out[mapped] = v;
  }
  return out;
}

/**
 * Mutations that name a cell by `row` and `col` (or `column`) instead of by range: notes and
 * links, which Univer keeps apart from the cells. These are where in the params ("" is the params
 * themselves). Univer moves the notes and links a client already has when a teammate's insert or
 * delete arrives, so only these, made at the same time, need moving.
 */
const CELL_POSITIONS: Record<string, string[]> = {
  "sheet.mutation.update-note": [""],
  "sheet.mutation.remove-note": [""],
  "sheet.mutation.toggle-note-popup": [""],
  "sheet.mutation.update-note-position": ["", "newPosition"],
  "sheets.mutation.add-hyper-link": ["link"],
  "sheets.mutation.update-hyper-link-ref": [""],
  "sheets.mutation.update-rich-hyper-link": [""],
};

/** A `{row, col}` (or `{row, column}`) after `b`; null if its cell was removed. */
function mapCell(cell: Obj, b: Structural): Obj | null {
  const colKey = "col" in cell ? "col" : "column";
  const r = cell.row;
  const c = cell[colKey];
  // Some name the note or link by id alone.
  if (typeof r !== "number" || typeof c !== "number") return cell;
  const mapped = mapRange({startRow: r, endRow: r, startColumn: c, endColumn: c}, b);
  return mapped && {...cell, row: mapped.startRow, [colKey]: mapped.startColumn};
}

/** Moves the cells a note or link mutation names; null if one was removed (nothing to act on). */
function mapCellPositions(id: string, params: Obj, b: Structural): Obj | null {
  let out = params;
  for (const path of CELL_POSITIONS[id] ?? []) {
    const cell = path === "" ? out : out[path];
    if (!isObj(cell)) continue;
    const mapped = mapCell(cell, b);
    if (!mapped) return null;
    out = path === "" ? mapped : {...out, [path]: mapped};
  }
  return out;
}

/**
 * Maps every position inside a mutation's params through `b`: ranges (`range`, `ranges`,
 * `sourceRange`...) and cell matrices (`cellValue`, `value`). Returns null when the mutation's
 * main range (`range`) is gone, since it would then have nothing to act on.
 */
function mapParams(value: unknown, b: Structural, key = ""): unknown {
  if (isRange(value)) {
    const mapped = mapRange(value, b);
    return mapped ?? (key === "range" ? null : undefined);
  }
  if (key === "rowsAutoHeightInfo" && Array.isArray(value)) {
    // set-worksheet-row-auto-height: `[{row, autoHeight}]`; rows that were removed are dropped.
    return value.flatMap(item => {
      if (!isObj(item) || typeof item.row !== "number") return [item];
      const mapped = mapIndex(item.row, "row", b);
      return mapped === null ? [] : [{...item, row: mapped}];
    });
  }
  if (Array.isArray(value)) {
    return value.map(item => mapParams(item, b)).filter(item => item !== undefined);
  }
  if (isMatrix(value) && (key === "cellValue" || key === "value")) return mapMatrix(value, b);
  const axis = INDEX_KEYED[key];
  if (axis && isObj(value) && Object.keys(value).every(isIndexKey)) {
    return mapIndexKeys(value, axis, b);
  }
  if (isObj(value)) {
    const out: Obj = {};
    for (const [k, v] of Object.entries(value)) {
      const mapped = mapParams(v, b, k);
      if (mapped === null && k === "range") return null;
      if (mapped !== undefined) out[k] = mapped;
    }
    return out;
  }
  return value;
}

function withRange(m: SheetMutation, range: IRange): SheetMutation {
  return {id: m.id, params: {...paramsOf(m), range}};
}

/** Looks up a sheet's id by the name a formula uses for it (set by the workbook's SheetSync). */
let sheetIdByName: (name: string) => string | undefined = () => undefined;
export function setSheetNameResolver(resolve: (name: string) => string | undefined) {
  sheetIdByName = resolve;
}

/**
 * Moves the references in the formulas a mutation writes (cells in `cellValue`, on sheet
 * `cellSheet`) through `b`, which changed sheet `movedSheet`.
 */
function shiftFormulas(m: SheetMutation, cellSheet: string, movedSheet: string, b: Structural) {
  const params = paramsOf(m);
  if (!isMatrix(params.cellValue)) return m;
  const cells: Record<string, Obj> = {};
  for (const [rowKey, row] of Object.entries(params.cellValue)) {
    const out: Obj = {};
    for (const [colKey, cell] of Object.entries(row)) {
      out[colKey] =
        isObj(cell) && typeof cell.f === "string"
          ? {
              ...cell,
              f: shiftFormula(cell.f, cellSheet, movedSheet, r => mapRange(r, b), sheetIdByName),
            }
          : cell;
    }
    cells[rowKey] = out;
  }
  return {id: m.id, params: {...params, cellValue: cells}};
}

/** Looks up a cell style the workbook stores by id (`s` may name one instead of spelling it out). */
let styleById: (id: string) => unknown = () => undefined;
export function setStyleResolver(resolve: (id: string) => unknown) {
  styleById = resolve;
}

const SET_RANGE_VALUES = "sheet.mutation.set-range-values";

/**
 * The parts of a cell Univer's set-range-values writes independently (see its `mergeCellData`):
 * keys a cell write leaves out are kept. `s` (style) is merged key by key, `custom` is replaced
 * whole, and the rest are the cell's content, which go together (a new `v` drops the old rich
 * text `p`, a new `f` its cached result, and so on).
 */
const CUSTOM = "custom";
const STYLE = "s";
const BORDER = "bd";
/** What a cell's content is cleared with (as Univer's own "clear contents" does). */
const CLEARED_CONTENT = {v: null, t: null, f: null, si: null, p: null};

const writesContent = (cell: Obj) => Object.keys(cell).some(k => k !== STYLE && k !== CUSTOM);

/** A style (`s`) as an object, if it is one or names one the workbook has. */
function styleObject(style: unknown): Obj | undefined {
  const found = typeof style === "string" ? styleById(style) : style;
  return isObj(found) ? found : undefined;
}

/**
 * The style `a` writes (merging unless `aOverrides`) minus what `b`'s later style write sets
 * anyway; undefined if nothing of it is left.
 */
function styleAfter(aStyle: unknown, aOverrides: boolean, bStyle: unknown, bOverrides: boolean) {
  // `b` replaces the whole style (or clears it): nothing of `a`'s shows.
  if (bOverrides || bStyle === null) return undefined;
  const bs = styleObject(bStyle);
  // A style this workbook can't look up: `b` may set any of its keys, so it wins outright.
  if (!bs) return undefined;
  if (aStyle === null) {
    // `a` cleared the style, then `b` set some of it: the keys `b` sets win. (The old style's
    // other keys, which `a` cleared, can't be cleared from here without knowing them.)
    return undefined;
  }
  const as = styleObject(aStyle);
  if (!as) return undefined;
  if (aOverrides) {
    // `a` replaces the whole style: replace it with `a`'s, then `b`'s merged on top.
    const merged: Obj = {...as, ...bs};
    const aBorder = as[BORDER];
    const bBorder = bs[BORDER];
    if (isObj(aBorder) && isObj(bBorder)) merged[BORDER] = {...aBorder, ...bBorder};
    return merged;
  }
  const out: Obj = {};
  for (const [key, value] of Object.entries(as)) {
    if (!(key in bs)) {
      out[key] = value;
    } else if (key === BORDER && isObj(value) && isObj(bs[BORDER])) {
      // Borders merge side by side too.
      const sides = bs[BORDER];
      const left = Object.fromEntries(Object.entries(value).filter(([side]) => !(side in sides)));
      if (Object.keys(left).length > 0) out[key] = left;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * `a`'s cell write minus what `b`'s write of the same cell, applied after it, sets anyway (so
 * applying `b` then this ends the same as `a` then `b`); undefined if nothing of it is left.
 */
function cellAfter(a: unknown, aOverrides: boolean, b: unknown, bOverrides: boolean): unknown {
  // `b` deletes the cell: whatever `a` wrote is gone.
  if (!isObj(b)) return undefined;
  // `a` deletes the cell, then `b` writes some of it: clear only what `b` doesn't write.
  const aCell: Obj = isObj(a) ? a : {...CLEARED_CONTENT, [CUSTOM]: null, [STYLE]: null};
  const out: Obj = {};
  const bContent = writesContent(b);
  for (const [key, value] of Object.entries(aCell)) {
    if (key === STYLE) {
      if (!(STYLE in b)) {
        out[key] = value;
      } else {
        const style = styleAfter(value, aOverrides, b[STYLE], bOverrides);
        if (style !== undefined) out[key] = style;
      }
    } else if (key === CUSTOM) {
      if (!(CUSTOM in b)) out[key] = value;
    } else if (!bContent) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Two cell writes (set-range-values) to the same sheet: the room's order decides what each cell
 * ends up as, cell by cell and part by part. The later write (`b` unless `aFirst`) keeps
 * everything; the earlier one (`a` if `aFirst`) loses what the later one also writes, since the
 * later one would have overwritten it. So someone whose own write is still unconfirmed keeps
 * seeing it when a teammate's earlier write of the same cell arrives, as everyone else will.
 */
function transformCells(a: SheetMutation, b: SheetMutation, aFirst: boolean): SheetMutation[] {
  if (!aFirst) return [a];
  const aParams = paramsOf(a);
  const bParams = paramsOf(b);
  if (aParams.unitId !== bParams.unitId || subUnitOf(a) !== subUnitOf(b)) return [a];
  const aCells = aParams.cellValue;
  const bCells = bParams.cellValue;
  if (!isObj(aCells) || !isObj(bCells)) return [a];
  const aOverrides = aParams.isOverrideStyle === true;
  const bOverrides = bParams.isOverrideStyle === true;
  let changed = false;
  const cells: Obj = {};
  for (const [rowKey, row] of Object.entries(aCells)) {
    const bRow = bCells[rowKey];
    if (!isObj(row) || !isObj(bRow)) {
      cells[rowKey] = row;
      continue;
    }
    const out: Obj = {};
    for (const [colKey, cell] of Object.entries(row)) {
      if (!(colKey in bRow)) {
        out[colKey] = cell;
        continue;
      }
      changed = true;
      const left = cellAfter(cell, aOverrides, bRow[colKey], bOverrides);
      if (left !== undefined) out[colKey] = left;
    }
    if (Object.keys(out).length > 0) cells[rowKey] = out;
  }
  if (!changed) return [a];
  if (Object.keys(cells).length === 0) return [];
  return [{id: a.id, params: {...aParams, cellValue: cells}}];
}

/**
 * A move of whole rows (`a`, moving `move`) rewritten to apply after a teammate inserted or removed
 * rows `b`. The moved rows are the same rows (new ones inserted among them go along), and they
 * still go right before the row they were moving to; if that row was removed, before the first
 * row after it that's left, which is where it was.
 */
function transformMove(
  a: SheetMutation,
  move: RowMove,
  b: Structural & {kind: "insert" | "remove"}
): SheetMutation[] {
  const from = mapSpan(move.from, b);
  const to =
    b.kind === "insert"
      ? // Rows inserted right where the moved rows go stay below them: after the move, they're
        // still right above the row they were inserted above (see insertedAt).
        move.to + (b.at < move.to ? b.count : 0)
      : move.to - Math.max(0, Math.min(b.end, move.to - 1) - b.start + 1);
  // Every moved row was removed, or what's left is already where it was going (moving it "into
  // itself" would throw).
  if (!from || movesNothing({axis: move.axis, from, to})) return [];
  const params = paramsOf(a);
  const count = from.end - from.start + 1;
  const set = (range: unknown, start: number, end: number) =>
    move.axis === "row"
      ? {...(isObj(range) ? range : {}), startRow: start, endRow: end}
      : {...(isObj(range) ? range : {}), startColumn: start, endColumn: end};
  return [
    {
      id: a.id,
      params: {
        ...params,
        sourceRange: set(params.sourceRange, from.start, from.end),
        targetRange: set(params.targetRange, to, to + count - 1),
      },
    },
  ];
}

/** `a` (a single mutation) rewritten to apply after `b`. May become zero or two mutations. */
function transformOne(a: SheetMutation, b: SheetMutation, aFirst: boolean): SheetMutation[] {
  if (a.id === SET_RANGE_VALUES && b.id === SET_RANGE_VALUES) return transformCells(a, b, aFirst);
  const bs = structural(b);
  if (!bs) return [a];
  const sheet = subUnitOf(a);
  const movedSheet = subUnitOf(b);
  if (sheet !== undefined && movedSheet !== undefined && sheet !== movedSheet) {
    // Another sheet: only references in its formulas to the changed sheet move.
    return [shiftFormulas(a, sheet, movedSheet, bs)];
  }
  if (bs.kind === "removeSheet") return sheet === undefined ? [a] : [];

  const as = structural(a);
  const range = rangeParam(a);
  if (as?.kind === "move" && as.rows && (bs.kind === "insert" || bs.kind === "remove")) {
    if (as.rows.axis === bs.axis) return transformMove(a, as.rows, bs);
  }
  if (as && range && bs.kind === "move" && (as.kind === "insert" || as.kind === "remove")) {
    // Inserting or removing whole rows isn't changed by moving columns (or cells).
    if (!bs.rows || bs.rows.axis !== as.axis || movesNothing(bs.rows)) return [a];
    const move = bs.rows;
    const set = (start: number, end: number): IRange =>
      move.axis === "row"
        ? {...range, startRow: start, endRow: end}
        : {...range, startColumn: start, endColumn: end};
    if (as.kind === "insert") {
      const at = insertedAt(as.at, move);
      return [withRange(a, set(at, at + as.count - 1))];
    }
    // The rows being removed may no longer be next to each other.
    return movedRuns(as.start, as.end, move).map(run => withRange(a, set(run.start, run.end)));
  }
  if (as && range && bs.kind !== "move" && (as.kind === "insert" || as.kind === "remove")) {
    if (as.axis !== bs.axis) {
      // Inserting rows doesn't move columns, but a column insert's range spans rows, so map it.
      const mapped = mapRange(range, bs);
      return mapped ? [withRange(a, mapped)] : [];
    }
    const axis = as.axis;
    const set = (start: number, end: number): IRange =>
      axis === "row"
        ? {...range, startRow: start, endRow: end}
        : {...range, startColumn: start, endColumn: end};
    if (as.kind === "insert") {
      let at = as.at;
      if (bs.kind === "insert") {
        // Same spot: whichever the room ordered first ends up on top.
        if (bs.at < at || (bs.at === at && !aFirst)) at += bs.count;
      } else if (at > bs.end) {
        at -= bs.end - bs.start + 1;
      } else if (at > bs.start) {
        // Inserting inside rows a teammate deleted: insert where they were.
        at = bs.start;
      }
      return [withRange(a, set(at, at + as.count - 1))];
    }
    // `a` removes [start, end].
    if (bs.kind === "insert") {
      if (bs.at <= as.start) {
        return [withRange(a, set(as.start + bs.count, as.end + bs.count))];
      }
      if (bs.at > as.end) return [a];
      // A teammate inserted inside the block being removed: keep their new rows, removing the
      // part after them first so the part before keeps its position.
      return [
        withRange(a, set(bs.at + bs.count, as.end + bs.count)),
        withRange(a, set(as.start, bs.at - 1)),
      ];
    }
    const mapped = mapSpan({start: as.start, end: as.end}, bs);
    return mapped ? [withRange(a, set(mapped.start, mapped.end))] : [];
  }

  const mapped = mapParams(a.params, bs);
  const params = isObj(mapped) ? mapCellPositions(a.id, mapped, bs) : mapped;
  if (params === null) return [];
  // A row move that lost its rows or its target (to a teammate's move) has nothing left to do;
  // sent without them, it would throw.
  if (as?.kind === "move" && as.rows) {
    if (!isObj(params) || !isRange(params.sourceRange) || !isRange(params.targetRange)) return [];
  }
  const result = {id: a.id, params};
  return [
    sheet !== undefined && movedSheet !== undefined
      ? shiftFormulas(result, sheet, movedSheet, bs)
      : result,
  ];
}

/**
 * Transforms two concurrent lists of mutations against each other: returns `[a', b']` such that
 * applying `b` then `a'` gives the same sheet as applying `a` then `b'`.
 */
export function transform(
  a: SheetMutation[],
  b: SheetMutation[],
  aFirst: boolean
): [SheetMutation[], SheetMutation[]] {
  if (a.length === 0 || b.length === 0) return [a, b];
  if (a.length > 1) {
    const [head, b1] = transform([a[0]!], b, aFirst);
    const [rest, b2] = transform(a.slice(1), b1, aFirst);
    return [[...head, ...rest], b2];
  }
  if (b.length > 1) {
    const [a1, head] = transform(a, [b[0]!], aFirst);
    const [a2, rest] = transform(a1, b.slice(1), aFirst);
    return [a2, [...head, ...rest]];
  }
  return [transformOne(a[0]!, b[0]!, aFirst), transformOne(b[0]!, a[0]!, !aFirst)];
}

/** Whether a mutation moves rows, columns or ranges (and so can shift other things). */
export const isStructural = (m: SheetMutation) => structural(m) !== undefined;

/** Ranges on sheet `sheetId` (e.g. a teammate's selection) moved through mutations just applied. */
export function mapRanges(
  ranges: SheetRange[],
  sheetId: string,
  applied: SheetMutation[]
): SheetRange[] {
  let current = ranges.map(toIRange);
  for (const m of applied) {
    const s = structural(m);
    if (!s || subUnitOf(m) !== sheetId) continue;
    current = current.flatMap(range => mapRange(range, s) ?? []);
  }
  return current;
}

/** A range as sent over the wire (rangeType as a plain number). */
function toIRange(range: SheetRange): IRange {
  const {rangeType, ...rest} = range;
  if (rangeType === undefined) return rest;
  const type = [RANGE_TYPE.NORMAL, RANGE_TYPE.ROW, RANGE_TYPE.COLUMN, RANGE_TYPE.ALL].find(
    t => t.valueOf() === rangeType
  );
  return type === undefined ? rest : {...rest, rangeType: type};
}
