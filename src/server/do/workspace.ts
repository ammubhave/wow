/**
 * Durable Object managing a workspace room.
 * Sends updates to connected clients when the workspace data changes.
 * Any procedure that modifies workspace data should call the `invalidate` method
 * to re-broadcast the updated data.
 */

import {DurableObject, env} from "cloudflare:workers";
import {and, desc, eq, gte, lt, or} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

// Overlap window when re-reading the activity log incrementally, so entries committed slightly out
// of `createdAt` order are not missed (results are de-duplicated by id).
const ACTIVITY_LOG_OVERLAP_MS = 10_000;
// The room state carries only the newest activity entries (the footer shows the latest); the
// activity page pages through older ones (`workspaces.activityLog`).
const RECENT_ACTIVITY_LOG_ENTRIES = 50;

/// Position in the activity log, newest first: an entry's createdAt and id (ties broken by id).
export type ActivityLogCursor = {createdAt: number; id: string};

/// Fetches activity log entries for the workspace, newest first, served by the
/// (workspaceId, createdAt) index: entries at or after `since`, or (for paging) up to `limit`
/// entries older than `before`.
export function getActivityLogEntries(
  workspaceId: string,
  {since, before, limit}: {since?: Date; before?: ActivityLogCursor; limit?: number} = {}
) {
  return db
    .select({
      activity_log_entry: schema.activityLogEntry,
      // Only what the activity feed renders; not the full user row.
      user: {
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
      },
      round_activity_log_entry: schema.roundActivityLogEntry,
      puzzle_activity_log_entry: schema.puzzleActivityLogEntry,
      workspace_activity_log_entry: schema.workspaceActivityLogEntry,
    })
    .from(schema.activityLogEntry)
    .leftJoin(schema.user, eq(schema.activityLogEntry.userId, schema.user.id))
    .leftJoin(
      schema.roundActivityLogEntry,
      eq(schema.activityLogEntry.id, schema.roundActivityLogEntry.activityLogEntryId)
    )
    .leftJoin(
      schema.puzzleActivityLogEntry,
      eq(schema.activityLogEntry.id, schema.puzzleActivityLogEntry.activityLogEntryId)
    )
    .leftJoin(
      schema.workspaceActivityLogEntry,
      eq(schema.activityLogEntry.id, schema.workspaceActivityLogEntry.activityLogEntryId)
    )
    .where(
      and(
        eq(schema.activityLogEntry.workspaceId, workspaceId),
        since && gte(schema.activityLogEntry.createdAt, since),
        before &&
          or(
            lt(schema.activityLogEntry.createdAt, new Date(before.createdAt)),
            and(
              eq(schema.activityLogEntry.createdAt, new Date(before.createdAt)),
              lt(schema.activityLogEntry.id, before.id)
            )
          )
      )
    )
    .orderBy(desc(schema.activityLogEntry.createdAt), desc(schema.activityLogEntry.id))
    .limit(limit ?? -1);
}
type ActivityLogEntries = Awaited<ReturnType<typeof getActivityLogEntries>>;

/// Fetches the workspace data along with its rounds and puzzles. When `previousActivityLog` is
/// given, only newer activity log entries are read and merged into it.
async function getWorkspace(workspaceId: string, previousActivityLog?: ActivityLogEntries) {
  const newest = previousActivityLog?.[0]?.activity_log_entry.createdAt;
  const since = newest ? new Date(newest.getTime() - ACTIVITY_LOG_OVERLAP_MS) : undefined;
  const [workspace, rounds, newActivityLogEntries] = await Promise.all([
    db.select().from(schema.organization).where(eq(schema.organization.id, workspaceId)).get(),
    db.query.round.findMany({where: {workspaceId}, with: {puzzles: true}}),
    // Cold: just the newest entries. Warm: only what's new since the newest cached one.
    getActivityLogEntries(workspaceId, since ? {since} : {limit: RECENT_ACTIVITY_LOG_ENTRIES}),
  ]);
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

  let activityLogEntries = newActivityLogEntries;
  if (since && previousActivityLog) {
    // Entries can only be removed by cascade (workspace/user deletion), so merging is safe.
    const seen = new Set(newActivityLogEntries.map(e => e.activity_log_entry.id));
    activityLogEntries = [
      ...newActivityLogEntries,
      ...previousActivityLog.filter(e => !seen.has(e.activity_log_entry.id)),
    ].slice(0, RECENT_ACTIVITY_LOG_ENTRIES);
  }

  // Broadcast to every member's browser: never include the Google OAuth credentials.
  const {
    googleAccessToken,
    googleRefreshToken: _,
    googleTokenExpiresAt: __,
    ...publicWorkspace
  } = workspace;
  return {
    ...publicWorkspace,
    googleConnected: googleAccessToken !== null,
    activityLogEntries,
    // Flat: each puzzle is sent once; clients derive children/metas (see expandWorkspaceState).
    rounds,
    // JSON columns (typed `unknown`): validate rather than cast.
    tags: z
      .array(z.string())
      .catch([])
      .parse(workspace.tags ?? []),
    links: z
      .array(z.object({name: z.string(), url: z.string()}))
      .catch([])
      .parse(workspace.links ?? []),
  };
}

