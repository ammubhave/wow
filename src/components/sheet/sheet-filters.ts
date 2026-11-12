import type {FWorksheet} from "@univerjs/preset-sheets-core";
import type {FUniver, IWorkbookData} from "@univerjs/presets";

import type {SheetEntry, SheetMutation, SheetRange} from "@/server/do/sheet";

import {isStructural, mapRanges} from "./sheet-ot";

/**
 * Filters are personal, like Google Sheets' filter views: filtering hides rows only for the person
 * who set it, never for the team. Univer's filter is shared by default (its edits are mutations
 * like any other), so its mutations are kept out of sync and out of snapshots, and each person's
 * filters are remembered in their own browser (per puzzle) instead.
 */

const FILTER_MUTATIONS = new Set([
  "sheet.mutation.set-filter-range",
  "sheet.mutation.set-filter-criteria",
  "sheet.mutation.remove-filter",
  "sheet.mutation.re-calc-filter",
  // Univer's core marks filtered rows changed (for SUBTOTAL and the like): also personal.
  "sheet.mutation.mark-dirty-filter-change",
]);
/** Where Univer stores filters in a workbook's snapshot. */
const FILTER_RESOURCE = "SHEET_FILTER_PLUGIN";

/** Whether a mutation only affects the person who made it (and so isn't shared). */
export const isPersonalMutation = (id: string) => FILTER_MUTATIONS.has(id);

/** A workbook snapshot without anyone's filters. */
export function withoutPersonalState(data: Partial<IWorkbookData>): Partial<IWorkbookData> {
  return data.resources
    ? {...data, resources: data.resources.filter(resource => resource.name !== FILTER_RESOURCE)}
    : data;
}

/**
 * The filtered range and each filtered column's criteria (by absolute column index), as of the
 * room's entry `seq`: later row and column changes are applied to them when they're restored.
 */
type SavedFilter = {range: SheetRange; criteria: [number, unknown][]; seq: number};
type SavedFilters = Record<string, SavedFilter>;

const storageKey = (puzzleId: string) => `wow:sheet-filters:${puzzleId}`;

const isSaved = (value: unknown): value is SavedFilter =>
  typeof value === "object" &&
  value !== null &&
  "range" in value &&
  typeof value.range === "object" &&
  "criteria" in value &&
  Array.isArray(value.criteria);

function read(puzzleId: string): Record<string, SavedFilter> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(puzzleId)) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isSaved(value)));
  } catch {
    return {};
  }
}

type Criteria = Parameters<
  NonNullable<ReturnType<FWorksheet["getFilter"]>>["setColumnFilterCriteria"]
>[1];

/** The filters on a workbook's sheets, by sheet id. */
function currentFilters(api: FUniver, unitId: string, seq: number): SavedFilters {
  const workbook = api.getWorkbook(unitId);
  const saved: SavedFilters = {};
  for (const sheet of workbook?.getSheets() ?? []) {
    const filter = sheet.getFilter();
    if (!filter) continue;
    const range = filter.getRange();
    const criteria: [number, unknown][] = [];
    for (let col = range.getColumn(); col <= range.getLastColumn(); col++) {
      const column = filter.getColumnFilterCriteria(col);
      if (column) criteria.push([col, column]);
    }
    const {startRow, endRow, startColumn, endColumn} = range.getRange();
    saved[sheet.getSheetId()] = {range: {startRow, endRow, startColumn, endColumn}, criteria, seq};
  }
  return saved;
}

/** Remembers this person's filters (as of the room's entry `seq`). */
export function saveFilters(api: FUniver, unitId: string, puzzleId: string, seq: number) {
  const saved = currentFilters(api, unitId, seq);
  try {
    if (Object.keys(saved).length === 0) localStorage.removeItem(storageKey(puzzleId));
    else localStorage.setItem(storageKey(puzzleId), JSON.stringify(saved));
  } catch {
    // Storage full or blocked: the filter just won't survive a reload.
  }
}

/** A filter moved through row and column changes; null if its rows or columns are all gone. */
function moved(saved: SavedFilter, sheetId: string, mutations: SheetMutation[]) {
  const [range] = mapRanges([saved.range], sheetId, mutations);
  if (!range) return null;
  const criteria: [number, unknown][] = [];
  for (const [col, column] of saved.criteria) {
    const [where] = mapRanges(
      [{startRow: 0, endRow: 0, startColumn: col, endColumn: col}],
      sheetId,
      mutations
    );
    if (!where || typeof column !== "object" || column === null) continue;
    // A column's criteria name it by its place in the filtered range.
    criteria.push([where.startColumn, {...column, colId: where.startColumn - range.startColumn}]);
  }
  return {...saved, range, criteria};
}

/** Sets a sheet's filter (personal: nothing is sent). */
function apply(sheet: FWorksheet, saved: SavedFilter) {
  try {
    sheet.getFilter()?.remove();
    const filter = sheet
      .getRange(
        saved.range.startRow,
        saved.range.startColumn,
        saved.range.endRow - saved.range.startRow + 1,
        saved.range.endColumn - saved.range.startColumn + 1
      )
      .createFilter();
    for (const [col, column] of saved.criteria) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- saved from getColumnFilterCriteria.
      filter?.setColumnFilterCriteria(col, column as Criteria);
    }
  } catch {
    // The range no longer fits the sheet: drop it.
  }
}

/**
 * Puts back the filters this person had, moved through the entries the workbook was just built
 * with (`entries`: those after the snapshot), so they cover the same rows if teammates inserted
 * or deleted some meanwhile.
 */
export function restoreFilters(
  api: FUniver,
  unitId: string,
  puzzleId: string,
  entries: SheetEntry[]
) {
  const workbook = api.getWorkbook(unitId);
  if (!workbook) return;
  for (const [sheetId, saved] of Object.entries(read(puzzleId))) {
    const sheet = workbook.getSheetBySheetId(sheetId);
    if (!sheet || sheet.getFilter()) continue;
    const since = entries.filter(entry => entry.seq > saved.seq).flatMap(entry => entry.mutations);
    const filter = moved(saved, sheetId, since);
    if (filter) apply(sheet, filter);
  }
}

/**
 * Moves this person's live filters through a teammate's row and column changes (Univer moves
 * them for this person's own changes, not for ones applied from elsewhere).
 */
export function shiftFilters(api: FUniver, unitId: string, mutations: SheetMutation[]) {
  const workbook = api.getWorkbook(unitId);
  if (!workbook || !mutations.some(isStructural)) return false;
  let changed = false;
  for (const [sheetId, saved] of Object.entries(currentFilters(api, unitId, 0))) {
    const sheet = workbook.getSheetBySheetId(sheetId);
    const filter = sheet && moved(saved, sheetId, mutations);
    if (!sheet || !filter || JSON.stringify(filter.range) === JSON.stringify(saved.range)) continue;
    apply(sheet, filter);
    changed = true;
  }
  return changed;
}
