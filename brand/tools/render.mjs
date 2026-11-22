// Renders the brand PNGs from their SVG sources. Needs `sharp` resolvable (it is in the repo's
// node_modules via pnpm; `NODE_PATH` may need to point at it).
// Usage (from the repo root): node brand/tools/render.mjs
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";

const sharp = createRequire(import.meta.url)("sharp"); // CommonJS lookup honours NODE_PATH
const B = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jobs = [
  ["logo/wafflehaus-mark.svg", "icons/favicon-16.png", 16],
  ["logo/wafflehaus-mark.svg", "icons/favicon-32.png", 32],
  ["logo/wafflehaus-mark.svg", "icons/favicon-48.png", 48],
  ["logo/wafflehaus-mark.svg", "icons/apple-touch-icon.png", 180],
  ["logo/wafflehaus-mark.svg", "icons/icon-192.png", 192],
  ["logo/wafflehaus-mark.svg", "icons/icon-512.png", 512],
  ["icons/src/maskable-512.svg", "icons/icon-maskable-512.png", 512],
  ["social/og-image.svg", "social/og-image.png", 1200],
];
await Promise.all(
  jobs.map(async ([src, out, width]) => {
    // Rasterise at about 1024 px, then downsample, so small sizes stay crisp.
    const meta = await sharp(`${B}/${src}`).metadata(); // the SVG's own size, at 72 dpi
    await sharp(`${B}/${src}`, {density: Math.max(72, (72 * 1024) / meta.width)})
      .resize({width})
      .png({compressionLevel: 9})
      .toFile(`${B}/${out}`);
  })
);
console.log(`rendered ${jobs.length} PNGs`);
