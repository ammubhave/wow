import {env} from "cloudflare:workers";
import {beforeAll, expect, it} from "vite-plus/test";

import {migrate} from "./db";

beforeAll(migrate);

it("runs in the Workers runtime with the app's D1 schema", async () => {
  const tables = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('organization', 'puzzle')"
  ).all<{name: string}>();
  expect(tables.results.map(t => t.name).toSorted()).toEqual(["organization", "puzzle"]);
});
