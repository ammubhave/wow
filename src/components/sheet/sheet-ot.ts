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
 * them. `aFirst` breaks ties (two inserts at the same row): the room's order decides.
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
  | {kind: "move"; mutation: MoveMutation}
  | {kind: "removeSheet"};

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
    case MOVE_RANGE:
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Univer's own mutation JSON.
      return {kind: "move", mutation: m as MoveMutation};
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
  if (Array.isArray(value)) {
    return value.map(item => mapParams(item, b)).filter(item => item !== undefined);
  }
  if (isMatrix(value) && (key === "cellValue" || key === "value")) return mapMatrix(value, b);
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

/** `a` (a single mutation) rewritten to apply after `b`. May become zero or two mutations. */
function transformOne(a: SheetMutation, b: SheetMutation, aFirst: boolean): SheetMutation[] {
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

  const params = mapParams(a.params, bs);
  if (params === null) return [];
  const mapped = {id: a.id, params};
  return [
    sheet !== undefined && movedSheet !== undefined
      ? shiftFormulas(mapped, sheet, movedSheet, bs)
      : mapped,
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
