import type {FUniver} from "@univerjs/presets";
import {useMemo} from "react";

import {clueNumbers, crosswordGrids, isBlackSquare} from "./sheet-crossword";
import {cellPieces} from "./sheet-geometry";
import {Clipped} from "./sheet-presence";
import {useSheetView} from "./use-sheet-view";

type Numbered = {row: number; col: number; n: number};

/**
 * Clue numbers in the top-left corner of crossword grid cells on the active sheet, worked out
 * from the black squares as they're typed. `layout` changes whenever cells may have changed.
 */
export function CrosswordOverlay({api, layout}: {api: FUniver; layout: number}) {
  const activeSheetId = api.getActiveWorkbook()?.getActiveSheet().getSheetId();
  const numbered = useMemo(() => {
    const sheet = api.getActiveWorkbook()?.getActiveSheet();
    if (!sheet) return [];
    const out: Numbered[] = [];
    for (const grid of crosswordGrids(api)) {
      if (grid.sheetId !== sheet.getSheetId()) continue;
      const {startRow, endRow, startColumn, endColumn} = grid.range;
      const values = sheet
        .getRange(startRow, startColumn, endRow - startRow + 1, endColumn - startColumn + 1)
        .getValues();
      clueNumbers(values.map(row => row.map(value => !isBlackSquare(value)))).forEach((row, r) => {
        row.forEach((n, c) => {
          if (n !== null) out.push({row: startRow + r, col: startColumn + c, n});
        });
      });
    }
    return out;
    // `layout` and the active sheet are the triggers: cells, grids and sheets change through Univer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [api, layout, activeSheetId]);

  const {ref, viewKey, sheet, view, canvas} = useSheetView(api, layout, numbered.length > 0);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-view={viewKey}
      className="pointer-events-none absolute inset-0 z-[5]">
      {sheet && view && canvas && numbered.length > 0 && (
        <div
          className="absolute overflow-hidden"
          style={{
            left: canvas.left + view.cells.left,
            top: canvas.top + view.cells.top,
            width: Math.max(0, canvas.width - view.cells.left),
            height: Math.max(0, canvas.height - view.cells.top),
          }}>
          {numbered.flatMap(({row, col, n}) =>
            cellPieces(sheet, view, row, col).map(piece => (
              <Clipped key={`${row}:${col}:${piece.clip.left}:${piece.clip.top}`} piece={piece}>
                {box => (
                  <span
                    className="text-foreground/70 absolute font-sans leading-none tabular-nums"
                    style={{
                      left: box.left + 2 * view.zoom,
                      top: box.top + 2 * view.zoom,
                      fontSize: 9 * view.zoom,
                    }}>
                    {n}
                  </span>
                )}
              </Clipped>
            ))
          )}
        </div>
      )}
    </div>
  );
}
