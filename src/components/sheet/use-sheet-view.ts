import type {FUniver} from "@univerjs/presets";
import {useEffect, useLayoutEffect, useRef, useState} from "react";

import {type Box, findCanvas, viewportOf} from "./sheet-geometry";

/**
 * For drawing over Univer's canvas: where the canvas is inside the overlay's parent, and the
 * active sheet's viewport. `layout` changes whenever cells may have moved; while `active`, the
 * viewport is also followed every frame (Univer's scroll event fires as scrolling starts, before
 * the position settles), re-rendering only when it actually moved.
 */
export function useSheetView(api: FUniver, layout: number, active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<Box>();
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const next = findCanvas(host);
    setCanvas(current =>
      current &&
      next &&
      current.left === next.left &&
      current.top === next.top &&
      current.width === next.width &&
      current.height === next.height
        ? current
        : next
    );
    // `layout` is the trigger: the canvas moves when Univer's toolbar or our pane resizes.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [layout]);

  const [viewKey, setViewKey] = useState("");
  useEffect(() => {
    if (!active) return undefined;
    let frame = requestAnimationFrame(function tick() {
      try {
        const workbook = api.getActiveWorkbook();
        const sheet = workbook?.getActiveSheet();
        if (sheet) {
          const scroll = workbook?.getScrollStateBySheetId(sheet.getSheetId());
          setViewKey(
            [
              sheet.getSheetId(),
              scroll?.sheetViewStartRow,
              scroll?.sheetViewStartColumn,
              scroll?.offsetX,
              scroll?.offsetY,
              sheet.getZoom(),
            ].join(":")
          );
        }
      } catch {
        // Univer's renderer isn't up (the sheet is hidden): check again next frame.
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [api, active]);

  const sheet = api.getActiveWorkbook()?.getActiveSheet();
  const view = sheet && canvas ? viewportOf(api, sheet) : undefined;
  return {ref, viewKey, sheet, view: view ?? undefined, canvas};
}
