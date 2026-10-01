// Fails if a migration drops a table without an explicit review marker.
//
// drizzle-kit rebuilds SQLite tables (create __new_x, copy, DROP TABLE x, rename) and relies on
// `PRAGMA foreign_keys=OFF` to keep the drop from cascading. D1 ignores that pragma, so on D1 the
// DROP TABLE deletes every row that references the table through ON DELETE CASCADE (this is how
// the January 2026 puzzles and activity details were lost). Before applying such a migration,
// snapshot and restore the dependent rows (see scripts/2026-10-01-d1-reconcile-schema.sql), then
// add the marker below to the migration to confirm it is safe.
import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

const MARKER = "-- d1-cascade-reviewed";
const dir = "migrations";
const unsafe = readdirSync(dir, {withFileTypes: true})
  .filter(entry => entry.isDirectory())
  .map(entry => join(dir, entry.name, "migration.sql"))
  .filter(file => {
    const sql = readFileSync(file, "utf8");
    return /\bDROP\s+TABLE\b/i.test(sql) && !sql.includes(MARKER);
  });

if (unsafe.length > 0) {
  console.error(
    `These migrations drop a table, which cascade-deletes dependent rows on D1:\n${unsafe
      .map(file => `  ${file}`)
      .join("\n")}\nPreserve the dependent rows, then add "${MARKER}" to the migration.`
  );
  process.exit(1);
}
