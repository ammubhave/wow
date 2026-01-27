import {DurableObject} from "cloudflare:workers";
import {Hono} from "hono";
import {v7 as uuidv7} from "uuid";
import {z} from "zod";

import {authMiddleware} from "@/server/auth";
import {type HonoEnv} from "@/server/context";

const chatRoomSentMessageSchema = z.union([
  z.object({type: z.literal("send"), text: z.string()}),
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
  timestamp: number;
  reactions: Record<string, number>;
};
export type ChatRoomReceivedMessage =
  | {type: "snapshot"; messages: ChatMessage[]}
  | {type: "message"; message: ChatMessage};

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
  return ws.deserializeAttachment() as Attachment;
}

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
      await this.resetAlarm();
      putAttachment(server, {name: c.var.session?.user.name || "User"});
      send(server, {
        type: "snapshot",
        messages: [...(await this.storage.list<ChatMessage>()).values()],
      });
      return new Response(null, {status: 101, webSocket: client});
    });
    return await app.fetch(request, this.env);
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    await this.resetAlarm();
    const attachment = getAttachment(ws);
    const m = chatRoomSentMessageSchema.parse(JSON.parse(message));

    if (m.type === "send") {
      const key = uuidv7();
      const data: ChatMessage = {
        id: key,
        text: m.text,
        name: attachment.name,
        timestamp: Date.now(),
        reactions: {},
      };
      this.broadcast({type: "message", message: data});
      await this.storage.put<ChatMessage>(key, data);

      const commands = ["!stuck", "!help"];
      var matchedCommand = "";
      for (const cmd of commands) {
        if (m.text.startsWith(cmd)) {
          matchedCommand = cmd;
          break;
        }
      }

      if (matchedCommand !== "") {
        if (matchedCommand === "!stuck") {
          data.reactions["angry"] = 1;
        } else if (matchedCommand === "!help") {
          data.reactions["like"] = 1;
        }
        this.broadcast({type: "message", message: data});
        await this.storage.put(key, data);

        const botKey = uuidv7();
        const botData: ChatMessage = {
          id: botKey,
          text: matchedCommand,
          name: "Eggö",
          timestamp: Date.now(),
          reactions: {},
        };
        this.broadcast({type: "message", message: botData});
        await this.storage.put<ChatMessage>(botKey, botData);
      }
    } else if (m.type === "react") {
      const data = await this.storage.get<ChatMessage>(m.messageId);
      if (data) {
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

  async resetAlarm() {
    // All chats are deleted after 7 days
    await this.storage.setAlarm(Date.now() + 1000 * 60 * 60 * 24 * 7);
  }

  async alarm() {
    await this.storage.deleteAll();
  }
}
