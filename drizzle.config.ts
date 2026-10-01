import * as dotenv from "dotenv";
import {defineConfig} from "drizzle-kit";

dotenv.config({path: ".env.local"});

// Schema changes go through migrations (pnpm db:generate, then db:migrate / db:migrate:prod).
// `push` against production rebuilt tables on D1, where DROP TABLE cascade-deletes dependent rows.
if (process.env.CLOUDFLARE_ENV === "production" && process.argv.includes("push")) {
  throw new Error("drizzle-kit push is disabled for production: generate a migration instead.");
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: process.env.CLOUDFLARE_ENV === "production" ? "d1-http" : undefined,
  dbCredentials:
    process.env.CLOUDFLARE_ENV === "production"
      ? {
          accountId: "ff0f90cb5a46c881c601b8f3c650c60e",
          databaseId: "dbd210d9-5627-4157-aec9-7d6431e68833",
          token: process.env.CLOUDFLARE_D1_TOKEN,
        }
      : {
          url: "file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/722596595d721d84ff41d8d4d2f284f98b54fb861431dc96221983537ebe2989.sqlite",
        },
});
