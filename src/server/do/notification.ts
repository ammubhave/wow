import {DurableObject} from "cloudflare:workers";
import {v7 as uuidv7} from "uuid";

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

// Ids are uuidv7, so they sort in time order. `to_user_ids`: who it's for (a JSON array), or
// NULL for everyone (see isFor).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS notification (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  to_user_ids TEXT,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS read_state (
  user_id TEXT PRIMARY KEY,
  seen_at INTEGER NOT NULL,
  read_ids TEXT NOT NULL
);
`;
/** Only the notifications this person may see (`?` is their user id). */
const FOR_USER = `(to_user_ids IS NULL OR EXISTS (SELECT 1 FROM json_each(to_user_ids) WHERE value = ?))`;

/** How many notifications are kept (the oldest beyond are dropped): a hunt's worth, and more. */
const KEEP = 5000;
/** How many a newly connected socket gets, and how many each "older" page has. */
const PAGE = 100;
/** Bounded: only the newest individually-read ids are worth remembering. */
const READ_IDS = 200;

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
 * A workspace's notifications: pushed live to every member, and kept, so the bell can page back
 * through them. Also keeps each person's read state, so "read" follows them across browsers and
 * devices.
 */
export class NotificationRoom extends DurableObject<Env> {
  sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(NOTIFICATION_PING, NOTIFICATION_PONG)
    );
    this.sql = ctx.storage.sql;
    this.sql.exec(SCHEMA);
  }

  async fetch(request: Request) {
    const userId = request.headers.get(NOTIFICATION_USER_HEADER);
    // Only the authorizing API route reaches the room, and it always says who's connecting.
    if (!userId) return new Response("Missing user", {status: 400});
    const {"0": client, "1": server} = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({userId} satisfies SocketAttachment);
    const history: NotificationMessage = {type: "history", ...this.page(userId)};
    server.send(JSON.stringify(history));
    server.send(JSON.stringify({type: "readState", ...this.readState(userId)}));
    return new Response(null, {status: 101, webSocket: client});
  }

  /**
   * A new notification: kept, sent to the sockets of everyone it's for, and pushed to their
   * devices (Web Push, for when WOW isn't open). `workspaceId` is this room's name.
   */
  async broadcast(workspaceId: string, data: NewNotification) {
    const notification: WorkspaceNotification = {...data, id: uuidv7(), timestamp: Date.now()};
    this.save(notification);
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
    // Now and then, drop the oldest beyond what's kept.
    if (Math.random() < 0.1) {
      this.sql.exec(
        `DELETE FROM notification WHERE id < (
           SELECT id FROM notification ORDER BY id DESC LIMIT 1 OFFSET ?
         )`,
        KEEP - 1
      );
    }
  }

  /** Marking read (some notifications, or everything so far), or asking for older ones. */
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
    if (update.type === "older") {
      const older: NotificationMessage = {
        type: "older",
        ...this.page(attachment.userId, update.before),
      };
      ws.send(JSON.stringify(older));
      return;
    }
    const current = this.readState(attachment.userId);
    let next: ReadState;
    if (update.type === "readAll") {
      // Up to the newest notification (by the room's clock, not the browser's).
      const newest = this.sql
        .exec<{at: number}>("SELECT at FROM notification ORDER BY id DESC LIMIT 1")
        .toArray()[0];
      next = {seenAt: Math.max(current.seenAt, newest?.at ?? current.seenAt), readIds: []};
    } else {
      const readIds = [...new Set([...current.readIds, ...update.ids])].slice(-READ_IDS);
      next = {seenAt: current.seenAt, readIds};
    }
    this.saveReadState(attachment.userId, next);
    // Every one of this person's tabs and devices updates.
    const payload = JSON.stringify({type: "readState", ...next} satisfies NotificationMessage);
    for (const socket of this.ctx.getWebSockets()) {
      const other: SocketAttachment | null = socket.deserializeAttachment();
      if (other?.userId === attachment.userId) socket.send(payload);
    }
  }

  /** What `userId` may see, newest first: the newest, or those older than `before`. */
  page(
    userId: string,
    before?: string
  ): {notifications: WorkspaceNotification[]; hasMore: boolean} {
    const rows = (
      before === undefined
        ? this.sql.exec<{data: string}>(
            `SELECT data FROM notification WHERE ${FOR_USER} ORDER BY id DESC LIMIT ?`,
            userId,
            PAGE + 1
          )
        : this.sql.exec<{data: string}>(
            `SELECT data FROM notification WHERE id < ? AND ${FOR_USER} ORDER BY id DESC LIMIT ?`,
            before,
            userId,
            PAGE + 1
          )
    ).toArray();
    return {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- written by save().
      notifications: rows.slice(0, PAGE).map(row => JSON.parse(row.data) as WorkspaceNotification),
      hasMore: rows.length > PAGE,
    };
  }

  save(notification: WorkspaceNotification) {
    this.sql.exec(
      "INSERT OR REPLACE INTO notification (id, at, to_user_ids, data) VALUES (?, ?, ?, ?)",
      notification.id,
      notification.timestamp,
      "toUserIds" in notification ? JSON.stringify(notification.toUserIds) : null,
      JSON.stringify(notification)
    );
  }

  readState(userId: string): ReadState {
    const row = this.sql
      .exec<{seen_at: number; read_ids: string}>(
        "SELECT seen_at, read_ids FROM read_state WHERE user_id = ?",
        userId
      )
      .toArray()[0];
    if (!row) return {seenAt: 0, readIds: []};
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- written by saveReadState().
    return {seenAt: row.seen_at, readIds: JSON.parse(row.read_ids) as string[]};
  }

  saveReadState(userId: string, {seenAt, readIds}: ReadState) {
    this.sql.exec(
      "INSERT OR REPLACE INTO read_state (user_id, seen_at, read_ids) VALUES (?, ?, ?)",
      userId,
      seenAt,
      JSON.stringify(readIds)
    );
  }
}
