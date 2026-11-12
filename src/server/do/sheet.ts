import {DurableObject} from "cloudflare:workers";
import {Hono} from "hono";
import {v7 as uuidv7} from "uuid";
import {z} from "zod";

import {authMiddleware} from "@/server/auth";
import {type HonoEnv} from "@/server/context";
import {deletePuzzleFiles, puzzleFilesPrefix} from "@/server/puzzle-files";

/**
 * A puzzle's built-in spreadsheet (a Univer workbook), used when the workspace has no Google
 * Drive, plus who has which cells selected.
 *
 * Univer edits are "mutations" that refer to rows and columns by position, so concurrent edits
 * are merged with operational transformation, the way Google Docs does it: this room is the
 * single source of order, and clients do the transforming (they have Univer; the room only knows
 * JSON). Every batch says which entry it was made on top of (`baseSeq`). The room only appends a
 * batch made on top of the latest entry; otherwise it rejects it, and the client, which by then
 * has received the entries it missed, transforms its batch over them and sends it again. Each
 * client has at most one batch waiting.
 *
 * The log is stored per entry. Clients upload a snapshot of the whole workbook every so often;
 * the room keeps recent entries before it too, so a client that reconnects can catch up with
 * just what it missed instead of reloading the sheet.
 */

/** A Univer mutation, relayed untouched: only its id is checked. */
const mutationSchema = z.object({id: z.string().min(1).max(200), params: z.unknown()});
export type SheetMutation = z.infer<typeof mutationSchema>;

const rangeSchema = z.object({
  startRow: z.number(),
  endRow: z.number(),
  startColumn: z.number(),
  endColumn: z.number(),
  rangeType: z.number().optional(),
});
export type SheetRange = z.infer<typeof rangeSchema>;

const cellSchema = z.object({
  row: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
});

const presenceSchema = z.object({
  sheetId: z.string().max(100),
  ranges: rangeSchema.array().max(20),
  /** The cell being typed into, if any. */
  editing: cellSchema.nullable().optional(),
  /** The top-left cell on screen, so teammates can follow along. */
  view: cellSchema.nullable().optional(),
});
export type SheetPresence = z.infer<typeof presenceSchema>;

const sentMessageSchema = z.union([
  z.object({
    type: z.literal("mutations"),
    batchId: z.string().min(1).max(64),
    /** The last entry this batch was made on top of. */
    baseSeq: z.number().int().nonnegative(),
    mutations: mutationSchema.array().max(2000),
    /** A large batch's mutations, gzipped (see sheet-compress.ts), instead of `mutations`. */
    packed: z.string().max(40_000_000).optional(),
  }),
  z.object({
    type: z.literal("snapshot"),
    /** The last log entry the snapshot includes. */
    seq: z.number().int().nonnegative(),
    /** The workbook (Univer's IWorkbookData), as JSON text, or gzipped JSON (`encoding`). */
    data: z.string().min(2),
    encoding: z.literal("gzip").optional(),
    /** The uploader's fingerprint of it (see sheet-fingerprint.ts). */
    hash: z.string().max(64).optional(),
  }),
  /** A client's fingerprint of its workbook at entry `seq`, to catch one that has drifted. */
  z.object({
    type: z.literal("checksum"),
    seq: z.number().int().nonnegative(),
    hash: z.string().max(64),
  }),
  z.object({type: z.literal("presence"), presence: presenceSchema.nullable()}),
  /** Sent on (re)connecting: the last entry the client has (0 for none), to catch up from. */
  z.object({type: z.literal("hello"), since: z.number().int().nonnegative()}),
]);
export type SheetSentMessage = z.infer<typeof sentMessageSchema>;

export type SheetEntry = {
  seq: number;
  batchId: string;
  mutations: SheetMutation[];
  /** Gzipped mutations, for a large batch (then `mutations` is empty). */
  packed?: string;
};

/** A stored workbook: JSON text, or gzipped JSON. */
export type SheetSnapshot = {seq: number; data: string; encoding?: "gzip"};

