import {DurableObject} from "cloudflare:workers";
import {v7 as uuidv7} from "uuid";

import {
  type NewNotification,
  type NotificationMessage,
  notificationClientMessageSchema,
  type ReadState,
  type WorkspaceNotification,
} from "@/server/notifications";

// Keys are uuidv7, so storage lists them in time order.
const PREFIX = "n:";
/** Each person's read state (by user id). */
const READ_PREFIX = "read:";
/** How many recent notifications the bell can show (older ones are dropped). */
const KEEP = 200;
/** How many a newly connected socket gets. */
const HISTORY = 100;

/** Header the API route uses to tell the room whose socket this is (set server-side only). */
export const NOTIFICATION_USER_HEADER = "x-wow-user-id";

type SocketAttachment = {userId: string};

/**
 * A workspace's notifications: pushed live to every member, and the recent ones kept. Also keeps
 * each person's read state, so "read" follows them across browsers and devices.
 */
export class NotificationRoom extends DurableObject<Env> {
  async fetch(request: Request) {
    const userId = request.headers.get(NOTIFICATION_USER_HEADER);
    // Only the authorizing API route reaches the room, and it always says who's connecting.
    if (!userId) return new Response("Missing user", {status: 400});
    const {"0": client, "1": server} = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({userId} satisfies SocketAttachment);
    const recent = await this.ctx.storage.list<WorkspaceNotification>({
      prefix: PREFIX,
      reverse: true,
      limit: HISTORY,
    });
    const history: NotificationMessage = {type: "history", notifications: [...recent.values()]};
    server.send(JSON.stringify(history));
    server.send(JSON.stringify({type: "readState", ...(await this.readState(userId))}));
    return new Response(null, {status: 101, webSocket: client});
  }

  async broadcast(data: NewNotification) {
    const id = uuidv7();
    const notification: WorkspaceNotification = {...data, id, timestamp: Date.now()};
    await this.ctx.storage.put(PREFIX + id, notification);
    const payload = JSON.stringify(notification satisfies NotificationMessage);
    for (const ws of this.ctx.getWebSockets()) ws.send(payload);
    // Now and then, drop the oldest beyond what the bell shows.
    if (Math.random() < 0.1) {
      const all = await this.ctx.storage.list({prefix: PREFIX, reverse: true});
      const old = [...all.keys()].slice(KEEP);
      // Storage deletes take at most 128 keys at a time.
      await Promise.all(
        Array.from({length: Math.ceil(old.length / 128)}, (_, i) =>
          this.ctx.storage.delete(old.slice(i * 128, (i + 1) * 128))
        )
      );
    }
  }

  /** Marking read: some notifications, or everything so far. */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    let update;
    try {
      update = notificationClientMessageSchema.parse(JSON.parse(message));
    } catch {
      return; // Ignore malformed messages instead of throwing in the DO.
    }
    const attachment: SocketAttachment | null = ws.deserializeAttachment();
    if (!attachment) return;
    const current = await this.readState(attachment.userId);
    let next: ReadState;
    if (update.type === "readAll") {
      // Up to the newest notification (by the room's clock, not the browser's).
      const newest = await this.ctx.storage.list<WorkspaceNotification>({
        prefix: PREFIX,
        reverse: true,
        limit: 1,
      });
      const newestAt = [...newest.values()][0]?.timestamp ?? current.seenAt;
      next = {seenAt: Math.max(current.seenAt, newestAt), readIds: []};
    } else {
      // Bounded: only the newest individually-read ids are worth remembering.
      const readIds = [...new Set([...current.readIds, ...update.ids])].slice(-KEEP);
      next = {seenAt: current.seenAt, readIds};
    }
    await this.ctx.storage.put(READ_PREFIX + attachment.userId, next);
    // Every one of this person's tabs and devices updates.
    const payload = JSON.stringify({type: "readState", ...next} satisfies NotificationMessage);
    for (const socket of this.ctx.getWebSockets()) {
      const other: SocketAttachment | null = socket.deserializeAttachment();
      if (other?.userId === attachment.userId) socket.send(payload);
    }
  }

  async readState(userId: string): Promise<ReadState> {
    return (
      (await this.ctx.storage.get<ReadState>(READ_PREFIX + userId)) ?? {seenAt: 0, readIds: []}
    );
  }
}
