import {DurableObject} from "cloudflare:workers";

/**
 * Moving Durable Objects from the old key-value storage to SQLite.
 *
 * Cloudflare can't switch a deployed class's storage, so each KV-backed class (ChatRoom,
 * NotificationRoom, PresenceRoom, DiscordClient, WorkspaceRoom) got a SQLite-backed successor
 * (ChatRoomV2, …) under a new name. The old classes stay deployed only to hand their data over: a
 * new object copies its predecessor's entries the first time it starts (`copyFromKv`, before it
 * serves anything), and `scripts/kv-migration.mjs` walks every known room to copy the rest, keep a
 * backup, and check the counts. Once that's done, the old classes can be deleted (a
 * `deleted_classes` migration), and this file with them.
 */

/** Entries handed over per call (each is at most a few KB: well under RPC's limits). */
const PAGE_SIZE = 256;

/** A stored value (structured-clonable, as the key-value storage kept them). */
type KvValue = string | number | boolean | null | object;
export type KvEntry = {key: string; value: KvValue};

export type KvPage = {
  entries: KvEntry[];
  /** Where the next page starts (the last key of this one), or null after the last page. */
  next: string | null;
  /** The pending alarm (first page only), so a scheduled retry isn't lost in the move. */
  alarm: number | null;
};

/** An old KV-backed object, now only a source of its stored entries. */
export class LegacyKvRoom extends DurableObject<Env> {
  async exportPage(startAfter: string | null): Promise<KvPage> {
    const page = await this.ctx.storage.list<KvValue>({
      ...(startAfter === null ? {} : {startAfter}),
      limit: PAGE_SIZE,
    });
    const entries = [...page].map(([key, value]): KvEntry => ({key, value}));
    return {
      entries,
      next: entries.length === PAGE_SIZE ? entries.at(-1)!.key : null,
      alarm: startAfter === null ? await this.ctx.storage.getAlarm() : null,
    };
  }

  /** After its data was copied: nothing left scheduled (its successor took over any alarm). */
  async retire() {
    await this.ctx.storage.deleteAlarm();
  }

  /** Deletes what's left (the room itself was deleted: a puzzle's chat). */
  async clear() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  /** Old alarms (a Discord sync retry, a chat's long-gone expiry) belong to the successor now. */
  async alarm() {}

  async fetch() {
    return new Response("Moved to SQLite storage", {status: 410});
  }
}

// The old classes, by their deployed names (the worker must still export them).
export class ChatRoom extends LegacyKvRoom {}
export class NotificationRoom extends LegacyKvRoom {}
export class PresenceRoom extends LegacyKvRoom {}
export class DiscordClient extends LegacyKvRoom {}
export class WorkspaceRoom extends LegacyKvRoom {}

export type KvCopy = {copied: number; alreadyDone: boolean};

type CopyOptions = {
  legacy: DurableObjectNamespace<LegacyKvRoom>;
  /** The object's name (`ctx.id.name`, or given by the migration script). */
  name: string | undefined;
  /** Stores a page of entries, keeping anything already here (see below). */
  write: (entries: KvEntry[]) => void;
  /** After the last page, in the same kind of transaction. */
  finish?: () => void;
  /** Reschedules the predecessor's pending alarm, for classes that use one. */
  alarm?: (at: number) => Promise<void>;
};

/**
 * Copies this object's predecessor's entries, once. Runs before the object serves anything (from
 * `blockConcurrencyWhile`), or from the migration script with the name. Writes keep what's already
 * here, so it's a merge should the object have run before it knew its name.
 */
export async function copyFromKv(
  ctx: DurableObjectState,
  {legacy, name, write, finish, alarm}: CopyOptions
): Promise<KvCopy> {
  const sql = ctx.storage.sql;
  sql.exec("CREATE TABLE IF NOT EXISTS kv_migration (copied_at INTEGER NOT NULL, copied INTEGER)");
  if (sql.exec("SELECT 1 FROM kv_migration LIMIT 1").toArray().length > 0) {
    return {copied: 0, alreadyDone: true};
  }
  if (name === undefined) {
    // Can't tell which old object to read; the migration script copies it by name later.
    console.error(`KV migration: ${ctx.id.toString()} doesn't know its name`);
    return {copied: 0, alreadyDone: false};
  }
  const source = legacy.getByName(name);
  let copied = 0;
  let pendingAlarm: number | null = null;
  let startAfter: string | null = null;
  do {
    // One page at a time: each starts where the last one ended.
    // oxlint-disable-next-line no-await-in-loop
    const page: KvPage = await source.exportPage(startAfter);
    if (startAfter === null) pendingAlarm = page.alarm;
    ctx.storage.transactionSync(() => write(page.entries));
    copied += page.entries.length;
    startAfter = page.next;
  } while (startAfter !== null);
  ctx.storage.transactionSync(() => {
    finish?.();
    sql.exec("INSERT INTO kv_migration (copied_at, copied) VALUES (?, ?)", Date.now(), copied);
  });
  if (pendingAlarm !== null && alarm) await alarm(pendingAlarm);
  await source.retire();
  return {copied, alreadyDone: false};
}

/** Whether (and when) the copy ran, and how many entries it read. */
export function kvMigrationStatus(ctx: DurableObjectState) {
  ctx.storage.sql.exec(
    "CREATE TABLE IF NOT EXISTS kv_migration (copied_at INTEGER NOT NULL, copied INTEGER)"
  );
  const row = ctx.storage.sql
    .exec<{copied_at: number; copied: number}>("SELECT copied_at, copied FROM kv_migration")
    .toArray()[0];
  return row ? {copiedAt: row.copied_at, copied: row.copied} : null;
}

/** `write` for classes that keep using the key-value calls (on SQLite now): entries as they were. */
export const putMissing = (ctx: DurableObjectState) => (entries: KvEntry[]) => {
  for (const {key, value} of entries) {
    if (ctx.storage.kv.get(key) === undefined) ctx.storage.kv.put(key, value);
  }
};