/** A teammate with the sheet open. */
export type SheetPeer = {
  id: string;
  userId: string;
  name: string;
  /** What they have selected, if anything. */
  presence: SheetPresence | null;
};

export type SheetReceivedMessage =
  | {
      type: "init";
      /** The workbook to start from (JSON text) and the last entry it includes; null to keep
       * the client's own (it asked to catch up) or before the first snapshot. */
      snapshot: SheetSnapshot | null;
      /** Every entry after the snapshot (or after the client's `since`), in order. */
      entries: SheetEntry[];
      /** Whether these entries continue from the client's `since` (no rebuild needed). */
      caughtUp: boolean;
      peers: SheetPeer[];
    }
  | ({type: "entry"} & SheetEntry)
  /** The batch wasn't on top of the latest entry: transform it and send it again. */
  | {type: "reject"; batchId: string}
  | ({type: "presence"} & SheetPeer)
  | {type: "leave"; id: string}
  /** This client's workbook differs from its teammates': rebuild it from the room's copy. */
  | {type: "resync"}
  /** A snapshot at `seq` was uploaded: send a fingerprint if this client is at exactly `seq`. */
  | {type: "verify"; seq: number}
  /** A snapshot at `seq` was stored (no need for another until well after it). */
  | {type: "snapshot-saved"; seq: number};

type Attachment = SheetPeer;

const SEQ_KEY = "meta:seq";
const SNAPSHOT_SEQ_KEY = "meta:snapshotSeq";
const SNAPSHOT_CHUNKS_KEY = "meta:snapshotChunks";
const SNAPSHOT_ENCODING_KEY = "meta:snapshotEncoding";
const SNAPSHOT_PREFIX = "snapshot:";
const ENTRY_PREFIX = "entry:";
const ENTRY_CHUNK_PREFIX = "entrychunk:";
// Stored values have a size limit, so a large workbook or entry is split across keys.
const CHUNK_CHARS = 256 * 1024;
const STORAGE_BATCH = 128;
// A snapshot nobody could check (no other client was idle at its entry) is kept after this many
// more entries without anyone contradicting it.
const UNCHECKED_SNAPSHOT_AFTER = 10;
// Entries kept from before the latest snapshot, so a reconnecting client can catch up.
const RETAINED_ENTRIES = 1000;

/** Storage reads and writes take at most 128 keys at a time. */
const batched = <T>(items: T[]) =>
  Array.from({length: Math.ceil(items.length / STORAGE_BATCH)}, (_, i) =>
    items.slice(i * STORAGE_BATCH, (i + 1) * STORAGE_BATCH)
  );

/** Zero-padded so the storage's lexical key order is the log order. */
const entryKey = (seq: number) => ENTRY_PREFIX + seq.toString().padStart(12, "0");
const entryChunkKey = (seq: number, i: number) =>
  `${ENTRY_CHUNK_PREFIX}${seq.toString().padStart(12, "0")}:${i.toString().padStart(6, "0")}`;

/** How an entry is stored: whole, or (when large) with its mutations in chunk keys. */
type StoredEntry = SheetEntry | {seq: number; batchId: string; chunks: number};

