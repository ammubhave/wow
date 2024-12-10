import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import { getDb } from "../../db";

export class NotificationRoom extends DurableObject<Env> {
  app: Hono<{ Bindings: Env }>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.app = new Hono<{ Bindings: Env }>();
    this.app.get("/api/do/notification/:workspaceId", async (c) => {
      if (c.req.header("Upgrade") != "websocket") {
        return new Response("expected websocket", { status: 400 });
      }
      const token = new URL(c.req.url).searchParams.get("token");
      if (!token) {
        return new Response("expected token", { status: 400 });
      }
      await jwtVerify(
        token,
        createRemoteJWKSet(
          new URL("https://auth.wafflehaus.io/.well-known/jwks"),
        ),
      );
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    });
    this.app.post("/broadcast", async (c) => {
      this.broadcast(
        JSON.stringify({
          ...(await c.req.json()),
          timestamp: Date.now(),
        }),
      );
      return new Response(null, { status: 200 });
    });
  }

  async fetch(request: Request) {
    return await this.app.fetch(request, this.env, {
      passThroughOnException: () => {},
      waitUntil: this.ctx.waitUntil,
    });
  }

  async handleSession(ws: WebSocket) {
    this.ctx.acceptWebSocket(ws);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  broadcast(message: any) {
    this.ctx.getWebSockets().forEach((ws) => {
      ws.send(message);
    });
  }
}

const app = new Hono<{ Bindings: Env }>();

app.get("/:workspaceId", async (c) => {
  const workspaceId = z.string().parse(c.req.param("workspaceId"));
  const { db } = await getDb({ env: c.env, request: c.req.raw });
  await db.workspaceMembership.findFirstOrThrow({
    where: { workspaceId },
  });
  const room = c.env.NOTIFICATION_ROOMS.get(
    c.env.NOTIFICATION_ROOMS.idFromName(workspaceId),
  );
  return room.fetch(c.req.raw);
});

export default app;
