import type {FUniver} from "@univerjs/presets";
import {toast} from "sonner";

import {track} from "@/lib/analytics";

import {makeCrosswordGrid, removeCrosswordGrids} from "./sheet-crossword";
import {peerColor} from "./sheet-presence";

/** Biggest crossword grid, per side (big enough for any published crossword). */
const MAX_GRID_SIDE = 50;

/** The "others" group of the cells' right-click menu (a path: position, then group). */
const CELL_MENU = ["contextMenu.mainArea", "contextMenu.others"];

/** A person's highlight: a see-through tint of their colour, readable in light and dark sheets. */
export const highlightColor = (userId: string) => `${peerColor(userId)}4d`;

function selection(api: FUniver) {
  const sheet = api.getActiveWorkbook()?.getActiveSheet();
  const ranges = sheet?.getSelection()?.getActiveRangeList() ?? [];
  return sheet ? {sheet, ranges} : null;
}

/** Puts a formula in the selected cell (the top-left one of a range); false when none is. */
export function insertFormula(api: FUniver, formula: string) {
  const current = selection(api);
  const range = current?.ranges[0];
  if (!current || !range) return false;
  current.sheet.getRange(range.getRow(), range.getColumn()).setValue(formula);
  return true;
}

/**
 * WOW's own sheet actions: the puzzle tools (formulas, with examples; also in the bar above the
 * sheet) and crossword grids, in the right-click menu, and highlighting cells in your colour (the
 * one teammates see your cursor in), in the toolbar and the right-click menu.
 */
export function registerSheetMenus(
  api: FUniver,
  currentUserId: () => string | undefined,
  openTools: () => void
) {
  api
    .createMenu({
      id: "wow.puzzle-tools",
      title: "Puzzle tools…",
      icon: "FunctionIcon",
      action: () => {
        openTools();
        track("sheet_tools_opened");
      },
    })
    .appendTo(CELL_MENU);

  const highlight = (id: string) =>
    api.createMenu({
      id,
      title: "Highlight in my color",
      tooltip: "Highlight in my color: shows teammates which cells you're working on",
      icon: "PaintBucketDoubleIcon",
      action: () => {
        const userId = currentUserId();
        const current = selection(api);
        if (!userId || !current) return;
        for (const range of current.ranges) range.setBackgroundColor(highlightColor(userId));
        track("sheet_highlighted");
      },
    });
  highlight("wow.highlight-mine").appendTo("ribbon.start.others");
  highlight("wow.highlight-mine.context").appendTo(CELL_MENU);

  // In the right-click menu: select the grid's cells, then make it.
  api
    .createMenu({
      id: "wow.crossword.make",
      title: "Make crossword grid",
      icon: "GridIcon",
      action: () => {
        const current = selection(api);
        const range = current?.ranges[0]?.getRange();
        if (!current || !range) return;
        const rows = range.endRow - range.startRow + 1;
        const cols = range.endColumn - range.startColumn + 1;
        if (rows < 2 || cols < 2) {
          toast.info("Select the cells for the grid first (e.g. 15 × 15).", {id: "crossword"});
          return;
        }
        if (rows > MAX_GRID_SIDE || cols > MAX_GRID_SIDE) {
          toast.info(`A grid can be at most ${MAX_GRID_SIDE} × ${MAX_GRID_SIDE}.`, {
            id: "crossword",
          });
          return;
        }
        makeCrosswordGrid(api, current.sheet, range);
        track("sheet_crossword_created", {rows, cols});
        toast.success("Crossword grid ready. Type # or . for a black square.", {id: "crossword"});
      },
    })
    .appendTo(CELL_MENU);
  api
    .createMenu({
      id: "wow.crossword.remove",
      title: "Remove crossword numbering",
      action: () => {
        const current = selection(api);
        const range = current?.ranges[0]?.getRange();
        if (!current || !range) return;
        const removed = removeCrosswordGrids(api, current.sheet, range);
        toast.info(removed ? "Clue numbers removed." : "Select a cell in a crossword grid first.", {
          id: "crossword",
        });
      },
    })
    .appendTo(CELL_MENU);
}
