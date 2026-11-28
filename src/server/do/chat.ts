import {DurableObject} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {Hono} from "hono";
import {v7 as uuidv7} from "uuid";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {authMiddleware} from "@/server/auth";
import {type HonoEnv} from "@/server/context";
import {copyFromKv, kvMigrationStatus} from "@/server/do/kv-migration";
import {MENTION_PATTERN, plainMentions} from "@/server/notifications";
import {deletePuzzleFiles, puzzleFilesPrefix} from "@/server/puzzle-files";
import {isReadOnlyRequest} from "@/server/workspace-access";

// Image ids are the SHA-256 (hex) of the uploaded bytes, stored in R2 by the images route.
const imageIdSchema = z.string().regex(/^[0-9a-f]{64}$/);

const chatRoomSentMessageSchema = z.union([
  z
    .object({
      type: z.literal("send"),
      text: z.string().max(4000),
      images: imageIdSchema.array().max(10).optional(),
    })
    .refine(m => m.text.trim() !== "" || (m.images?.length ?? 0) > 0),
  z.object({
    type: z.literal("react"),
    messageId: z.string(),
    // An emoji, a team emoji (":name:"), or one of the original names ("like", "love", …).
    reaction: z.string().min(1).max(40),
  }),
  // Only the sender may edit or delete a message.
  z.object({type: z.literal("edit"), messageId: z.string(), text: z.string().min(1).max(4000)}),
  z.object({type: z.literal("delete"), messageId: z.string()}),
  // Anyone in the puzzle may pin or unpin.
  z.object({type: z.literal("pin"), messageId: z.string(), pinned: z.boolean()}),
  // "I'm typing" (sent every few seconds while composing): relayed to the others, never stored.
  z.object({type: z.literal("typing")}),
]);
export type ChatRoomSentMessage = z.infer<typeof chatRoomSentMessageSchema>;

export type ChatMessage = {
  id: string;
  name: string;
  /** The sender (missing on messages from before it was recorded; those can't be edited). */
  userId?: string;
  text: string;
  images?: string[];
  timestamp: number;
  reactions: Record<string, number>;
  /**
   * Who reacted with each reaction (a reaction toggles per person). Counts from before this was
   * recorded stay in `reactions`, as reactions nobody can take back.
   */
  reactedBy?: Record<string, string[]>;
  editedAt?: number;
  /** Deleted by its sender: kept as a placeholder so the conversation still reads in order. */
  deleted?: boolean;
  pinned?: {by: string; at: number};
};
export type ChatRoomReceivedMessage =
  // `pinned`: every pinned message, including ones older than the snapshot's window.
  | {type: "snapshot"; messages: ChatMessage[]; pinned: ChatMessage[]}
  // `isNew`: just sent (otherwise an existing message changed: reacted to, edited, pinned, …).
  | {type: "message"; message: ChatMessage; isNew?: boolean}
  // Someone else is typing (repeated while they are; it lapses when they stop).
  | {type: "typing"; userId: string; name: string};

/**
 * A message per row, as JSON; `pinned_at` (its `pinned.at`) lists the pinned ones in the order
 * they were pinned. Ids are uuidv7, so they sort in the order the messages were sent.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS message (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    pinned_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS message_pinned ON message (pinned_at) WHERE pinned_at IS NOT NULL;
`;

/** In the old key-value storage: the ids of the room's pinned messages, as a JSON string. */
const LEGACY_PINS_KEY = "pins";

const isLegacyMessage = (value: unknown): value is ChatMessage =>
  typeof value === "object" && value !== null && "text" in value;

function send(ws: WebSocket, message: ChatRoomReceivedMessage) {
  ws.send(JSON.stringify(message));
}
/** Whose room a socket is in: a puzzle's chat, or (puzzleId null) a team's chat. */
type Attachment = {
  name: string;
  userId: string;
  puzzleId: string | null;
  workspaceId: string | null;
  /** In an archived workspace: can read, but not post, react, edit or pin. */
  readOnly?: boolean;
};
function putAttachment(ws: WebSocket, data: Attachment) {
  ws.serializeAttachment({...ws.deserializeAttachment(), ...data});
}
function getAttachment(ws: WebSocket): Attachment {
  // deserializeAttachment() is typed `any`; attachments are only ever written by putAttachment above.
  return ws.deserializeAttachment();
}

