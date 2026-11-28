import {DurableObject} from "cloudflare:workers";
import {v7 as uuidv7} from "uuid";

import {copyFromKv, kvMigrationStatus, putMissing} from "@/server/do/kv-migration";
import {
  NOTIFICATION_PING,
  NOTIFICATION_PONG,
  type NewNotification,
  type NotificationMessage,
  notificationClientMessageSchema,
  type ReadState,
  type WorkspaceNotification,
} from "@/server/notifications";
import {pushNotification} from "@/server/push";

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
 * Mentions are only for whoever was mentioned, and Drive sharing problems only for the owners;
 * everything else is for everyone. Others never receive them (a mention quotes the message).
 */
const isFor = (notification: WorkspaceNotification, userId: string) =>
  !("toUserIds" in notification) || notification.toUserIds.includes(userId);

/**
 * A workspace's notifications: pushed live to every member, and the recent ones kept. Also keeps
 * each person's read state, so "read" follows them across browsers and devices.
 */
export class NotificationRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(NOTIFICATION_PING, NOTIFICATION_PONG)
    );
    void ctx.blockConcurrencyWhile(async () => {
      await this.copyFromKv(ctx.id.name);
    });
  }

  /** Brings over the old key-value storage's notifications and read states (see kv-migration.ts). */
  async copyFromKv(name: string | undefined) {
    return await copyFromKv(this.ctx, {
      legacy: this.env.NOTIFICATION_ROOMS_KV,
      name,
      write: putMissing(this.ctx),
    });
  }

  kvMigrationStatus() {
    return {...kvMigrationStatus(this.ctx)};
  }

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
    });
    const history: NotificationMessage = {
      type: "history",
      notifications: [...recent.values()].filter(n => isFor(n, userId)).slice(0, HISTORY),
    };
    server.send(JSON.stringify(history));
    server.send(JSON.stringify({type: "readState", ...(await this.readState(userId))}));
    return new Response(null, {status: 101, webSocket: client});
  }

  /**
   * A new notification: kept, sent to the sockets of everyone it's for, and pushed to their
   * devices (Web Push, for when WOW isn't open). `workspaceId` is this room's name.
   */
  async broadcast(workspaceId: string, data: NewNotification) {
    const id = uuidv7();
    const notification: WorkspaceNotification = {...data, id, timestamp: Date.now()};
    await this.ctx.storage.put(PREFIX + id, notification);
    const payload = JSON.stringify(notification satisfies NotificationMessage);
    for (const ws of this.ctx.getWebSockets()) {
      const attachment: SocketAttachment | null = ws.deserializeAttachment();
      if (attachment && isFor(notification, attachment.userId)) ws.send(payload);
    }
    // In the background: whoever sent it (a chat message, a solve) doesn't wait on push services.
    this.ctx.waitUntil(
      pushNotification(workspaceId, notification).catch((error: unknown) =>
        console.error("Couldn't send push notifications", error)
      )
    );
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
