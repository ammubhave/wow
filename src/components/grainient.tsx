import {lazy, Suspense} from "react";

import type {GrainientProps} from "./grainient-canvas";

// WebGL (ogl) is only needed for this decorative background, so it loads in its own chunk. Until
// it arrives (or where WebGL isn't available) the same colours show as a plain CSS gradient.
const GrainientCanvas = lazy(() => import("./grainient-canvas"));

export function Grainient({colors, className}: GrainientProps) {
  const [light, mid, deep] = colors;
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{background: `linear-gradient(135deg, ${light}, ${mid} 45%, ${deep})`}}>
      <Suspense fallback={null}>
        <GrainientCanvas colors={colors} className="size-full" />
      </Suspense>
    </div>
  );
}
