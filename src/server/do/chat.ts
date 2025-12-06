import {DurableObject} from "cloudflare:workers";
import {Hono} from "hono";
import {z} from "zod";

import {authMiddleware} from "@/server/auth";
import {type HonoEnv} from "@/server/context";

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
      server.serializeAttachment({
        ...server.deserializeAttachment(),
        name: c.var.user!.firstName || "User",
      });
      server.send(JSON.stringify([...(await this.storage.list()).values()]));
      return new Response(null, {status: 101, webSocket: client});
    });
    return await app.fetch(request, this.env);
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    await this.resetAlarm();
    const {name} = z.object({name: z.string()}).parse(ws.deserializeAttachment());
    const data = {
      ...z.object({text: z.string()}).parse(JSON.parse(message)),
      name,
      timestamp: Date.now(),
    };
    this.broadcast(data);
    const key = `${data.timestamp.toString().padStart(20)}-${crypto.randomUUID()}`;
    await this.storage.put(key, data);
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    this.ctx.getWebSockets().forEach(ws => {
      ws.send(message);
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
