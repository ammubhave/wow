import {applyD1Migrations} from "cloudflare:test";
import {env} from "cloudflare:workers";
import {inject} from "vite-plus/test";

/** The app's schema in this test file's D1 (each test file has its own storage). */
export async function migrate() {
  await applyD1Migrations(env.DB, inject("migrations"));
}

declare module "vite-plus/test" {
  interface ProvidedContext {
    migrations: {name: string; queries: string[]}[];
  }
}
