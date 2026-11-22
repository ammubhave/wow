import {DurableObject} from "cloudflare:workers";
import {Hono} from "hono";
import {z} from "zod";

import {authMiddleware} from "@/server/auth";
import {HonoEnv} from "@/server/context";

type PresenceUser = {id: string; name: string; email: string; image: string | null};
type Attachment = {user: PresenceUser; location: string};

export type PresenceMessage =
  | {type: "snapshot"; presences: Record<string, PresenceUser[]>}
  | {type: "join"; location: string; user: PresenceUser}
  | {type: "leave"; location: string; userId: string};

function attachment(ws: WebSocket): Attachment | null {
  // Sockets accepted before this format (puzzleId/workspaceSlug) are read the same way.
  const data: (Partial<Attachment> & {puzzleId?: string | null; workspaceSlug?: string}) | null =
    ws.deserializeAttachment();
  if (!data?.user) return null;
  const location = data.location ?? data.puzzleId ?? data.workspaceSlug;
  return location ? {user: data.user, location} : null;
}

function sameSpot(data: Attachment | null, userId: string, location: string) {
  return data?.user.id === userId && data.location === location;
}

/** Serialized once, however many sockets it goes to. */
function send(sockets: WebSocket[], message: PresenceMessage) {
  if (sockets.length === 0) return;
  const payload = JSON.stringify(message);
  for (const ws of sockets) ws.send(payload);
}

export class PresenceRoom extends DurableObject<Env> {
  async fetch(request: Request) {
    const app = new Hono<HonoEnv>();
    app.use(authMiddleware);
    app.get("/api/presence", async c => {
      const url = new URL(request.url);
      const workspaceSlug = z.string().parse(url.searchParams.get("workspaceSlug"));
      const puzzleId = z.string().nullable().parse(url.searchParams.get("puzzleId"));
      const session = c.var.session;
      if (!session) return c.body(null, 401);
      const {"0": client, "1": server} = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      // Broadcast to every participant: keep only what the presence UI renders, not the full
      // session user (email verification state, settings, ...).
      const {id, name, email, image} = session.user;
      const user: PresenceUser = {id, name, email, image: image ?? null};
      const location = puzzleId ?? workspaceSlug;
      const others = this.ctx.getWebSockets().filter(ws => ws !== server);
      // Only the newcomer gets everything; everyone else hears about the one change, and only if
      // this person wasn't already shown there (another tab).
      const alreadyThere = others.some(ws => sameSpot(attachment(ws), id, location));
      server.serializeAttachment({user, location} satisfies Attachment);
      server.send(JSON.stringify({type: "snapshot", presences: this.presences()}));
      if (!alreadyThere) {
        send(others, {type: "join", location, user});
      }
      return new Response(null, {status: 101, webSocket: client});
    });
    return await app.fetch(request, this.env);
  }

  webSocketClose(ws: WebSocket) {
    this.depart(ws);
  }

  // Dropped connections (network loss) arrive here instead of webSocketClose.
  webSocketError(ws: WebSocket) {
    this.depart(ws);
  }

  depart(ws: WebSocket) {
    const left = attachment(ws);
    if (!left) return;
    // Forget it, so a close following an error doesn't announce the departure twice.
    ws.serializeAttachment(null);
    const others = this.ctx.getWebSockets().filter(other => other !== ws);
    // Still there in another tab: nothing changed for anyone.
    if (others.some(other => sameSpot(attachment(other), left.user.id, left.location))) return;
    send(others, {type: "leave", location: left.location, userId: left.user.id});
  }

  /** Who's where: each location (a puzzle id, or the workspace slug) and the people there. */
  presences() {
    const presences: Record<string, PresenceUser[]> = {};
    for (const ws of this.ctx.getWebSockets()) {
      const data = attachment(ws);
      if (!data) continue;
      const people = (presences[data.location] ??= []);
      if (!people.some(u => u.id === data.user.id)) people.push(data.user);
    }
    return presences;
  }
}
