import {DurableObject} from "cloudflare:workers";
import {Hono} from "hono";
import {v7 as uuidv7} from "uuid";
import {z} from "zod";

import {authMiddleware} from "@/server/auth";
import {type HonoEnv} from "@/server/context";
import {deletePuzzleFiles, puzzleFilesPrefix} from "@/server/puzzle-files";

/**
 * A puzzle's shared whiteboard (Excalidraw scene). Each element is stored under its own key, so a
 * drawing has no size limit. Concurrent edits merge the way Excalidraw's own collaboration does:
 * per element, the higher `version` wins, ties broken by the lower `versionNonce`. Deleted
 * elements are kept as tombstones (`isDeleted`) so a late, older edit can't resurrect them.
 * Cursor positions are relayed but never stored.
 */

// Elements are Excalidraw's own JSON; only the fields used to merge are checked here.
const elementSchema = z
  .object({id: z.string().min(1).max(64), version: z.number(), versionNonce: z.number()})
  .passthrough();
type StoredElement = z.infer<typeof elementSchema>;

const pointerSchema = z.object({x: z.number(), y: z.number(), tool: z.enum(["pointer", "laser"])});

const sentMessageSchema = z.union([
  z.object({type: z.literal("elements"), elements: elementSchema.array().max(5000)}),
  z.object({
    type: z.literal("pointer"),
    pointer: pointerSchema,
    button: z.enum(["up", "down"]),
    selectedElementIds: z.record(z.string(), z.literal(true)).optional(),
  }),
]);
export type WhiteboardSentMessage = z.infer<typeof sentMessageSchema>;

export type WhiteboardReceivedMessage =
  | {type: "snapshot"; elements: StoredElement[]; you: string; peers: number}
  // How many people have the whiteboard open; clients only send cursor updates when it's > 1.
  | {type: "peers"; peers: number}
  | {type: "elements"; elements: StoredElement[]}
  | {
      type: "pointer";
      id: string;
      name: string;
      pointer: z.infer<typeof pointerSchema>;
      button: "up" | "down";
      selectedElementIds?: Record<string, true>;
    }
  | {type: "leave"; id: string};

type Attachment = {id: string; name: string};

const ELEMENT_PREFIX = "el:";
// Remembers which puzzle this room is, so expiry can delete its images too.
const PUZZLE_ID_KEY = "meta:puzzleId";
// Whiteboards outlive a hunt weekend (for write-ups), then clear after a month untouched.
const RETENTION_MS = 1000 * 60 * 60 * 24 * 30;
// Each alarm reset is a storage write, so push the deadline back at most hourly, not per edit.
const ALARM_RESET_INTERVAL_MS = 1000 * 60 * 60;

const STORAGE_BATCH = 128;

function chunks<T>(items: T[], size: number) {
  return Array.from({length: Math.ceil(items.length / size)}, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  );
}

/** Whether `incoming` should replace `current` (Excalidraw's reconciliation rule). */
function isNewer(incoming: StoredElement, current: StoredElement | undefined) {
  if (!current) return true;
  if (incoming.version !== current.version) return incoming.version > current.version;
  return incoming.versionNonce < current.versionNonce;
}

