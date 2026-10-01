// Applies pending drizzle migrations to production D1 with wrangler.
//
// `drizzle-kit migrate` can't be used for production: its d1-http driver (drizzle-kit 1.0.0-rc.4)
// misreads the existing __drizzle_migrations table and refuses to run. This reads the migrations
// with drizzle's own reader (same names and hashes as `drizzle-kit migrate`, which is still used
// locally) and runs each pending one with `wrangler d1 execute --file`, which D1 applies atomically,
// together with its __drizzle_migrations row.
//
// Usage: node scripts/migrate-d1-prod.mjs [--dry-run]
import {execFileSync} from "node:child_process";
import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {readMigrationFiles} from "drizzle-orm/migrator";

const wrangler = args =>
  execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "wow-production",
      "--env",
      "production",
      "--remote",
      ...args,
    ],
    {encoding: "utf8", stdio: ["ignore", "pipe", "inherit"]}
  );
const quote = value => `'${String(value).replaceAll("'", "''")}'`;

const applied = new Set(
  JSON.parse(
    wrangler(["--json", "--command", 'SELECT name FROM "__drizzle_migrations"'])
  )[0].results.map(row => row.name)
);
const pending = readMigrationFiles({migrationsFolder: "migrations"}).filter(
  migration => !applied.has(migration.name)
);

if (pending.length === 0) {
  console.log("No pending migrations.");
  process.exit(0);
}
console.log(`Pending migrations:\n${pending.map(m => `  ${m.name}`).join("\n")}`);
if (process.argv.includes("--dry-run")) process.exit(0);

const dir = mkdtempSync(join(tmpdir(), "d1-migrate-"));
for (const migration of pending) {
  const file = join(dir, `${migration.name}.sql`);
  writeFileSync(
    file,
    [
      ...migration.sql.map(statement => statement.trim()).filter(Boolean),
      `INSERT INTO "__drizzle_migrations" ("hash", "created_at", "name", "applied_at") VALUES (${quote(migration.hash)}, ${migration.folderMillis}, ${quote(migration.name)}, ${quote(new Date().toISOString())});`,
    ].join("\n")
  );
  console.log(`Applying ${migration.name}...`);
  wrangler(["--file", file, "--yes"]);
}
console.log("Done.");
