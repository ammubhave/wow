import {expect, test} from "vite-plus/test";

import {gunzipText, gzipText} from "./sheet-compress";

test("gzip round-trips text, including non-ASCII", async () => {
  const text = JSON.stringify({cells: Array.from({length: 2000}, (_, i) => ({v: `café ${i} ✓`}))});
  const packed = await gzipText(text);
  expect(packed.length).toBeLessThan(text.length / 4);
  expect(await gunzipText(packed)).toBe(text);
});