export class SheetRoom extends DurableObject {
  storage: DurableObjectStorage;
  // In memory only (lost on hibernation, which just skips one check):
  /** A snapshot waiting for a teammate to confirm it. */
  candidate: (SheetSnapshot & {hash: string}) | null = null;
  /** Fingerprints reported per entry: hash → the clients that reported it. */
  reports = new Map<number, Map<string, Set<WebSocket>>>();

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;
  }

  async fetch(request: Request) {
    const app = new Hono<HonoEnv>();
    app.use(authMiddleware);
    app.get("/api/sheet/:puzzleId", c => {
      const {"0": client, "1": server} = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      const user = c.var.session?.user;
      const attachment: Attachment = {
        id: uuidv7(),
        userId: user?.id ?? "",
        name: user?.name || "Teammate",
        presence: null,
      };
      server.serializeAttachment(attachment);
      return new Response(null, {status: 101, webSocket: client});
    });
    return await app.fetch(request, this.env);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    let m: SheetSentMessage;
    try {
      m = sentMessageSchema.parse(JSON.parse(message));
    } catch {
      return; // Ignore malformed messages instead of throwing in the DO.
    }

    switch (m.type) {
      case "hello": {
        // A reconnecting client can catch up from `since` if every entry after it is still
        // stored. Otherwise it starts over from the snapshot.
        const since = m.since;
        const seq = (await this.storage.get<number>(SEQ_KEY)) ?? 0;
        const oldest = await this.oldestEntrySeq();
        const caughtUp =
          since > 0 &&
          since <= seq &&
          (since === seq || (oldest !== undefined && oldest <= since + 1));
        const snapshot = caughtUp ? null : await this.readSnapshot();
        this.send(ws, {
          type: "init",
          snapshot,
          entries: await this.readEntries(caughtUp ? since : (snapshot?.seq ?? 0)),
          caughtUp,
          peers: this.peers(ws),
        });
        return;
      }
      case "presence": {
        const peer: Attachment = {...this.attachment(ws), presence: m.presence};
        ws.serializeAttachment(peer);
        this.broadcast({type: "presence", ...peer}, ws);
        return;
      }
      case "snapshot":
        if (m.hash === undefined || this.ctx.getWebSockets().length === 1) {
          // Nobody to compare with.
          await this.writeSnapshot({seq: m.seq, data: m.data, encoding: m.encoding});
          return;
        }
        // An earlier one nobody contradicted is kept before this one replaces it.
        if (this.candidate && this.candidate.seq < m.seq) {
          const {hash: _, ...earlier} = this.candidate;
          await this.writeSnapshot(earlier);
        }
        // Kept until a teammate's fingerprint confirms it (see `report`); teammates at that entry
        // are asked for theirs.
        this.candidate = {seq: m.seq, data: m.data, encoding: m.encoding, hash: m.hash};
        this.broadcast({type: "verify", seq: m.seq}, ws);
        await this.report(ws, m.seq, m.hash);
        return;
      case "checksum":
        await this.report(ws, m.seq, m.hash);
        return;
      case "mutations": {
        const seq = (await this.storage.get<number>(SEQ_KEY)) ?? 0;
        if (m.baseSeq !== seq) {
          // Made before entries this client hasn't seen yet (they're already on their way to it).
          this.send(ws, {type: "reject", batchId: m.batchId});
          return;
        }
        if (m.mutations.length === 0 && !m.packed) return;
        const entry: SheetEntry = {
          seq: seq + 1,
          batchId: m.batchId,
          mutations: m.mutations,
          ...(m.packed ? {packed: m.packed} : {}),
        };
        await this.writeEntry(entry);
        // Everyone gets it, the sender too: that's its confirmation.
        this.broadcast({type: "entry", ...entry});
        // A snapshot nobody contradicted for a while (nobody else was idle to check it): keep it.
        if (this.candidate && entry.seq >= this.candidate.seq + UNCHECKED_SNAPSHOT_AFTER) {
          const {hash: _, ...snapshot} = this.candidate;
          this.candidate = null;
          await this.writeSnapshot(snapshot);
        }
        return;
      }
    }
  }

  /**
   * Records a client's fingerprint at `seq` and compares it with its teammates'. The room's log
   * is the truth, so when fingerprints disagree, whoever is outvoted (or everyone, on a tie)
   * rebuilds from the log. A snapshot is stored once a teammate's fingerprint matches it, and
   * dropped if it was outvoted.
   */
  async report(ws: WebSocket, seq: number, hash: string) {
    let bySeq = this.reports.get(seq);
    if (!bySeq) {
      bySeq = new Map();
      this.reports.set(seq, bySeq);
      for (const old of this.reports.keys()) if (old < seq - 300) this.reports.delete(old);
    }
    for (const sockets of bySeq.values()) sockets.delete(ws);
    bySeq.set(hash, (bySeq.get(hash) ?? new Set()).add(ws));

    const groups = [...bySeq.entries()].filter(([, sockets]) => sockets.size > 0);
    const sizes = groups.map(([, sockets]) => sockets.size).toSorted((a, b) => b - a);
    const majority =
      groups.length === 1 || (sizes[0] ?? 0) > (sizes[1] ?? 0)
        ? groups.find(([, sockets]) => sockets.size === sizes[0])?.[0]
        : undefined;
    if (groups.length > 1) {
      for (const [groupHash, sockets] of groups) {
        if (groupHash === majority) continue;
        for (const socket of sockets) this.send(socket, {type: "resync"});
        sockets.clear();
      }
    }
    const candidate = this.candidate;
    if (!candidate || candidate.seq !== seq) return;
    if (candidate.hash !== majority) {
      this.candidate = null;
    } else if ((bySeq.get(candidate.hash)?.size ?? 0) >= 2) {
      this.candidate = null;
      const {hash: _, ...snapshot} = candidate;
      await this.writeSnapshot(snapshot);
    }
  }

  async readSnapshot() {
    const seq = await this.storage.get<number>(SNAPSHOT_SEQ_KEY);
    const chunks = await this.storage.get<number>(SNAPSHOT_CHUNKS_KEY);
    if (seq === undefined || chunks === undefined) return null;
    const keys = Array.from({length: chunks}, (_, i) => SNAPSHOT_PREFIX + i);
    const parts = await Promise.all(
      batched(keys).map(async batch => {
        const values = await this.storage.get<string>(batch);
        return batch.map(key => values.get(key) ?? "").join("");
      })
    );
    const encoding = await this.storage.get<"gzip">(SNAPSHOT_ENCODING_KEY);
    return {seq, data: parts.join(""), ...(encoding ? {encoding} : {})};
  }

  /**
   * Stores an entry. A stored value has a size limit (a big paste can be several MB), so a large
   * entry's mutations are split across chunk keys, like snapshots.
   */
  async writeEntry(entry: SheetEntry) {
    const json = JSON.stringify({mutations: entry.mutations, packed: entry.packed});
    if (json.length <= CHUNK_CHARS) {
      await this.storage.put({[entryKey(entry.seq)]: entry, [SEQ_KEY]: entry.seq});
      return;
    }
    const chunks: Record<string, string> = {};
    for (let i = 0; i * CHUNK_CHARS < json.length; i++) {
      chunks[entryChunkKey(entry.seq, i)] = json.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS);
    }
    const stored: StoredEntry = {
      seq: entry.seq,
      batchId: entry.batchId,
      chunks: Object.keys(chunks).length,
    };
    await this.storage.transaction(async txn => {
      await Promise.all([
        ...batched(Object.keys(chunks)).map(keys =>
          txn.put(Object.fromEntries(keys.map(key => [key, chunks[key]])))
        ),
        txn.put({[entryKey(entry.seq)]: stored, [SEQ_KEY]: entry.seq}),
      ]);
    });
  }

  /** Entries after `after`, in order. */
  async readEntries(after: number): Promise<SheetEntry[]> {
    const stored = await this.storage.list<StoredEntry>({
      prefix: ENTRY_PREFIX,
      start: entryKey(after + 1),
    });
    return await Promise.all(
      [...stored.values()].map(async entry => {
        if (!("chunks" in entry)) return entry;
        const keys = Array.from({length: entry.chunks}, (_, i) => entryChunkKey(entry.seq, i));
        const parts = await Promise.all(
          batched(keys).map(async batch => {
            const values = await this.storage.get<string>(batch);
            return batch.map(key => values.get(key) ?? "").join("");
          })
        );
        const parsed: unknown = JSON.parse(parts.join(""));
        // Written by writeEntry: {mutations, packed} (or, before packing, just the mutations).
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above.
        const body = (Array.isArray(parsed) ? {mutations: parsed} : parsed) as Pick<
          SheetEntry,
          "mutations" | "packed"
        >;
        return Object.assign({seq: entry.seq, batchId: entry.batchId}, body);
      })
    );
  }

  async oldestEntrySeq() {
    const first = await this.storage.list<SheetEntry>({prefix: ENTRY_PREFIX, limit: 1});
    return [...first.values()][0]?.seq;
  }

  /** Stores a client's snapshot (if newer than the stored one) and trims the log behind it. */
  async writeSnapshot({seq, data, encoding}: SheetSnapshot) {
    const current = (await this.storage.get<number>(SNAPSHOT_SEQ_KEY)) ?? 0;
    const latest = (await this.storage.get<number>(SEQ_KEY)) ?? 0;
    if (seq <= current || seq > latest) return;
    if (!encoding) {
      try {
        JSON.parse(data);
      } catch {
        return;
      }
    }
    const chunks: Record<string, string> = {};
    for (let i = 0; i * CHUNK_CHARS < data.length; i++) {
      chunks[SNAPSHOT_PREFIX + i] = data.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS);
    }
    const chunkKeys = Object.keys(chunks);
    const previousChunks = (await this.storage.get<number>(SNAPSHOT_CHUNKS_KEY)) ?? 0;
    const trimmed =
      seq > RETAINED_ENTRIES
        ? [
            ...(
              await this.storage.list({
                prefix: ENTRY_PREFIX,
                end: entryKey(seq - RETAINED_ENTRIES + 1),
              })
            ).keys(),
            ...(
              await this.storage.list({
                prefix: ENTRY_CHUNK_PREFIX,
                end: entryChunkKey(seq - RETAINED_ENTRIES + 1, 0),
              })
            ).keys(),
          ]
        : [];
    const stale = [
      ...trimmed,
      ...Array.from({length: previousChunks}, (_, i) => SNAPSHOT_PREFIX + i).filter(
        key => !(key in chunks)
      ),
    ];
    this.broadcast({type: "snapshot-saved", seq});
    await this.storage.transaction(async txn => {
      await Promise.all([
        ...batched(chunkKeys).map(batch =>
          txn.put(Object.fromEntries(batch.map(key => [key, chunks[key]])))
        ),
        txn.put({[SNAPSHOT_SEQ_KEY]: seq, [SNAPSHOT_CHUNKS_KEY]: chunkKeys.length}),
        encoding ? txn.put(SNAPSHOT_ENCODING_KEY, encoding) : txn.delete(SNAPSHOT_ENCODING_KEY),
        ...batched(stale).map(batch => txn.delete(batch)),
      ]);
    });
  }

  webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.depart(ws);
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  webSocketError(ws: WebSocket) {
    this.depart(ws);
  }

  depart(ws: WebSocket) {
    this.broadcast({type: "leave", id: this.attachment(ws).id}, ws);
  }

  /** Everyone else connected, with their selections (for a newcomer). */
  peers(except: WebSocket): SheetPeer[] {
    return this.ctx
      .getWebSockets()
      .filter(ws => ws !== except)
      .map(ws => this.attachment(ws));
  }

  attachment(ws: WebSocket): Attachment {
    // deserializeAttachment() is typed `any`; it's only ever written in this class.
    return ws.deserializeAttachment();
  }

  send(ws: WebSocket, data: SheetReceivedMessage) {
    ws.send(JSON.stringify(data));
  }

  broadcast(data: SheetReceivedMessage, except?: WebSocket) {
    const payload = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== except) ws.send(payload);
    }
  }

  /** Deletes the spreadsheet and its images (when the puzzle is deleted). */
  async clear(puzzleId: string) {
    for (const ws of this.ctx.getWebSockets()) ws.close(1000, "Puzzle deleted");
    await deletePuzzleFiles(this.env.R2, puzzleFilesPrefix("sheets", puzzleId));
    await this.storage.deleteAll();
  }
}
