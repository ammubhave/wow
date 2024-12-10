import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import { getDb } from "../../server/db";

export class PresenceRoom extends DurableObject<Env> {
  app: Hono<{ Bindings: Env }>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.app = new Hono<{ Bindings: Env }>();
    this.app.get("/api/do/presence/puzzles/:puzzleId", async (c) => {
      const puzzleId = z.string().parse(c.req.param("puzzleId"));
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
      const { given_name: name } = z
        .object({ given_name: z.string() })
        .parse(payload);
      await this.handleSession(pair[1], { name, puzzleId });
      return new Response(null, { status: 101, webSocket: pair[0] });
    });
    this.app.get("/api/do/presence/workspaces/:workspaceId", async (c) => {
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
      await this.handleSession(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    });
  }

  async handleSession(
    ws: WebSocket,
    data?: { name: string; puzzleId: string },
  ) {
    this.ctx.acceptWebSocket(ws);
    if (data) {
      ws.serializeAttachment(data);
    }
    this.broadcast();
  }

  async fetch(request: Request) {
    return await this.app.fetch(request, this.env, {
      passThroughOnException: () => {},
      waitUntil: this.ctx.waitUntil,
    });
  }

  webSocketClose(ws: WebSocket) {
    this.broadcast(ws);
  }

  broadcast(excludeWs?: WebSocket) {
    const participants: Record<string, string[]> = {};
    this.ctx.getWebSockets().forEach((ws) => {
      if (excludeWs === ws) {
        return;
      }
      const data = ws.deserializeAttachment();
      if (data) {
        const { name, puzzleId } = data;
        if (puzzleId) {
          participants[puzzleId] = [
            ...new Set([...(participants[puzzleId] ?? []), name]),
          ].sort();
        }
      }
    });
    this.ctx.getWebSockets().forEach((ws) => {
      ws.send(JSON.stringify(participants));
    });
  }
}

const app = new Hono<{ Bindings: Env }>();

app.get("/puzzles/:puzzleId", async (c) => {
  const puzzleId = z.string().parse(c.req.param("puzzleId"));
  const { db } = await getDb({ env: c.env, request: c.req.raw });
  const { id: workspaceId } = await db.workspace.findFirstOrThrow({
    where: {
      OR: [
        {
          rounds: {
            some: {
              unassignedPuzzles: {
                some: {
                  id: puzzleId,
                },
              },
            },
          },
        },
        {
          rounds: {
            some: {
              metaPuzzles: {
                some: {
                  puzzles: {
                    some: {
                      id: puzzleId,
                    },
                  },
                },
              },
            },
          },
        },
        {
          rounds: {
            some: {
              metaPuzzles: {
                some: {
                  id: puzzleId,
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });
  const room = c.env.PRESENCE_ROOMS.get(
    c.env.PRESENCE_ROOMS.idFromName(workspaceId),
  );
  return room.fetch(c.req.raw);
});

app.get("/workspaces/:workspaceId", async (c) => {
  const workspaceId = z.string().parse(c.req.param("workspaceId"));
  const { db } = await getDb({ env: c.env, request: c.req.raw });
  await db.workspaceMembership.findFirstOrThrow({
    where: {
      workspaceId,
    },
  });
  const room = c.env.PRESENCE_ROOMS.get(
    c.env.PRESENCE_ROOMS.idFromName(workspaceId),
  );
  return room.fetch(c.req.raw);
});

export default app;
