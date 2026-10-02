import {lazy, Suspense} from "react";

import type {GrainientProps} from "./grainient-canvas";

// WebGL (ogl) is only needed for this decorative background, so it loads in its own chunk. Until
// it arrives (or where WebGL isn't available) the month's deepest colour fills in, and the
// gradient fades in over it: a plain CSS gradient looked nothing like it, so it visibly snapped.
const GrainientCanvas = lazy(() => import("./grainient-canvas"));

export function Grainient({colors, className}: GrainientProps) {
  const deep = colors[2];
  return (
    <div aria-hidden="true" className={className} style={{backgroundColor: deep}}>
      <Suspense fallback={null}>
        <GrainientCanvas colors={colors} className="size-full" />
      </Suspense>
    </div>
  );
}
