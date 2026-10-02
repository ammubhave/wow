import {useEffect, useRef} from "react";

// Adapted from React Bits' Letter Glitch (https://reactbits.dev/backgrounds/letter-glitch): a field
// of cipher-like letters that shimmer. Changed to take its colours from the theme (and follow
// theme switches), keep the page background, fade into it at the edges, and hold still for
// reduced motion.

const CHARACTERS = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?!#&*+=<>/");
const FONT_SIZE = 16;
const CHAR_WIDTH = 10;
const CHAR_HEIGHT = 20;
// Share of letters re-rolled per tick, ticks per second, and colour fade per frame.
const UPDATE_SHARE = 0.05;
const TICK_MS = 60;
const FADE_STEP = 0.05;
// Theme tokens the letters are drawn in, and how strongly.
const COLOR_TOKENS = ["--accent", "--muted", "--separator"];
const OPACITY = 0.35;

type Rgb = [number, number, number];
type Letter = {char: string; rgb: Rgb; from: Rgb; to: Rgb; progress: number};

const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]!;

/** Resolves any CSS colour (including oklch tokens) to RGB by painting it. */
function toRgb(color: string, probe: CanvasRenderingContext2D): Rgb {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function themeColors(element: Element): Rgb[] {
  const probe = document.createElement("canvas").getContext("2d", {willReadFrequently: true});
  if (!probe) return [[128, 128, 128]];
  const style = getComputedStyle(element);
  return COLOR_TOKENS.map(token => style.getPropertyValue(token).trim())
    .filter(Boolean)
    .map(color => toRgb(color, probe));
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** A decorative full-bleed background; place it in a `relative` container. */
export function LetterGlitch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const parent = canvas?.parentElement;
    if (!canvas || !ctx || !parent) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let colors = themeColors(canvas);
    let letters: Letter[] = [];
    let columns = 0;
    let width = 0;
    let height = 0;

    const newLetter = (): Letter => {
      const rgb = pick(colors);
      return {char: pick(CHARACTERS), rgb, from: rgb, to: pick(colors), progress: 1};
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${FONT_SIZE}px ui-monospace, monospace`;
      ctx.textBaseline = "top";
      letters.forEach((letter, i) => {
        ctx.fillStyle = `rgb(${letter.rgb.join(" ")})`;
        ctx.fillText(
          letter.char,
          (i % columns) * CHAR_WIDTH,
          Math.floor(i / columns) * CHAR_HEIGHT
        );
      });
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Opening a menu or dialog locks scrolling, which can fire this without a real size change.
      if (rect.width === width && rect.height === height && canvas.width === width * dpr) return;
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rows = Math.ceil(height / CHAR_HEIGHT);
      const nextColumns = Math.ceil(width / CHAR_WIDTH);
      // Rebuild the grid only when its shape changes, so letters don't all re-roll at once.
      if (nextColumns !== columns || letters.length !== nextColumns * rows) {
        columns = nextColumns;
        letters = Array.from({length: columns * rows}, newLetter);
      }
      draw();
    };

    let frame = 0;
    let lastTick = 0;
    const animate = (now: number) => {
      if (now - lastTick >= TICK_MS) {
        lastTick = now;
        const count = Math.max(1, Math.floor(letters.length * UPDATE_SHARE));
        for (let n = 0; n < count; n++) {
          const letter = letters[Math.floor(Math.random() * letters.length)];
          if (!letter) continue;
          letter.char = pick(CHARACTERS);
          // Continue from the colour on screen, so a letter picked mid-fade doesn't jump.
          letter.from = letter.rgb;
          letter.to = pick(colors);
          letter.progress = 0;
        }
      }
      for (const letter of letters) {
        if (letter.progress < 1) {
          letter.progress = Math.min(1, letter.progress + FADE_STEP);
          letter.rgb = mix(letter.from, letter.to, letter.progress);
        }
      }
      draw();
      frame = requestAnimationFrame(animate);
    };

    resize();
    if (!reduceMotion) frame = requestAnimationFrame(animate);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(parent);
    // Re-read the palette when the theme changes (a class or data attribute on <html>; not
    // `style`, which scroll locking rewrites whenever a menu opens). Letters keep their characters
    // and fade into the new colours.
    const themeObserver = new MutationObserver(() => {
      colors = themeColors(canvas);
      for (const letter of letters) {
        letter.from = letter.rgb;
        letter.to = pick(colors);
        letter.progress = reduceMotion ? 1 : 0;
        if (reduceMotion) letter.rgb = letter.to;
      }
      draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block size-full" style={{opacity: OPACITY}} />
      {/* Fade into the page towards the edges, so it frames whatever sits in the middle. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,var(--background)_80%)]" />
    </div>
  );
}
