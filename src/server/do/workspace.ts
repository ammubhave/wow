/**
 * Durable Object managing a workspace room.
 * Sends updates to connected clients when the workspace data changes.
 * Any procedure that modifies workspace data should call the `invalidate` method
 * to re-broadcast the updated data.
 */

import {DurableObject, env} from "cloudflare:workers";
import {desc, eq} from "drizzle-orm";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

/// Fetches the workspace data along with its rounds and puzzles.
async function getWorkspace(workspaceId: string) {
  const workspace = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, workspaceId))
    .get();
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);
  const [rounds, activityLogEntries] = await Promise.all([
    db.query.round.findMany({
      where: (t, {eq}) => eq(t.workspaceId, workspace.id),
      with: {puzzles: {with: {childPuzzles: true}}},
    }),
    db
      .select()
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
      .where(eq(schema.activityLogEntry.workspaceId, workspace.id))
      .orderBy(desc(schema.activityLogEntry.createdAt)),
  ]);

  return {
    ...workspace,
    activityLogEntries,
    rounds: rounds.map(round => ({
      ...round,
      unassignedPuzzles: round.puzzles.filter(
        puzzle => !puzzle.isMetaPuzzle && puzzle.parentPuzzleId === null
      ),
      metaPuzzles: round.puzzles.filter(puzzle => puzzle.isMetaPuzzle),
    })),
    tags: (workspace.tags ?? []) as string[],
    links: (workspace.links ?? []) as {name: string; url: string}[],
  };
}

/// Type representing the state of the workspace room.
/// The type is used by clients to type the data received over WebSocket.
export type WorkspaceRoomState = Awaited<ReturnType<typeof getWorkspace>>;

/// Fetches the Durable Object instance for the given workspace ID.
export async function getWorkspaceRoom(workspaceId: string) {
  const room = env.WORKSPACE_ROOMS.getByName(workspaceId);
  await room.initialize(workspaceId);
  return room;
}

export class WorkspaceRoom extends DurableObject<Env> {
  /// Cache of the current workspace data.
  workspace!: Awaited<ReturnType<typeof getWorkspace>>;

  /// Initializes the Durable Object with the given workspace ID.
  async initialize(workspaceId: string) {
    if (this.workspace) return;
    await this.ctx.blockConcurrencyWhile(async () => {
      if (this.workspace) return;
      this.workspace = await getWorkspace(workspaceId);
    });
  }

  /// Re-fetches the workspace data and re-broadcasts to all connected clients.
  /// Called by any procedure that modifies workspace data.
  async invalidate() {
    this.workspace = await getWorkspace(this.workspace.id);
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(JSON.stringify(this.workspace));
    }
  }

  /// Handles incoming WebSocket connections.
  /// Sends the current workspace data upon connection.
  async fetch() {
    const {"0": client, "1": server} = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify(this.workspace));
    return new Response(null, {status: 101, webSocket: client});
  }
}
