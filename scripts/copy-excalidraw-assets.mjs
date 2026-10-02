// Copies Excalidraw's fonts into public/ so the whiteboard serves them from our own domain
// (Excalidraw otherwise fetches them from a public CDN). Runs on install; the copy is gitignored.
import {cpSync, existsSync, rmSync} from "node:fs";

const from = "node_modules/@excalidraw/excalidraw/dist/prod/fonts";
const to = "public/excalidraw-assets/fonts";

if (existsSync(from)) {
  rmSync(to, {recursive: true, force: true});
  cpSync(from, to, {recursive: true});
}
