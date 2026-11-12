import {defineConfig} from "vite-plus";

// Unit tests for pure modules (no Cloudflare runtime): the app's vite.config.ts loads the
// Cloudflare plugin, which `pnpm test` can't run, so these use a plain config.
export default defineConfig({
  resolve: {tsconfigPaths: true},
  test: {include: ["src/**/*.test.ts"], environment: "node"},
});