// Cost notes: sockets use the hibernation API (no duration billed while nobody's drawing);
// clients batch element updates and only send cursors when someone else is present.
export class WhiteboardRoom extends DurableObject {
  storage: DurableObjectStorage;
  // In memory only: after hibernation it's reset, which just means one extra alarm write.
  alarmResetAt = 0;

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;
  }

  async fetch(request: Request) {
    const app = new Hono<HonoEnv>();
    app.use(authMiddleware);
    app.get("/api/whiteboard/:puzzleId", async c => {
      const {"0": client, "1": server} = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      const attachment: Attachment = {id: uuidv7(), name: c.var.session?.user.name || "User"};
      server.serializeAttachment(attachment);
      const elements = [
        ...(await this.storage.list<StoredElement>({prefix: ELEMENT_PREFIX})).values(),
      ];
      if (!(await this.storage.get(PUZZLE_ID_KEY))) {
        await this.storage.put(PUZZLE_ID_KEY, c.req.param("puzzleId"));
      }
      const peers = this.ctx.getWebSockets().length;
      this.send(server, {type: "snapshot", elements, you: attachment.id, peers});
      this.broadcast({type: "peers", peers}, server);
      return new Response(null, {status: 101, webSocket: client});
    });
    return await app.fetch(request, this.env);
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    let m: WhiteboardSentMessage;
    try {
      m = sentMessageSchema.parse(JSON.parse(message));
    } catch {
      return; // Ignore malformed messages instead of throwing in the DO.
    }
    const sender = this.attachment(ws);

    if (m.type === "pointer") {
      this.broadcast(
        {
          type: "pointer",
          id: sender.id,
          name: sender.name,
          pointer: m.pointer,
          button: m.button,
          selectedElementIds: m.selectedElementIds,
        },
        ws
      );
      return;
    }

    // Keep only the elements that are newer than what's stored, then share just those. Storage
    // reads and writes take at most 128 keys at a time.
    const accepted = (
      await Promise.all(
        chunks(m.elements, STORAGE_BATCH).map(async batch => {
          const current = await this.storage.get<StoredElement>(
            batch.map(element => ELEMENT_PREFIX + element.id)
          );
          const newer = batch.filter(element =>
            isNewer(element, current.get(ELEMENT_PREFIX + element.id))
          );
          if (newer.length > 0) {
            await this.storage.put(
              Object.fromEntries(newer.map(element => [ELEMENT_PREFIX + element.id, element]))
            );
          }
          return newer;
        })
      )
    ).flat();
    if (accepted.length === 0) return;
    if (Date.now() - this.alarmResetAt > ALARM_RESET_INTERVAL_MS) {
      this.alarmResetAt = Date.now();
      await this.storage.setAlarm(Date.now() + RETENTION_MS);
    }
    this.broadcast({type: "elements", elements: accepted}, ws);
  }

  webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.depart(ws);
    // Complete the closing handshake so the connection doesn't linger half-open.
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  // Dropped connections (network loss) arrive here instead of webSocketClose.
  webSocketError(ws: WebSocket) {
    this.depart(ws);
  }

  /** Tells everyone else this person left: their cursor goes, and the peer count drops. */
  depart(ws: WebSocket) {
    this.broadcast({type: "leave", id: this.attachment(ws).id}, ws);
    const peers = this.ctx.getWebSockets().filter(socket => socket !== ws).length;
    this.broadcast({type: "peers", peers}, ws);
  }

  attachment(ws: WebSocket): Attachment {
    // deserializeAttachment() is typed `any`; it's only ever written in fetch() above.
    return ws.deserializeAttachment();
  }

  send(ws: WebSocket, data: WhiteboardReceivedMessage) {
    ws.send(JSON.stringify(data));
  }

  /** Sends to everyone except `except` (the sender, who already has the change). */
  broadcast(data: WhiteboardReceivedMessage, except?: WebSocket) {
    const payload = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== except) ws.send(payload);
    }
  }

  /** Deletes the whiteboard and its images (when the puzzle is deleted). */
  async clear(puzzleId: string) {
    for (const ws of this.ctx.getWebSockets()) ws.close(1000, "Puzzle deleted");
    await deletePuzzleFiles(this.env.R2, puzzleFilesPrefix("whiteboards", puzzleId));
    await this.storage.deleteAlarm();
    await this.storage.deleteAll();
  }

  async alarm() {
    const puzzleId = await this.storage.get<string>(PUZZLE_ID_KEY);
    if (puzzleId) await deletePuzzleFiles(this.env.R2, puzzleFilesPrefix("whiteboards", puzzleId));
    await this.storage.deleteAll();
  }
}
