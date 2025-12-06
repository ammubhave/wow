import {defineConfig} from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/722596595d721d84ff41d8d4d2f284f98b54fb861431dc96221983537ebe2989.sqlite",
  },
});
