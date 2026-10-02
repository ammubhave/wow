import {Spinner} from "@heroui/react";
import {lazy, Suspense} from "react";

// Excalidraw is large, so it loads (in its own chunk) only when someone opens a whiteboard.
const WhiteboardCanvas = lazy(() => import("./whiteboard-canvas"));

export function PuzzleWhiteboard({puzzleId}: {puzzleId: string}) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Spinner aria-label="Loading whiteboard" />
        </div>
      }>
      <WhiteboardCanvas puzzleId={puzzleId} />
    </Suspense>
  );
}