/** The team chat's room name (puzzle chats are named by their puzzle id). */
export const teamChatRoomName = (workspaceId: string) => `team:${workspaceId}`;
/** Header the team chat's API route uses to tell the room which workspace it is (server-set). */
export const TEAM_CHAT_WORKSPACE_HEADER = "x-wow-team-chat-workspace";

/** The user ids @mentioned in a message. */
const mentionedIn = (text: string) =>
  new Set([...text.matchAll(MENTION_PATTERN)].map(match => match[2]!));

/** The fastest one socket's "typing" pings are relayed (the page sends one every 3s). */
const TYPING_MIN_INTERVAL_MS = 1500;

// Joining sends the newest messages only, so a long-running chat stays cheap to open.
const SNAPSHOT_MESSAGES = 500;

/** Eggö's commands: a message starting with one gets its reaction, and Eggö repeats it. */
const COMMANDS = [
  {value: "!stuck", reaction: "angry"},
  {value: "!help", reaction: "like"},
] as const;

/**
 * A puzzle's chat, or a team's (on the blackboard). Messages live in the room's SQLite storage,
 * which survives the object being evicted or redeployed. They're kept for as long as the puzzle
 * exists; deleting the puzzle calls `clear()`.
 */
export class ChatRoom extends DurableObject<Env> {
  sql: SqlStorage;
  /** When each socket's last "typing" was relayed (in memory: losing it on eviction is fine). */
  lastTyping = new WeakMap<WebSocket, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    void ctx.blockConcurrencyWhile(async () => {
      this.sql.exec(SCHEMA);
      await this.copyFromKv(ctx.id.name);
    });
  }

  /**
   * Brings over the room's messages from its old key-value storage (once; see kv-migration.ts).
   * Messages already here are kept, and only those on the old pin list stay pinned.
   */
  async copyFromKv(name: string | undefined) {
    return await copyFromKv(this.ctx, {
      legacy: this.env.CHAT_ROOMS_KV,
      name,
      write: entries => {
        for (const {key, value} of entries) {
          if (isLegacyMessage(value)) {
            this.sql.exec(
              "INSERT OR IGNORE INTO message (id, data) VALUES (?, ?)",
              key,
              JSON.stringify(value)
            );
          } else if (key === LEGACY_PINS_KEY && typeof value === "string") {
            const ids = z.string().array().catch([]).parse(JSON.parse(value));
            ids.forEach((id, i) =>
              this.sql.exec(
                `UPDATE message SET pinned_at = coalesce(json_extract(data, '$.pinned.at'), ?)
                 WHERE id = ? AND pinned_at IS NULL`,
                i,
                id
              )
            );
          }
        }
      },
      // A message can say it's pinned without being on the pin list (which is what the old room
      // showed): it isn't.
      finish: () =>
        this.sql.exec(
          `UPDATE message SET data = json_remove(data, '$.pinned')
           WHERE pinned_at IS NULL AND json_extract(data, '$.pinned') IS NOT NULL`
        ),
    });
  }

  kvMigrationStatus() {
    return {
      ...kvMigrationStatus(this.ctx),
      messages: this.sql.exec<{n: number}>("SELECT count(*) AS n FROM message").one().n,
    };
  }

  message(id: string): ChatMessage | undefined {
    const row = this.sql
      .exec<{data: string}>("SELECT data FROM message WHERE id = ?", id)
      .toArray();
    return row[0] && JSON.parse(row[0].data);
  }

  save(message: ChatMessage) {
    this.sql.exec(
      `INSERT INTO message (id, data, pinned_at) VALUES (?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET data = excluded.data, pinned_at = excluded.pinned_at`,
      message.id,
      JSON.stringify(message),
      message.pinned?.at ?? null
    );
  }

  messages(query: string, ...bindings: SqlStorageValue[]): ChatMessage[] {
    return this.sql
      .exec<{data: string}>(query, ...bindings)
      .toArray()
      .map(row => JSON.parse(row.data));
  }

  async fetch(request: Request) {
    const app = new Hono<HonoEnv>();
    app.use(authMiddleware);
    const join = async (
      session: HonoEnv["Variables"]["session"],
      room: {puzzleId: string | null; workspaceId: string | null},
      readOnly: boolean
    ) => {
      const {"0": client, "1": server} = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      putAttachment(server, {
        name: session?.user.name || "User",
        userId: session?.user.id ?? "",
        ...room,
        readOnly,
      });
      const messages = this.messages(
        "SELECT data FROM message ORDER BY id DESC LIMIT ?",
        SNAPSHOT_MESSAGES
      ).toReversed();
      const pinned = this.messages(
        "SELECT data FROM message WHERE pinned_at IS NOT NULL ORDER BY pinned_at"
      );
      send(server, {type: "snapshot", messages, pinned});
      return new Response(null, {status: 101, webSocket: client});
    };
    app.get("/api/chat/:puzzleId", c =>
      join(
        c.var.session,
        {puzzleId: c.req.param("puzzleId"), workspaceId: null},
        isReadOnlyRequest(c.req.raw)
      )
    );
    app.get("/api/workspaces/:workspaceSlug/chat", async c => {
      // Set by the route after checking membership (never taken from the browser).
      const workspaceId = c.req.header(TEAM_CHAT_WORKSPACE_HEADER);
      if (!workspaceId) return new Response(null, {status: 400});
      return await join(c.var.session, {puzzleId: null, workspaceId}, isReadOnlyRequest(c.req.raw));
    });
    return await app.fetch(request, this.env);
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const attachment = getAttachment(ws);
    let m: ChatRoomSentMessage;
    try {
      m = chatRoomSentMessageSchema.parse(JSON.parse(message));
    } catch {
      return; // Ignore malformed messages instead of throwing in the DO.
    }
    if (attachment.readOnly) return;

    if (m.type === "typing") {
      // A client can't make the room spam everyone: one ping per socket per interval.
      const now = Date.now();
      if (now - (this.lastTyping.get(ws) ?? 0) < TYPING_MIN_INTERVAL_MS) return;
      this.lastTyping.set(ws, now);
      const typing: ChatRoomReceivedMessage = {
        type: "typing",
        userId: attachment.userId,
        name: attachment.name,
      };
      // Everyone else (not the typist's own tabs).
      for (const other of this.ctx.getWebSockets()) {
        if (getAttachment(other).userId !== attachment.userId) send(other, typing);
      }
      return;
    }

    if (m.type === "send") {
      const key = uuidv7();
      // Eggö commands: the message gets the command's reaction and Eggö answers.
      const command = COMMANDS.find(cmd => m.text.startsWith(cmd.value));
      const data: ChatMessage = {
        id: key,
        text: m.text,
        ...(m.images?.length ? {images: m.images} : {}),
        name: attachment.name,
        userId: attachment.userId,
        timestamp: Date.now(),
        // Given before it's saved: saving it again later (after the mentions are sent, while
        // other messages are handled) would overwrite a reaction someone added meanwhile.
        reactions: command ? {[command.reaction]: 1} : {},
      };
      // Saved before it's shared, so nobody sees a message that could still be lost.
      this.save(data);
      this.broadcast({type: "message", message: data, isNew: true});
      if (command) {
        const botKey = uuidv7();
        const botData: ChatMessage = {
          id: botKey,
          text: command.value,
          name: "Eggö",
          timestamp: Date.now(),
          reactions: {},
        };
        this.save(botData);
        this.broadcast({type: "message", message: botData, isNew: true});
      }
      await this.notifyMentions(attachment, m.text);
    } else if (m.type === "react") {
      const data = this.message(m.messageId);
      if (data && !data.deleted && attachment.userId) {
        // Toggles your reaction: pressing one you already gave takes it back.
        const reactedBy = {...data.reactedBy};
        const by = reactedBy[m.reaction] ?? [];
        const had = by.includes(attachment.userId);
        const count = Math.max(0, (data.reactions[m.reaction] ?? 0) + (had ? -1 : 1));
        const reactions = {...data.reactions, [m.reaction]: count};
        if (count === 0) delete reactions[m.reaction];
        reactedBy[m.reaction] = had
          ? by.filter(id => id !== attachment.userId)
          : [...by, attachment.userId];
        if (reactedBy[m.reaction]!.length === 0) delete reactedBy[m.reaction];
        const updated: ChatMessage = {...data, reactions, reactedBy};
        this.save(updated);
        this.broadcast({type: "message", message: updated});
      }
    } else if (m.type === "edit" || m.type === "delete") {
      const data = this.message(m.messageId);
      // Only your own messages (by account, not by display name).
      if (!data || data.deleted || !data.userId) return;
      if (data.userId !== attachment.userId) return;
      const updated: ChatMessage =
        m.type === "edit"
          ? {...data, text: m.text, editedAt: Date.now()}
          : {
              ...data,
              text: "",
              images: undefined,
              reactions: {},
              reactedBy: undefined,
              deleted: true,
              pinned: undefined,
            };
      // A deleted message is also unpinned (it has no `pinned`).
      this.save(updated);
      this.broadcast({type: "message", message: updated});
      // Mentions the edit added (not ones already notified when it was sent).
      if (m.type === "edit") await this.notifyMentions(attachment, m.text, data.text);
    } else if (m.type === "pin") {
      const data = this.message(m.messageId);
      if (!data || data.deleted) return;
      const updated: ChatMessage = {
        ...data,
        pinned: m.pinned ? {by: attachment.name, at: Date.now()} : undefined,
      };
      this.save(updated);
      this.broadcast({type: "message", message: updated});
    }
  }

  /**
   * Tells anyone @mentioned in `text` (via the workspace's notifications: bell, toast). For an
   * edit, `previousText`'s mentions were already told.
   */
  async notifyMentions(sender: Attachment, text: string, previousText = "") {
    const already = mentionedIn(previousText);
    const toUserIds = [...mentionedIn(text)].filter(id => id !== sender.userId && !already.has(id));
    if (toUserIds.length === 0) return;
    // The puzzle's name and workspace now (it may have been renamed or moved since); the team
    // chat knows its workspace.
    const puzzle = sender.puzzleId
      ? await db
          .select({name: schema.puzzle.name, workspaceId: schema.round.workspaceId})
          .from(schema.puzzle)
          .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
          .where(eq(schema.puzzle.id, sender.puzzleId))
          .get()
      : null;
    const workspaceId = puzzle?.workspaceId ?? sender.workspaceId;
    if (!workspaceId) return;
    await this.env.NOTIFICATION_ROOMS.getByName(workspaceId, {locationHint: "enam"}).broadcast(
      workspaceId,
      {
        type: "mention",
        toUserIds,
        from: {id: sender.userId, name: sender.name},
        puzzleId: puzzle ? sender.puzzleId : null,
        puzzleName: puzzle?.name ?? "Team chat",
        text: plainMentions(text).slice(0, 280),
      }
    );
  }

  broadcast(data: ChatRoomReceivedMessage) {
    this.ctx.getWebSockets().forEach(ws => {
      send(ws, data);
    });
  }

  /** Deletes the chat and its images (when the puzzle is deleted). */
  async clear(puzzleId: string) {
    for (const ws of this.ctx.getWebSockets()) ws.close(1000, "Puzzle deleted");
    await deletePuzzleFiles(this.env.R2, puzzleFilesPrefix("chats", puzzleId));
    // Its old key-value copy too, so nothing can bring the messages back.
    await this.env.CHAT_ROOMS_KV.getByName(puzzleId).clear();
    await this.ctx.storage.deleteAll();
  }
}
