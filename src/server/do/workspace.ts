/**
 * Durable Object managing a workspace room.
 * Sends updates to connected clients when the workspace data changes.
 * Any procedure that modifies workspace data should call the `invalidate` method
 * to re-broadcast the updated data.
 */

import {DurableObject, env, waitUntil} from "cloudflare:workers";
import {and, desc, eq, gte, lt, or} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {diffState, type Json, type Patch} from "@/lib/state-patch";
import {parseTheme} from "@/lib/workspace-theme";
import {
  type VoiceParticipant,
  type VoiceState,
  type VoiceHello,
  type VoiceMute,
  type VoiceSpeaking,
  type VoiceRoomCounts,
  type VoiceUpdate,
  type VoiceUsageSample,
  type VoiceUser,
  voiceClientMessageSchema,
  voiceUsageSince,
} from "@/server/voice";

import {meter} from "../usage";

/// Who's on each websocket, and their call state (kept as the socket's attachment, so it survives
/// the room hibernating).
type SocketAttachment = {
  connectionId: string;
  user: VoiceUser;
  voice?: VoiceUpdate;
  /** Takes patches (`WorkspacePatchMessage`); older clients only understand the bare full state. */
  patches?: boolean;
};

/// Query parameter a client adds to the socket URL to receive patches instead of full states.
/// (Clients of the first patch format, which sent `?patches`, get full states.)
export const WORKSPACE_PATCHES_PARAM = "diffs";

// How a socket stays in sync, given that the room handles one event at a time and a WebSocket
// delivers every message, in order, or closes:
//  - A socket is accepted and sent the current state in one synchronous step, so from then on it
//    holds exactly `#parsed`.
//  - Each reload diffs against `#parsed` and, in one synchronous step, updates `#parsed` and sends
//    the patch to every socket. So every socket goes from `#parsed` to the new `#parsed`.
//  - When the room has no previous state (first load, or woken from hibernation, which clears
//    memory but keeps sockets), the reload sends everyone the full state instead.
//  - A reconnect is a new socket, so it starts over with the full state.

/// The full state, for clients that take patches: on connect, when the room has no previous state
/// to diff against, and when a patch would be bigger.
export type WorkspaceFullMessage = {type: "workspace"; state: WorkspaceRoomWireState};
/// What changed since the previous message on this socket.
export type WorkspacePatchMessage = {type: "workspacePatch"; patch: Patch};

/// Header the API route uses to tell the room who is connecting (set server-side only).
export const WORKSPACE_USER_HEADER = "x-wow-user";

// Voice access control. The SFU itself has no permissions (anyone holding the app secret can pull
// any track), so the voice proxy asks this room before letting anyone create sessions or pull.
/// Which user created each SFU session.
const VOICE_SESSION_SCHEMA = `
CREATE TABLE IF NOT EXISTS voice_session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS voice_session_created_at ON voice_session (created_at);
`;
/// Session records are only needed while a call can last; older ones are pruned.
const VOICE_SESSION_TTL_MS = 1000 * 60 * 60 * 48;
/// New SFU sessions allowed per user per minute (joining, reconnects), well under Cloudflare's
/// per-app limit, so one misbehaving client can't exhaust it for the team.
const VOICE_SESSIONS_PER_MINUTE = 10;
type VoiceSessionRecord = {userId: string; createdAt: number};
/// Counts per call room in a voice state.
const roomCounts = ({rooms}: VoiceState): Record<string, VoiceRoomCounts> =>
  Object.fromEntries(
    Object.entries(rooms).map(([room, people]) => [
      room,
      {
        people: people.length,
        cameras: people.filter(p => p.camera).length,
        screens: people.filter(p => p.screen).length,
      },
    ])
  );

/// Storage key for voice usage accounting (see `#recordVoiceUsage`).
const VOICE_USAGE_KEY = "voiceUsage";

/// Whether two sets of call room counts are the same.
const sameRooms = (a: Record<string, VoiceRoomCounts>, b: Record<string, VoiceRoomCounts>) =>
  JSON.stringify(a) === JSON.stringify(b);

