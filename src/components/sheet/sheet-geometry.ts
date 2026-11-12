import type {FWorksheet} from "@univerjs/preset-sheets-core";
import type {FUniver} from "@univerjs/presets";

import type {SheetRange} from "@/server/do/sheet";

/**
 * Converting between cells and pixels on Univer's canvas. Univer's cell rects are in unscrolled,
 * unzoomed sheet coordinates, headers included (A1 starts after the row and column headers), so
 * everything here applies the scroll position, frozen panes and zoom itself.
 *
 * With frozen rows or columns, the cells area has up to four parts: the frozen corner, the frozen
 * rows (which only scroll sideways), the frozen columns (which only scroll up and down), and the
 * rest. A range crossing a frozen edge is drawn as one piece per part, each clipped to its part.
 */

/** One direction (rows or columns): its frozen block and where scrolling has got to. */
type Axis = {
  /** The frozen block: indexes [frozenFirst, frozenEnd), empty when nothing is frozen. */
  frozenFirst: number;
  frozenEnd: number;
  /** The frozen block's size on screen, in pixels. */
  frozenSize: number;
  /** The first row (or column) shown in the scrolling part. */
  first: number;
  /** The sheet coordinate at the scrolling part's start. */
  origin: number;
  /** Sheet coordinate of the start of the frozen block. */
  frozenOrigin: number;
};

export type Viewport = {
  zoom: number;
  /** Where the cells start (after the headers), in canvas pixels. */
  cells: {left: number; top: number};
  rows: Axis;
  cols: Axis;
};

export type Box = {left: number; top: number; width: number; height: number};

/** A drawn part of a range: its box and the part of the sheet it's clipped to (cells area px). */
export type Piece = {box: Box; clip: Box; topRight: boolean};

const rowStart = (sheet: FWorksheet, row: number) => sheet.getRange(row, 0).getCellRect().top;
const colStart = (sheet: FWorksheet, col: number) => sheet.getRange(0, col).getCellRect().left;

/**
 * The sheet's current viewport, or null while Univer can't say (its renderer isn't up yet, or
 * the sheet is hidden): callers draw nothing rather than fail.
 */
export function viewportOf(api: FUniver, sheet: FWorksheet): Viewport | null {
  try {
    return measureViewport(api, sheet);
  } catch {
    return null;
  }
}

function measureViewport(api: FUniver, sheet: FWorksheet): Viewport {
  const scroll = api.getActiveWorkbook()?.getScrollStateBySheetId(sheet.getSheetId());
  const freeze = sheet.getFreeze();
  const zoom = sheet.getZoom() || 1;
  const a1 = sheet.getRange(0, 0).getCellRect();
  const axis = (
    split: number,
    startIndex: number,
    scrolled: number,
    offset: number,
    start: (i: number) => number
  ): Axis => {
    const frozen = split > 0;
    const frozenEnd = frozen ? startIndex : 0;
    const frozenFirst = frozen ? startIndex - split : 0;
    const frozenOrigin = start(frozenFirst);
    // Univer counts the scroll from the end of the frozen block.
    const first = frozenEnd + scrolled;
    return {
      frozenFirst,
      frozenEnd,
      frozenSize: frozen ? (start(frozenEnd) - frozenOrigin) * zoom : 0,
      first,
      origin: start(first) + offset,
      frozenOrigin,
    };
  };
  return {
    zoom,
    cells: {left: a1.left * zoom, top: a1.top * zoom},
    rows: axis(
      freeze.ySplit,
      freeze.startRow,
      scroll?.sheetViewStartRow ?? 0,
      scroll?.offsetY ?? 0,
      r => rowStart(sheet, r)
    ),
    cols: axis(
      freeze.xSplit,
      freeze.startColumn,
      scroll?.sheetViewStartColumn ?? 0,
      scroll?.offsetX ?? 0,
      c => colStart(sheet, c)
    ),
  };
}

/** The top-left cell of the scrolling part (where someone is looking, for followers). */
export const firstVisibleCell = (view: Viewport) => ({row: view.rows.first, col: view.cols.first});

// Big enough for "to the end of the cells area".
const FAR = 1e6;

/** A span of indexes split at an axis's frozen block, each part marked frozen or not. */
function spans(axis: Axis, start: number, end: number) {
  const out: {start: number; end: number; frozen: boolean}[] = [];
  if (axis.frozenEnd > axis.frozenFirst) {
    const s = Math.max(start, axis.frozenFirst);
    const e = Math.min(end, axis.frozenEnd - 1);
    if (s <= e) out.push({start: s, end: e, frozen: true});
  }
  const s = Math.max(start, axis.frozenEnd);
  if (s <= end) out.push({start: s, end, frozen: false});
  return out;
}

const position = (axis: Axis, zoom: number, coordinate: number, frozen: boolean) =>
  frozen
    ? (coordinate - axis.frozenOrigin) * zoom
    : axis.frozenSize + (coordinate - axis.origin) * zoom;

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), Math.max(0, max));

/** Where a range is drawn: one piece per frozen/scrolling part it covers (none if Univer can't
 * say right now). */
export function rangePieces(sheet: FWorksheet, view: Viewport, range: SheetRange): Piece[] {
  try {
    return measurePieces(sheet, view, range);
  } catch {
    return [];
  }
}

function measurePieces(sheet: FWorksheet, view: Viewport, range: SheetRange): Piece[] {
  const maxRow = sheet.getMaxRows() - 1;
  const maxCol = sheet.getMaxColumns() - 1;
  const rows = spans(view.rows, clamp(range.startRow, maxRow), clamp(range.endRow, maxRow));
  const cols = spans(view.cols, clamp(range.startColumn, maxCol), clamp(range.endColumn, maxCol));
  const pieces: Piece[] = [];
  for (const r of rows) {
    for (const c of cols) {
      const topLeft = sheet.getRange(r.start, c.start).getCellRect();
      const bottomRight = sheet.getRange(r.end, c.end).getCellRect();
      const left = position(view.cols, view.zoom, topLeft.left, c.frozen);
      const top = position(view.rows, view.zoom, topLeft.top, r.frozen);
      pieces.push({
        box: {
          left,
          top,
          width: (bottomRight.right - topLeft.left) * view.zoom,
          height: (bottomRight.bottom - topLeft.top) * view.zoom,
        },
        clip: {
          left: c.frozen ? 0 : view.cols.frozenSize,
          top: r.frozen ? 0 : view.rows.frozenSize,
          width: c.frozen ? view.cols.frozenSize : FAR,
          height: r.frozen ? view.rows.frozenSize : FAR,
        },
        topRight:
          r.start === clamp(range.startRow, maxRow) && c.end === clamp(range.endColumn, maxCol),
      });
    }
  }
  return pieces;
}

/** Where a cell is drawn (see rangePieces). */
export const cellPieces = (sheet: FWorksheet, view: Viewport, row: number, col: number) =>
  rangePieces(sheet, view, {startRow: row, endRow: row, startColumn: col, endColumn: col});

/** Where Univer's main sheet canvas sits inside `host`: it's the largest canvas Univer draws. */
export function findCanvas(host: Element): Box | undefined {
  const hostBox = host.getBoundingClientRect();
  let best: DOMRect | undefined;
  for (const element of host.querySelectorAll("canvas")) {
    const box = element.getBoundingClientRect();
    if (!best || box.width * box.height > best.width * best.height) best = box;
  }
  return best
    ? {
        left: best.left - hostBox.left,
        top: best.top - hostBox.top,
        width: best.width,
        height: best.height,
      }
    : undefined;
}
