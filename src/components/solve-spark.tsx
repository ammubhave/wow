import {useEffect, useRef} from "react";

// The spark drawing is adapted from React Bits' Click Spark (https://reactbits.dev/animations/click-spark),
// changed to burst from the element's centre when a puzzle becomes solved instead of on every
// click, and to animate only while sparks are live.

const SPARK_COUNT = 10;
const DURATION = 500;
const SPARK_SIZE = 10;
// How far past the element's edge the sparks fly.
const OVERFLOW = 20;

/** Bursts green sparks around its children whenever `isSolved` turns true. */
export function SolveSpark({isSolved, children}: {isSolved: boolean; children: React.ReactNode}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wasSolved = useRef(isSolved);

  useEffect(() => {
    const was = wasSolved.current;
    wasSolved.current = isSolved;
    const canvas = canvasRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return isSolved && !was && canvas && !reduceMotion ? burst(canvas) : undefined;
  }, [isSolved]);

  return (
    <div className="relative min-w-0">
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute z-10"
        style={{
          inset: -OVERFLOW,
          width: `calc(100% + ${OVERFLOW * 2}px)`,
          height: `calc(100% + ${OVERFLOW * 2}px)`,
        }}
      />
    </div>
  );
}

/** Draws one burst on `canvas`; returns a cleanup that stops it. */
function burst(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  const {width, height} = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  const color = getComputedStyle(canvas).getPropertyValue("--success").trim() || "#22c55e";
  const cx = width / 2;
  const cy = height / 2;

  let frame = 0;
  const start = performance.now();
  const draw = (now: number) => {
    const progress = Math.min((now - start) / DURATION, 1);
    const eased = progress * (2 - progress);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < SPARK_COUNT; i++) {
      const angle = (2 * Math.PI * i) / SPARK_COUNT;
      // Start on an ellipse fitted to the element, so a wide control bursts from its whole
      // outline rather than one point, and fly OVERFLOW px outward.
      const rx = width / 2 - OVERFLOW + eased * OVERFLOW;
      const ry = height / 2 - OVERFLOW + eased * OVERFLOW;
      const length = SPARK_SIZE * (1 - eased);
      const x1 = cx + rx * Math.cos(angle);
      const y1 = cy + ry * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + length * Math.cos(angle), y1 + length * Math.sin(angle));
      ctx.stroke();
    }
    if (progress < 1) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, width, height);
  };
  frame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frame);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