/// The data sent over the WebSocket (puzzles flat, without derived views).
export type WorkspaceRoomWireState = Awaited<ReturnType<typeof getWorkspace>>;
/// The expanded state clients work with.
export type {WorkspaceRoomState} from "@/lib/workspace-state";

/// Fetches the Durable Object stub for the given workspace ID.
export function getWorkspaceRoom(workspaceId: string) {
  return env.WORKSPACE_ROOMS.getByName(workspaceId);
}

/// Re-broadcasts the workspace's data to its connected clients. Call after modifying workspace data.
export async function invalidateWorkspace(workspaceId: string) {
  await getWorkspaceRoom(workspaceId).invalidate(workspaceId);
}

export class WorkspaceRoom extends DurableObject<Env> {
  /// Cache of the current workspace data (undefined until loaded, or after being dropped while no
  /// client was connected).
  workspace: WorkspaceRoomWireState | undefined;
  /// Recent activity log, kept across cache drops so reloads only read new entries.
  activityLog: ActivityLogEntries | undefined;
  /// The reload currently running, and a single follow-up reload queued behind it.
  #running: Promise<void> | undefined;
  #queued: Promise<void> | undefined;
  #workspaceId: string | undefined;
  /// `workspace` as sent to clients (recent activity only), serialized once per reload.
  #message: string | undefined;

  /// Loads the workspace data and broadcasts it to all connected clients.
  async #load(workspaceId: string) {
    this.workspace = await getWorkspace(workspaceId, this.activityLog);
    this.activityLog = this.workspace.activityLogEntries;
    this.#message = JSON.stringify(this.workspace);
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(this.#message);
    }
  }

  /// Coalesces reloads: a reload requested while one is in flight waits for it and then runs once
  /// more (its result must reflect writes made before the request), and any further requests in
  /// that window share the same follow-up. A burst of N invalidations costs at most 2 reloads.
  #reload(workspaceId: string): Promise<void> {
    if (this.#queued) return this.#queued;
    if (this.#running) {
      const queued = this.#running
        .catch(() => {})
        .then(() => {
          this.#queued = undefined;
          return this.#reload(workspaceId);
        });
      this.#queued = queued;
      return queued;
    }
    const running = this.#load(workspaceId).finally(() => {
      this.#running = undefined;
    });
    this.#running = running;
    return running;
  }

  /// Loads the workspace data if it isn't cached. Must be called before `fetch`.
  async initialize(workspaceId: string) {
    this.#workspaceId = workspaceId;
    if (this.workspace) return;
    await this.#reload(workspaceId);
  }

  /// Re-fetches the workspace data and re-broadcasts to all connected clients.
  /// Called by any procedure that modifies workspace data.
  async invalidate(workspaceId: string) {
    if (this.ctx.getWebSockets().length === 0 && !this.#running) {
      // Nobody to broadcast to: drop the cache instead of re-reading D1; the next connection
      // (`initialize`) reloads it.
      this.workspace = undefined;
      this.#message = undefined;
      return;
    }
    await this.#reload(workspaceId);
  }

  /// The current room state as JSON (the same message clients receive), for server rendering.
  async getState(workspaceId: string) {
    this.#workspaceId = workspaceId;
    if (!this.#message) await this.#reload(workspaceId);
    return this.#message!;
  }

  /// Handles incoming WebSocket connections.
  /// Sends the current workspace data upon connection.
  async fetch() {
    // The cache may have been dropped by an `invalidate` between `initialize` and this call.
    if (!this.#message && this.#workspaceId) await this.#reload(this.#workspaceId);
    if (!this.#message) {
      return new Response("Workspace room not initialized", {status: 500});
    }
    const {"0": client, "1": server} = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.send(this.#message);
    return new Response(null, {status: 101, webSocket: client});
  }
}