// Overlap window when re-reading the activity log incrementally, so entries committed slightly out
// of `createdAt` order are not missed (results are de-duplicated by id).
const ACTIVITY_LOG_OVERLAP_MS = 10_000;
// The room state carries only the newest activity entries (the footer shows the latest); the
// activity page pages through older ones (`workspaces.activityLog`).
const RECENT_ACTIVITY_LOG_ENTRIES = 50;
/** Guesses sent with the room state: the queue and recent history (older ones aren't needed). */
const RECENT_GUESSES = 300;

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
  const [workspace, rounds, newActivityLogEntries, guesses] = await Promise.all([
    db.select().from(schema.organization).where(eq(schema.organization.id, workspaceId)).get(),
    db.query.round.findMany({
      where: {workspaceId},
      with: {puzzles: {with: {contributors: {columns: {userId: true}}}}},
    }),
    // Cold: just the newest entries. Warm: only what's new since the newest cached one.
    getActivityLogEntries(workspaceId, since ? {since} : {limit: RECENT_ACTIVITY_LOG_ENTRIES}),
    // The guess queue and recent history (newest first), with who queued each.
    db
      .select({
        id: schema.puzzleGuess.id,
        puzzleId: schema.puzzleGuess.puzzleId,
        answer: schema.puzzleGuess.answer,
        status: schema.puzzleGuess.status,
        response: schema.puzzleGuess.response,
        retryAt: schema.puzzleGuess.retryAt,
        createdAt: schema.puzzleGuess.createdAt,
        updatedAt: schema.puzzleGuess.updatedAt,
        createdBy: schema.puzzleGuess.createdBy,
        createdByName: schema.user.name,
      })
      .from(schema.puzzleGuess)
      .innerJoin(schema.user, eq(schema.user.id, schema.puzzleGuess.createdBy))
      .where(eq(schema.puzzleGuess.workspaceId, workspaceId))
      .orderBy(desc(schema.puzzleGuess.createdAt))
      .limit(RECENT_GUESSES),
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
    /** New puzzles get a Google file: Drive is connected and the team chose Google Sheets. */
    googleConnected: googleAccessToken !== null && publicWorkspace.sheetsTool === "google",
    activityLogEntries,
    guesses,
    // Flat: each puzzle is sent once; clients derive children/metas (see expandWorkspaceState).
    // oxlint-disable-next-line oxc/no-map-spread -- a new shape (contributors → contributorIds).
    rounds: rounds.map(round => ({
      ...round,
      // oxlint-disable-next-line oxc/no-map-spread -- as above.
      puzzles: round.puzzles.map(({contributors, ...puzzle}) => ({
        ...puzzle,
        /** Who says they helped solve it. */
        contributorIds: contributors.map(c => c.userId),
      })),
    })),
    // JSON columns (typed `unknown`): validate rather than cast.
    tags: z
      .array(z.string())
      .catch([])
      .parse(workspace.tags ?? []),
    links: z
      .array(z.object({name: z.string(), url: z.string()}))
      .catch([])
      .parse(workspace.links ?? []),
    theme: parseTheme(workspace.theme),
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
///
/// Runs after the response rather than delaying it: the room re-reads the board from D1 and sends
/// the change to everyone, which the caller doesn't need to wait for. The edit is already
/// committed, so the reload sees it (reloads requested during one run once more afterwards). The
/// editor's own browser keeps showing its change until the broadcast arrives (see
/// workspace-mutations.ts), so nothing flickers.
export async function invalidateWorkspace(workspaceId: string) {
  waitUntil(
    getWorkspaceRoom(workspaceId)
      .invalidate(workspaceId)
      .catch((error: unknown) => {
        console.error("Couldn't refresh the workspace room", error);
      })
  );
}

export class WorkspaceRoom extends DurableObject<Env> {
  /// Recent SFU session creations per user, for rate limiting (in memory; resetting on hibernation
  /// only makes the limit briefly more lenient).
  #voiceSessionsCreated = new Map<string, number[]>();
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
  /// The same, parsed back: exactly what every connected client holds, to diff the next reload
  /// against.
  #parsed: Json | undefined;
  /// Who has been in each call room since when, for voice metering (also in storage, so a long call
  /// is still counted when the room hibernates mid-call).
  #voiceUsage: VoiceUsageSample | undefined;

  constructor(ctx: DurableObjectState, workerEnv: Env) {
    super(ctx, workerEnv);
    ctx.storage.sql.exec(VOICE_SESSION_SCHEMA);
    void ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<VoiceUsageSample>(VOICE_USAGE_KEY);
      if (!saved) return;
      // Waking from hibernation, the calls are still there. After a restart (a deploy), sockets
      // dropped without a goodbye: when a call ended is unknown, so that tail isn't counted, rather
      // than billing every hour until the room woke up again.
      if (sameRooms(saved.rooms, this.#voiceRoomCounts())) this.#voiceUsage = saved;
      else await ctx.storage.delete(VOICE_USAGE_KEY);
    });
  }

  /// Loads the workspace data and broadcasts it to all connected clients.
  async #load(workspaceId: string) {
    const workspace = await getWorkspace(workspaceId, this.activityLog);
    const message = JSON.stringify(workspace);
    // Exactly what a client holds after JSON.parse (dates as strings, its key order).
    const parsed: Json = JSON.parse(message);
    const previous = this.#parsed;
    const patch = previous === undefined ? undefined : diffState(previous, parsed);
    this.workspace = workspace;
    this.activityLog = workspace.activityLogEntries;
    // Nothing changed (say, a no-op edit): everyone already has this state.
    if (previous !== undefined && patch === undefined) return;
    this.#message = message;
    this.#parsed = parsed;

    const full = this.#fullMessage();
    let patchMessage: string | undefined;
    if (patch) {
      patchMessage = JSON.stringify({
        type: "workspacePatch",
        patch,
      } satisfies WorkspacePatchMessage);
      // A patch only helps when it's smaller (a bulk change can touch nearly everything).
      if (patchMessage.length >= full.length) patchMessage = undefined;
    }
    for (const ws of this.ctx.getWebSockets()) {
      if (this.#attachment(ws)?.patches) ws.send(patchMessage ?? full);
      else ws.send(message);
    }
  }

  /// The current state for a client that takes patches.
  #fullMessage() {
    // `#message` is already serialized: splice it in rather than serializing the state again.
    return `{"type":"workspace","state":${this.#message}}`;
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
    // A load already under way (another connection, right after a deploy or a wake) is enough:
    // queueing a second one would re-read D1 and re-broadcast the same board to everyone.
    if (this.#running) return await this.#running;
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
      this.#parsed = undefined;
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
  /// Sends the current workspace data (and who's in which voice room) upon connection.
  async fetch(request: Request) {
    // The cache may have been dropped by an `invalidate` between `initialize` and this call.
    if (!this.#message && this.#workspaceId) await this.#reload(this.#workspaceId);
    if (!this.#message) {
      return new Response("Workspace room not initialized", {status: 500});
    }
    const user: VoiceUser | null = JSON.parse(request.headers.get(WORKSPACE_USER_HEADER) ?? "null");
    // Only the authorizing API route reaches the room, and it always says who's connecting.
    if (!user) return new Response("Missing user", {status: 400});
    const {"0": client, "1": server} = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    const connectionId = crypto.randomUUID();
    const patches = new URL(request.url).searchParams.has(WORKSPACE_PATCHES_PARAM);
    server.serializeAttachment({connectionId, user, patches} satisfies SocketAttachment);
    server.send(patches ? this.#fullMessage() : this.#message);
    server.send(JSON.stringify({type: "voiceHello", connectionId} satisfies VoiceHello));
    server.send(JSON.stringify(this.#voiceState()));
    return new Response(null, {status: 101, webSocket: client});
  }

  /// Clients only ever send their own call state.
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    let update;
    try {
      update = voiceClientMessageSchema.parse(JSON.parse(message));
    } catch {
      return; // Ignore malformed messages instead of throwing in the DO.
    }
    const attachment = this.#attachment(ws);
    if (!attachment) return;
    if (update.type === "speaking") {
      // Ephemeral: relayed to everyone (the speaker included, so all their tabs agree), never
      // stored. Only someone unmuted in a call can start speaking; stopping always goes through
      // (it can arrive just after they muted).
      if (update.speaking && (!attachment.voice || attachment.voice.muted)) return;
      const relay: VoiceSpeaking = {
        type: "speaking",
        connectionId: attachment.connectionId,
        speaking: update.speaking,
      };
      const payload = JSON.stringify(relay);
      for (const socket of this.ctx.getWebSockets()) socket.send(payload);
      return;
    }
    // Tracks can only be claimed from SFU sessions this person created (no posing as a teammate).
    const sessionIds = [...new Set(Object.values(update.tracks).map(track => track.sessionId))];
    if (sessionIds.length > 0) {
      const ownsAll = sessionIds.every(id => this.voiceSessionOwner(id) === attachment.user.id);
      if (!ownsAll) return;
    }
    const unmuting = update.room !== null && !update.muted && (attachment.voice?.muted ?? true);
    ws.serializeAttachment({...attachment, voice: update.room ? update : undefined});
    if (unmuting) {
      // You're unmuted in one place at a time: mute your other tabs and devices.
      const mute = JSON.stringify({type: "voiceMute"} satisfies VoiceMute);
      for (const socket of this.ctx.getWebSockets()) {
        if (socket === ws) continue;
        const other = this.#attachment(socket);
        if (other?.user.id === attachment.user.id && other.voice && !other.voice.muted) {
          socket.send(mute);
        }
      }
    }
    this.#broadcastVoice();
  }

  webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.#leftCall(ws);
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  webSocketError(ws: WebSocket) {
    this.#leftCall(ws);
  }

  /// A closed socket's person drops out of their call (if they were in one).
  #leftCall(ws: WebSocket) {
    if (this.#attachment(ws)?.voice) this.#broadcastVoice(ws);
  }

  /// Voice: whether `userId` may create another SFU session now (and counts it if so).
  async allowVoiceSession(userId: string) {
    const now = Date.now();
    const recent = (this.#voiceSessionsCreated.get(userId) ?? []).filter(at => now - at < 60_000);
    const allowed = recent.length < VOICE_SESSIONS_PER_MINUTE;
    if (allowed) recent.push(now);
    this.#voiceSessionsCreated.set(userId, recent);
    return allowed;
  }

  /// Voice: records that `userId` created SFU session `sessionId` (before they learn its id).
  async registerVoiceSession(sessionId: string, userId: string) {
    const now = Date.now();
    this.#saveVoiceSession(sessionId, {userId, createdAt: now});
    // Now and then, drop records of sessions too old to still be in a call.
    if (Math.random() < 0.05) {
      this.ctx.storage.sql.exec(
        "DELETE FROM voice_session WHERE created_at < ?",
        now - VOICE_SESSION_TTL_MS
      );
    }
  }

  /// Who created SFU session `sessionId`, if it's known.
  voiceSessionOwner(sessionId: string): string | undefined {
    return this.ctx.storage.sql
      .exec<{user_id: string}>("SELECT user_id FROM voice_session WHERE id = ?", sessionId)
      .toArray()[0]?.user_id;
  }

  #saveVoiceSession(sessionId: string, {userId, createdAt}: VoiceSessionRecord) {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO voice_session (id, user_id, created_at) VALUES (?, ?, ?)",
      sessionId,
      userId,
      createdAt
    );
  }

  /// Voice: whether `userId` may receive these tracks. Only tracks published by someone in a room
  /// where this person visibly is too: no listening in without showing up, and nothing from
  /// another workspace.
  async canPullVoiceTracks(userId: string, tracks: {sessionId: string; trackName: string}[]) {
    const myRooms = new Set<string>();
    const trackRooms = new Map<string, string>();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.#attachment(ws);
      const voice = attachment?.voice;
      if (!attachment || !voice?.room) continue;
      const {room} = voice;
      if (attachment.user.id === userId) myRooms.add(room);
      for (const track of Object.values(voice.tracks)) {
        trackRooms.set(`${track.sessionId}/${track.trackName}`, room);
      }
    }
    return tracks.every(track => {
      const room = trackRooms.get(`${track.sessionId}/${track.trackName}`);
      return room !== undefined && myRooms.has(room);
    });
  }

  #attachment(ws: WebSocket): SocketAttachment | null {
    // deserializeAttachment() is typed `any`; it's only ever written in fetch()/webSocketMessage()
    // (null for a socket that has none).
    return ws.deserializeAttachment();
  }

  /// Everyone in a call, grouped by room. `closing` is a socket that's going away.
  #voiceState(closing?: WebSocket): VoiceState {
    const rooms: Record<string, VoiceParticipant[]> = {};
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === closing) continue;
      const attachment = this.#attachment(ws);
      if (!attachment?.voice) continue;
      const {connectionId, user, voice} = attachment;
      const {type: _, room, ...call} = voice;
      if (room === null) continue;
      (rooms[room] ??= []).push({...call, connectionId, user});
    }
    return {type: "voice", rooms};
  }

  /// Counts per call room right now.
  #voiceRoomCounts(closing?: WebSocket) {
    return roomCounts(this.#voiceState(closing));
  }

  /// Meters the streams delivered since the last call change (see `voiceUsageSince`), then starts
  /// a new period with `rooms`.
  #recordVoiceUsage(rooms: Record<string, VoiceRoomCounts>) {
    const now = Date.now();
    const workspaceId = this.ctx.id.name;
    if (workspaceId) {
      for (const period of voiceUsageSince(this.#voiceUsage, now)) {
        meter({
          workspaceId,
          meter: "sfu_stream_seconds",
          quantity: period.streamSeconds,
          detail: period.kind,
        });
      }
    }
    this.#voiceUsage = Object.keys(rooms).length > 0 ? {at: now, rooms} : undefined;
    void (this.#voiceUsage
      ? this.ctx.storage.put(VOICE_USAGE_KEY, this.#voiceUsage)
      : this.ctx.storage.delete(VOICE_USAGE_KEY));
  }

  #broadcastVoice(closing?: WebSocket) {
    const state = this.#voiceState(closing);
    this.#recordVoiceUsage(roomCounts(state));
    const message = JSON.stringify(state);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== closing) ws.send(message);
    }
  }
}
