import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

import {cloudflareTest} from "@cloudflare/vitest-plugin";
import {defineConfig} from "vite-plus";

// Tests that run inside the Workers runtime (test/workers): Durable Objects with their real
// storage, alarms and WebSockets, and D1 with the app's migrations. The unit tests (pure modules,
// in Node) are vitest.unit.config.ts.

/** The D1 migrations, in order: drizzle keeps each in its own folder, statements split by a marker. */
const migrations = readdirSync("migrations", {withFileTypes: true})
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .toSorted()
  .map(name => ({
    name,
    queries: readFileSync(join("migrations", name, "migration.sql"), "utf8")
      .split("--> statement-breakpoint")
      .map(query => query.trim())
      .filter(Boolean),
  }));

export default defineConfig({
  resolve: {tsconfigPaths: true},
  plugins: [
    cloudflareTest({
      // Only the Durable Objects and Workflows: the app's own entry would start TanStack Start.
      main: "./test/workers/entry.ts",
      wrangler: {configPath: "./wrangler.jsonc"},
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
          DISCORD_BOT_TOKEN: "test-bot-token",
        },
      },
    }),
  ],
  test: {include: ["test/workers/**/*.test.ts"], provide: {migrations}},
});
