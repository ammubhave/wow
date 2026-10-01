import {lazy, Suspense} from "react";

import type {PixelBlastProps} from "./pixel-blast-canvas";

// three + postprocessing are ~0.5 MB of JS for a purely decorative background, so load them in their
// own chunk instead of blocking the page that renders it.
const PixelBlastCanvas = lazy(() => import("./pixel-blast-canvas"));

export default function PixelBlast(props: PixelBlastProps) {
  return (
    <Suspense fallback={null}>
      <PixelBlastCanvas {...props} />
    </Suspense>
  );
}
