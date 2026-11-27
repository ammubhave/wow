import {lazy, Suspense} from "react";

import {WhiteboardSkeleton} from "@/components/page-skeletons";

// Excalidraw is large, so it loads (in its own chunk) only when someone opens a whiteboard.
const WhiteboardCanvas = lazy(() => import("./whiteboard-canvas"));

export function PuzzleWhiteboard({puzzleId}: {puzzleId: string}) {
  return (
    <Suspense fallback={<WhiteboardSkeleton />}>
      <WhiteboardCanvas puzzleId={puzzleId} />
    </Suspense>
  );
}
