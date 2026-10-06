import {DurableObject} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {Hono} from "hono";
import {v7 as uuidv7} from "uuid";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {authMiddleware} from "@/server/auth";
import {type HonoEnv} from "@/server/context";
import {MENTION_PATTERN, plainMentions} from "@/server/notifications";
import {deletePuzzleFiles, puzzleFilesPrefix} from "@/server/puzzle-files";

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
  editedAt?: number;
  /** Deleted by its sender: kept as a placeholder so the conversation still reads in order. */
  deleted?: boolean;
  pinned?: {by: string; at: number};
};
export type ChatRoomReceivedMessage =
  // `pinned`: every pinned message, including ones older than the snapshot's window.
  | {type: "snapshot"; messages: ChatMessage[]; pinned: ChatMessage[]}
  | {type: "message"; message: ChatMessage}
  // Someone else is typing (repeated while they are; it lapses when they stop).
  | {type: "typing"; userId: string; name: string};

// Not a message: the ids of the room's pinned messages (a JSON string, so `isMessage` skips it).
const PINS_KEY = "pins";

function isMessage(value: ChatMessage | string): value is ChatMessage {
  return typeof value !== "string";
}

function send(ws: WebSocket, message: ChatRoomReceivedMessage) {
  ws.send(JSON.stringify(message));
}
/** Whose room a socket is in: a puzzle's chat, or (puzzleId null) a team's chat. */
type Attachment = {
  name: string;
  userId: string;
  puzzleId: string | null;
  workspaceId: string | null;
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

// Joining sends the newest messages only, so a long-running chat stays cheap to open.
const SNAPSHOT_MESSAGES = 500;

/**
 * A puzzle's chat, or a team's (on the blackboard). Messages live in the room's durable storage (keyed by uuidv7, so in time order),
 * which survives the object being evicted or redeployed. They're kept for as long as the puzzle
 * exists; deleting the puzzle calls `clear()`.
 */
export class ChatRoom extends DurableObject {
  storage: DurableObjectStorage;

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;
  }

  async fetch(request: Request) {
    const app = new Hono<HonoEnv>();
    app.use(authMiddleware);
    const join = async (
      session: HonoEnv["Variables"]["session"],
      room: {puzzleId: string | null; workspaceId: string | null}
    ) => {
      const {"0": client, "1": server} = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      putAttachment(server, {
        name: session?.user.name || "User",
        userId: session?.user.id ?? "",
        ...room,
      });
      const newest = await this.storage.list<ChatMessage | string>({
        reverse: true,
        limit: SNAPSHOT_MESSAGES,
      });
      // Skip anything that isn't a message (the pin list; a briefly-stored room id in dev rooms).
      const messages = [...newest.values()].filter(isMessage).toReversed();
      const pinIds = await this.pinIds();
      const pinned =
        pinIds.length === 0
          ? []
          : [...(await this.storage.get<ChatMessage | string>(pinIds)).values()].filter(isMessage);
      send(server, {type: "snapshot", messages, pinned});
      return new Response(null, {status: 101, webSocket: client});
    };
    app.get("/api/chat/:puzzleId", c =>
      join(c.var.session, {puzzleId: c.req.param("puzzleId"), workspaceId: null})
    );
    app.get("/api/workspaces/:workspaceSlug/chat", async c => {
      // Set by the route after checking membership (never taken from the browser).
      const workspaceId = c.req.header(TEAM_CHAT_WORKSPACE_HEADER);
      if (!workspaceId) return new Response(null, {status: 400});
      return await join(c.var.session, {puzzleId: null, workspaceId});
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

    if (m.type === "typing") {
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
      const data: ChatMessage = {
        id: key,
        text: m.text,
        ...(m.images?.length ? {images: m.images} : {}),
        name: attachment.name,
        userId: attachment.userId,
        timestamp: Date.now(),
        reactions: {},
      };
      // Saved before it's shared, so nobody sees a message that could still be lost.
      await this.storage.put<ChatMessage>(key, data);
      this.broadcast({type: "message", message: data});
      await this.notifyMentions(attachment, m.text);

      // Check for Eggö commands.
      const commands = [
        {value: "!stuck", reaction: "angry"},
        {value: "!help", reaction: "like"},
      ];
      let matchedCommand = null;
      for (const cmd of commands) {
        if (m.text.startsWith(cmd.value)) {
          matchedCommand = cmd;
          break;
        }
      }

      if (matchedCommand !== null) {
        data.reactions[matchedCommand.reaction] = 1;
        this.broadcast({type: "message", message: data});
        await this.storage.put(key, data);

        const botKey = uuidv7();
        const botData: ChatMessage = {
          id: botKey,
          text: matchedCommand.value,
          name: "Eggö",
          timestamp: Date.now(),
          reactions: {},
        };
        this.broadcast({type: "message", message: botData});
        await this.storage.put<ChatMessage>(botKey, botData);
      }
    } else if (m.type === "react") {
      const data = await this.storage.get<ChatMessage | string>(m.messageId);
      if (data && isMessage(data) && !data.deleted) {
        data.reactions[m.reaction] = (data.reactions[m.reaction] || 0) + 1;
        this.broadcast({type: "message", message: data});
        await this.storage.put(m.messageId, data);
      }
    } else if (m.type === "edit" || m.type === "delete") {
      const data = await this.storage.get<ChatMessage | string>(m.messageId);
      // Only your own messages (by account, not by display name).
      if (!data || !isMessage(data) || data.deleted || !data.userId) return;
      if (data.userId !== attachment.userId) return;
      const updated: ChatMessage =
        m.type === "edit"
          ? {...data, text: m.text, editedAt: Date.now()}
          : {...data, text: "", images: undefined, reactions: {}, deleted: true, pinned: undefined};
      await this.storage.put(m.messageId, updated);
      if (m.type === "delete" && data.pinned) await this.setPinned(m.messageId, false);
      this.broadcast({type: "message", message: updated});
    } else if (m.type === "pin") {
      const data = await this.storage.get<ChatMessage | string>(m.messageId);
      if (!data || !isMessage(data) || data.deleted) return;
      const updated: ChatMessage = {
        ...data,
        pinned: m.pinned ? {by: attachment.name, at: Date.now()} : undefined,
      };
      await this.storage.put(m.messageId, updated);
      await this.setPinned(m.messageId, m.pinned);
      this.broadcast({type: "message", message: updated});
    }
  }

  async pinIds(): Promise<string[]> {
    const stored = await this.storage.get<string>(PINS_KEY);
    return stored ? z.string().array().catch([]).parse(JSON.parse(stored)) : [];
  }

  async setPinned(messageId: string, pinned: boolean) {
    const ids = (await this.pinIds()).filter(id => id !== messageId);
    if (pinned) ids.push(messageId);
    await this.storage.put(PINS_KEY, JSON.stringify(ids));
  }

  /** Tells anyone @mentioned in `text` (via the workspace's notifications: bell, toast). */
  async notifyMentions(sender: Attachment, text: string) {
    const toUserIds = [
      ...new Set([...text.matchAll(MENTION_PATTERN)].map(match => match[2]!)),
    ].filter(id => id !== sender.userId);
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
    await this.env.NOTIFICATION_ROOMS.getByName(workspaceId, {locationHint: "enam"}).broadcast({
      type: "mention",
      toUserIds,
      from: {id: sender.userId, name: sender.name},
      puzzleId: puzzle ? sender.puzzleId : null,
      puzzleName: puzzle?.name ?? "Team chat",
      text: plainMentions(text).slice(0, 280),
    });
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
    await this.storage.deleteAlarm();
    await this.storage.deleteAll();
  }

  // Chats used to be wiped 7 days after their last activity. Rooms created before that changed
  // still have the alarm scheduled; it now does nothing, so their history is kept.
  async alarm() {}
}
