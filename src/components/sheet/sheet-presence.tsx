import type {FUniver} from "@univerjs/presets";
import {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from "react";

import type {SheetPeer} from "@/server/do/sheet";

import {
  type Box,
  cellPieces,
  findCanvas,
  type Piece,
  rangePieces,
  viewportOf,
} from "./sheet-geometry";

// Distinct, readable on light and dark sheets (like Google Sheets' collaborator colours).
const COLORS = [
  "#e8710a",
  "#1a73e8",
  "#d01884",
  "#188038",
  "#9334e6",
  "#c5221f",
  "#12a4af",
  "#b06000",
];
// Height of a name tag; one at the very top of the cells goes inside the outline instead.
const TAG_HEIGHT = 16;

/** The same person gets the same colour everywhere (and in every tab). */
export function peerColor(userId: string) {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

function NameTag({name, color, inside}: {name: string; color: string; inside: boolean}) {
  return (
    <span
      className="absolute right-[-2px] rounded-sm px-1 text-[11px] whitespace-nowrap text-white"
      style={{background: color, lineHeight: `${TAG_HEIGHT}px`, top: inside ? 0 : -TAG_HEIGHT - 1}}>
      {name}
    </span>
  );
}

/**
 * A piece of an outline, clipped to its part of the sheet (frozen or scrolling); `children` gets
 * the piece's box relative to that part.
 */
function Clipped({piece, children}: {piece: Piece; children: (box: Box) => ReactNode}) {
  const {box, clip} = piece;
  return (
    <div className="absolute overflow-hidden" style={clip}>
      {children({...box, left: box.left - clip.left, top: box.top - clip.top})}
    </div>
  );
}

/**
 * Teammates on the sheet, drawn over Univer's canvas and clipped to the cells (not the headers):
 * their selections outlined in their colour with their name (like Google Sheets), and the cell
 * they're typing in. `layout` changes whenever cells may have moved.
 */
export function PresenceOverlay({
  api,
  peers,
  layout,
}: {
  api: FUniver;
  peers: ReadonlyMap<string, SheetPeer>;
  layout: number;
}) {
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

  // Univer's scroll event fires as scrolling starts, before the position settles (and smooth
  // scrolling keeps moving): while there's anything to draw, follow the viewport every frame,
  // redrawing only when it actually moved.
  const [viewKey, setViewKey] = useState("");
  const anything = [...peers.values()].some(peer => peer.presence);
  useEffect(() => {
    if (!anything) return undefined;
    let frame = requestAnimationFrame(function tick() {
      try {
        const workbook = api.getActiveWorkbook();
        const active = workbook?.getActiveSheet();
        if (active) {
          const scroll = workbook?.getScrollStateBySheetId(active.getSheetId());
          setViewKey(
            [
              active.getSheetId(),
              scroll?.sheetViewStartRow,
              scroll?.sheetViewStartColumn,
              scroll?.offsetX,
              scroll?.offsetY,
              active.getZoom(),
            ].join(":")
          );
        }
      } catch {
        // Univer's renderer isn't up (the sheet is hidden): check again next frame.
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [api, anything]);

  const sheet = api.getActiveWorkbook()?.getActiveSheet();
  const view = sheet && canvas ? viewportOf(api, sheet) : undefined;
  const sheetId = sheet?.getSheetId();
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-view={viewKey}
      className="pointer-events-none absolute inset-0 z-10">
      {sheet && view && canvas && (
        <div
          className="absolute overflow-hidden"
          style={{
            left: canvas.left + view.cells.left,
            top: canvas.top + view.cells.top,
            width: Math.max(0, canvas.width - view.cells.left),
            height: Math.max(0, canvas.height - view.cells.top),
          }}>
          {[...peers.values()].flatMap(peer => {
            const presence = peer.presence;
            if (!presence || presence.sheetId !== sheetId) return [];
            const color = peerColor(peer.userId);
            const editing = presence.editing;
            const marks: ReactNode[] = [];
            presence.ranges.forEach((range, i) => {
              const key = `${peer.id}:${range.startRow}:${range.startColumn}:${range.endRow}:${range.endColumn}`;
              for (const [j, piece] of rangePieces(sheet, view, range).entries()) {
                marks.push(
                  <Clipped key={`${key}:${j}`} piece={piece}>
                    {box => (
                      <div
                        className="absolute"
                        style={{
                          ...box,
                          border: `2px solid ${color}`,
                          background: `color-mix(in srgb, ${color} 10%, transparent)`,
                        }}>
                        {i === 0 && !editing && piece.topRight && (
                          <NameTag name={peer.name} color={color} inside={box.top < TAG_HEIGHT} />
                        )}
                      </div>
                    )}
                  </Clipped>
                );
              }
            });
            // The cell they're typing in, like Google Sheets' "is editing" state.
            if (editing) {
              for (const [j, piece] of cellPieces(
                sheet,
                view,
                editing.row,
                editing.col
              ).entries()) {
                marks.push(
                  <Clipped key={`${peer.id}:editing:${j}`} piece={piece}>
                    {box => (
                      <div className="absolute" style={{...box, border: `3px solid ${color}`}}>
                        <NameTag
                          name={`${peer.name} is typing…`}
                          color={color}
                          inside={box.top < TAG_HEIGHT}
                        />
                      </div>
                    )}
                  </Clipped>
                );
              }
            }
            return marks;
          })}
        </div>
      )}
    </div>
  );
}
