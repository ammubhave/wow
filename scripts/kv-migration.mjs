// Moves every known Durable Object from the old key-value storage to its SQLite successor (see
// src/server/do/kv-migration.ts): backs each old room up to a local file, copies it, then checks
// that the copy read every entry. Rooms copy themselves when first opened, so this only catches the
// rest and proves it; safe to run again (a room is only ever copied once).
//
// Rooms are found by name in D1: puzzle chats by puzzle id, team chats by `team:<workspace id>`,
// notifications and workspace rooms by workspace id, Discord clients by server id.
//
// Usage: KV_MIGRATION_TOKEN=… node scripts/kv-migration.mjs --env local|production --base <url>
//          --out <backup dir> [--backup-only]
import {execFileSync} from "node:child_process";
import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {parseArgs} from "node:util";

const {values: args} = parseArgs({
  options: {
    env: {type: "string", default: "local"},
    base: {type: "string", default: "http://localhost:3000"},
    out: {type: "string"},
    "backup-only": {type: "boolean", default: false},
  },
});
const token = process.env.KV_MIGRATION_TOKEN;
if (!token || !args.out) {
  console.error("Needs KV_MIGRATION_TOKEN and --out <backup dir>");
  process.exit(1);
}

const d1 = sql => {
  const target =
    args.env === "production"
      ? ["wow-production", "--env", "production", "--remote"]
      : ["wow", "--local"];
  const output = execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", ...target, "--json", "--command", sql],
    {encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1 << 28}
  );
  return JSON.parse(output)[0].results;
};

const workspaceIds = d1("SELECT id FROM organization").map(row => row.id);
const names = {
  chat: [
    ...d1("SELECT id FROM puzzle").map(row => row.id),
    ...workspaceIds.map(id => `team:${id}`),
  ],
  notification: workspaceIds,
  workspace: workspaceIds,
  discord: d1(
    "SELECT DISTINCT discord_guild_id AS id FROM organization WHERE discord_guild_id IS NOT NULL"
  ).map(row => row.id),
};

/** A batch, tried a few times (the Worker can fail briefly, as it did right after a deploy). */
async function call(kind, action, batch) {
  for (let attempt = 1; ; attempt++) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      return await post(kind, action, batch);
    } catch (error) {
      if (attempt === 3) throw error;
      console.error(`\n${error.message}; trying again`);
      // oxlint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function post(kind, action, batch) {
  const response = await fetch(`${args.base}/api/admin/kv-migration`, {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({kind, action, names: batch}),
  });
  if (!response.ok)
    throw new Error(`${kind} ${action}: ${response.status} ${await response.text()}`);
  return await response.json();
}

/** Every name, in batches (a few at once, so a big run doesn't hammer the Worker). */
async function each(kind, action, size = 20) {
  const list = names[kind];
  const results = [];
  for (let i = 0; i < list.length; i += size) {
    // Sequential on purpose: one batch at a time.
    // oxlint-disable-next-line no-await-in-loop
    results.push(...(await call(kind, action, list.slice(i, i + size))));
    process.stdout.write(`\r${kind} ${action}: ${Math.min(i + size, list.length)}/${list.length}`);
  }
  process.stdout.write("\n");
  return results;
}

mkdirSync(args.out, {recursive: true});
let problems = 0;
for (const kind of ["chat", "notification", "discord", "workspace"]) {
  // The backup first: everything the old rooms hold, before anything else touches them.
  // oxlint-disable-next-line no-await-in-loop
  const exported = await each(kind, "export");
  const kept = exported.filter(room => room.entries.length > 0);
  writeFileSync(
    join(args.out, `${kind}.ndjson`),
    kept.map(room => JSON.stringify(room)).join("\n") + (kept.length ? "\n" : "")
  );
  const entries = kept.reduce((sum, room) => sum + room.entries.length, 0);
  console.log(`${kind}: backed up ${kept.length} rooms with data, ${entries} entries`);
  if (args["backup-only"]) continue;

  // oxlint-disable-next-line no-await-in-loop
  const copies = await each(kind, "copy");
  const fresh = copies.filter(copy => !copy.alreadyDone);
  console.log(`${kind}: copied ${fresh.length} rooms now (the rest had copied themselves)`);

  // oxlint-disable-next-line no-await-in-loop
  const statuses = await each(kind, "status");
  for (const status of statuses) {
    if (status.copied === undefined || status.copied !== status.legacy) {
      problems++;
      console.error(`  ${kind} ${status.name}: old ${status.legacy}, copied ${status.copied}`);
    }
  }
  if (kind === "chat") {
    const messages = statuses.reduce((sum, status) => sum + (status.messages ?? 0), 0);
    console.log(`chat: ${messages} messages in the new rooms`);
  }
}
console.log(problems === 0 ? "All rooms copied completely." : `${problems} rooms need a look.`);
process.exit(problems === 0 ? 0 : 1);
