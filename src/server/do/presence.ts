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
      server.serializeAttachment({
        name: c.var.session!.user.name ?? "Anonymous",
        puzzleId,
        workspaceId,
      });
      this.broadcast();
      return new Response(null, {status: 101, webSocket: client});
    });
    return await app.fetch(request, this.env);
  }

  webSocketClose(ws: WebSocket) {
    this.broadcast(ws);
  }

  broadcast(excludeWs?: WebSocket) {
    const participants: Record<string, string[]> = {};
    this.ctx.getWebSockets().forEach(ws => {
      if (excludeWs === ws) {
        return;
      }
      const data = ws.deserializeAttachment();
      if (data) {
        const {name, puzzleId, workspaceId} = data;
        if (puzzleId) {
          participants[puzzleId] = [...new Set([...(participants[puzzleId] ?? []), name])].sort();
        }
        if (workspaceId) {
          participants[workspaceId] = [
            ...new Set([...(participants[workspaceId] ?? []), name]),
          ].sort();
        }
      }
    });
    this.ctx.getWebSockets().forEach(ws => {
      ws.send(JSON.stringify(participants));
    });
  }
}
