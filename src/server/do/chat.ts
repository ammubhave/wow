import {DurableObject} from "cloudflare:workers";
import {Hono} from "hono";
import {v7 as uuidv7} from "uuid";
import {z} from "zod";

import {authMiddleware} from "@/server/auth";
import {type HonoEnv} from "@/server/context";
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
    reaction: z.literal(["like", "love", "laugh", "question", "angry"]),
  }),
  z.object({
    type: z.literal("connect"),
    sdp: z.string(),
    tracks: z.object({trackName: z.string(), mid: z.string()}).array(),
  }),
  z.object({type: z.literal("disconnect")}),
  z.object({type: z.literal("renegotiate"), sdp: z.string().optional()}),
]);
export type ChatRoomSentMessage = z.infer<typeof chatRoomSentMessageSchema>;

export type ChatMessage = {
  id: string;
  name: string;
  text: string;
  images?: string[];
  timestamp: number;
  reactions: Record<string, number>;
};
export type ChatRoomReceivedMessage =
  | {type: "snapshot"; messages: ChatMessage[]}
  | {type: "message"; message: ChatMessage};

function isMessage(value: ChatMessage | string): value is ChatMessage {
  return typeof value !== "string";
}

function send(ws: WebSocket, message: ChatRoomReceivedMessage) {
  ws.send(JSON.stringify(message));
}
type Attachment = {
  name: string;
  rtc?: {tracks: {mid: string; trackName: string}[]; sessionId: string};
};
function putAttachment(ws: WebSocket, data: Attachment) {
  ws.serializeAttachment({...ws.deserializeAttachment(), ...data});
}
function getAttachment(ws: WebSocket): Attachment {
  // deserializeAttachment() is typed `any`; attachments are only ever written by putAttachment above.
  return ws.deserializeAttachment();
}

// Joining sends the newest messages only, so a long-running chat stays cheap to open.
const SNAPSHOT_MESSAGES = 500;

/**
 * A puzzle's chat. Messages live in the room's durable storage (keyed by uuidv7, so in time order),
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
    app.get("/api/chat/:puzzleId", async c => {
      const {"0": client, "1": server} = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      putAttachment(server, {name: c.var.session?.user.name || "User"});
      const newest = await this.storage.list<ChatMessage | string>({
        reverse: true,
        limit: SNAPSHOT_MESSAGES,
      });
      // Skip anything that isn't a message (a briefly-stored room id, in some dev rooms).
      const messages = [...newest.values()].filter(isMessage).toReversed();
      send(server, {type: "snapshot", messages});
      return new Response(null, {status: 101, webSocket: client});
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

    if (m.type === "send") {
      const key = uuidv7();
      const data: ChatMessage = {
        id: key,
        text: m.text,
        ...(m.images?.length ? {images: m.images} : {}),
        name: attachment.name,
        timestamp: Date.now(),
        reactions: {},
      };
      // Saved before it's shared, so nobody sees a message that could still be lost.
      await this.storage.put<ChatMessage>(key, data);
      this.broadcast({type: "message", message: data});

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
      if (data && isMessage(data)) {
        data.reactions[m.reaction] = (data.reactions[m.reaction] || 0) + 1;
        this.broadcast({type: "message", message: data});
        await this.storage.put(m.messageId, data);
      }
    }
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
