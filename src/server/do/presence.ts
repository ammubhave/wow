import {DurableObject} from "cloudflare:workers";
import {Hono} from "hono";
import z from "zod";

import {authMiddleware} from "@/server/auth";
import {HonoEnv} from "@/server/context";

export class PresenceRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request) {
    const app = new Hono<HonoEnv>();
    app.use(authMiddleware);
    app.get("/api/presence", async c => {
      const url = new URL(request.url);
      const workspaceId = z.string().parse(url.searchParams.get("workspaceId"));
      const puzzleId = z.string().nullable().parse(url.searchParams.get("puzzleId"));
      const {"0": client, "1": server} = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({user: c.var.session!.user, puzzleId, workspaceId});
      this.broadcast();
      return new Response(null, {status: 101, webSocket: client});
    });
    return await app.fetch(request, this.env);
  }

  webSocketClose(ws: WebSocket) {
    this.broadcast(ws);
  }

  broadcast(excludeWs?: WebSocket) {
    const participants: Record<
      string,
      {
        id: string;
        name: string;
        email: string;
        image: string | null;
        displayUsername: string | null;
      }[]
    > = {};
    this.ctx.getWebSockets().forEach(ws => {
      if (excludeWs === ws) {
        return;
      }
      const data = ws.deserializeAttachment();
      if (data) {
        const {user, puzzleId, workspaceId} = data;
        const id = puzzleId ?? workspaceId;
        if (!participants[id]) {
          participants[id] = [];
        }
        if (participants[id].findIndex(u => u.id === user.id) === -1) {
          participants[id].push(user);
        }
      }
    });
    this.ctx.getWebSockets().forEach(ws => {
      ws.send(JSON.stringify(participants));
    });
  }
}
