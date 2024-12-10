import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import { getDb } from "../../db";

export class ChatRoom extends DurableObject<Env> {
  storage: DurableObjectStorage;
  app: Hono<{ Bindings: Env }>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;

    this.app = new Hono<{ Bindings: Env }>();
    this.app.get("/api/do/chat/:puzzleId", async (c) => {
      if (c.req.header("Upgrade") != "websocket") {
        return new Response("expected websocket", { status: 400 });
      }
      const token = new URL(c.req.url).searchParams.get("token");
      if (!token) {
        return new Response("expected token", { status: 400 });
      }
      const { payload } = await jwtVerify(
        token,
        createRemoteJWKSet(
          new URL("https://auth.wafflehaus.io/.well-known/jwks"),
        ),
      );
      const pair = new WebSocketPair();
      await this.handleSession(
        pair[1],
        z.object({ given_name: z.string() }).parse(payload),
      );
      return new Response(null, { status: 101, webSocket: pair[0] });
    });
  }

  async fetch(request: Request) {
    return await this.app.fetch(request, this.env, {
      passThroughOnException: () => {},
      waitUntil: this.ctx.waitUntil,
    });
  }

  async handleSession(ws: WebSocket, { given_name }: { given_name: string }) {
    await this.resetAlarm();
    this.ctx.acceptWebSocket(ws);
    ws.serializeAttachment({ ...ws.deserializeAttachment(), name: given_name });
    ws.send(JSON.stringify([...(await this.storage.list()).values()]));
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    await this.resetAlarm();
    const { name } = z
      .object({ name: z.string() })
      .parse(ws.deserializeAttachment());
    const data = {
      ...z.object({ text: z.string() }).parse(JSON.parse(message)),
      name,
      timestamp: Date.now(),
    };
    this.broadcast(data);
    const key = `${data.timestamp
      .toString()
      .padStart(20)}-${crypto.randomUUID()}`;
    await this.storage.put(key, data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  broadcast(data: any) {
    const message = JSON.stringify(data);
    this.ctx.getWebSockets().forEach((ws) => {
      ws.send(message);
    });
  }

  async resetAlarm() {
    // All chats are deleted after 7 days
    this.storage.setAlarm(Date.now() + 1000 * 60 * 60 * 24 * 7);
  }
  async alarm() {
    await this.storage.deleteAll();
  }
}

const app = new Hono<{ Bindings: Env }>();

app.get("/:puzzleId", async (c) => {
  const puzzleId = z.string().parse(c.req.param("puzzleId"));
  const { db } = await getDb({ env: c.env, request: c.req.raw });

  if (puzzleId.startsWith("meta-")) {
    await db.metaPuzzle.findFirstOrThrow({
      where: { id: puzzleId },
      select: { id: true },
    });
  } else {
    await db.puzzle.findFirstOrThrow({
      where: { id: puzzleId },
      select: { id: true },
    });
  }
  const room = c.env.CHAT_ROOMS.get(c.env.CHAT_ROOMS.idFromName(puzzleId));
  return room.fetch(c.req.raw);
});

export default app;
