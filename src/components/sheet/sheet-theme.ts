import {defaultTheme, type Theme} from "@univerjs/presets";

/**
 * Univer's colours, with its primary palette (selection, buttons, highlights) taken from the
 * workspace's accent colour, so the sheet looks like the rest of WOW. Univer also draws with these
 * on its canvas, so every shade is plain rgb().
 */

type Rgb = [number, number, number];

/** Any CSS colour (oklch, hex...) as RGB, via a 1-pixel canvas; null if it isn't one. */
function toRgb(color: string): Rgb | null {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", {willReadFrequently: true});
  if (!context) return null;
  context.fillStyle = "#010203";
  context.fillStyle = color;
  // Invalid colours leave fillStyle unchanged.
  if (context.fillStyle === "#010203") return null;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

const mix = ([r, g, b]: Rgb, [r2, g2, b2]: Rgb, amount: number) =>
  `rgb(${[r + (r2 - r) * amount, g + (g2 - g) * amount, b + (b2 - b) * amount]
    .map(Math.round)
    .join(", ")})`;

/** `accent`: a CSS colour, or null for the app's default accent (from the page's --accent). */
export function sheetTheme(accent: string | null): Theme {
  const color =
    accent ?? getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const base = color ? toRgb(color) : null;
  if (!base) return defaultTheme;
  const white: Rgb = [255, 255, 255];
  const black: Rgb = [0, 0, 0];
  return {
    ...defaultTheme,
    primary: {
      50: mix(base, white, 0.92),
      100: mix(base, white, 0.84),
      200: mix(base, white, 0.68),
      300: mix(base, white, 0.5),
      400: mix(base, white, 0.25),
      500: mix(base, white, 0),
      600: mix(base, black, 0.12),
      700: mix(base, black, 0.28),
      800: mix(base, black, 0.44),
      900: mix(base, black, 0.6),
    },
  };
}
