import {and, eq, getColumns} from "drizzle-orm";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {getHeadersSession} from "./request-session";
import {recordRequest} from "./usage";

// Every organization column except the server-only Google OAuth credentials.
const {
  googleAccessToken: _googleAccessToken,
  googleRefreshToken: _googleRefreshToken,
  googleTokenExpiresAt: _googleTokenExpiresAt,
  ...workspaceColumns
} = getColumns(schema.organization);

/**
 * Workspace roles. Owners (the creator, and whoever an owner promotes) manage the workspace: its
 * name, password, Google and Discord connections, and members' roles. Everyone else is a member.
 * Members used to join as "admin", which is now treated as a member.
 */
export type WorkspaceRole = "owner" | "member";
export const toWorkspaceRole = (role: string | null | undefined): WorkspaceRole =>
  role === "owner" ? "owner" : "member";

/**
 * Resolves a workspace by slug and checks that `userId` is a member of it, in a single indexed
 * query (organization slug unique index + member lookup). Replaces `auth.api.getFullOrganization`
 * for authorization, which also loads every member and invitation of the workspace.
 */
export async function getMemberWorkspace(workspaceSlug: string, userId: string) {
  const row = await db
    .select({workspace: workspaceColumns, memberId: schema.member.id, role: schema.member.role})
    .from(schema.organization)
    .leftJoin(
      schema.member,
      and(
        eq(schema.member.organizationId, schema.organization.id),
        eq(schema.member.userId, userId)
      )
    )
    .where(eq(schema.organization.slug, workspaceSlug))
    .get();
  if (!row) return {status: "NOT_FOUND"} as const;
  if (!row.memberId) return {status: "FORBIDDEN"} as const;
  return {status: "OK", workspace: row.workspace, role: toWorkspaceRole(row.role)} as const;
}

export type MemberWorkspace = Extract<
  Awaited<ReturnType<typeof getMemberWorkspace>>,
  {status: "OK"}
>["workspace"];

/**
 * Set on a request forwarded to a puzzle's or team's room (sheet, whiteboard, chat) when its
 * workspace is archived: the room then lets you look but not change anything. Always set or
 * removed by our routes, never taken from the browser.
 */
export const READ_ONLY_HEADER = "x-wow-read-only";

/** `request` to forward to a room, marked read-only when the workspace is archived. */
export function roomRequest(request: Request, {archived}: {archived: boolean}) {
  const headers = new Headers(request.headers);
  if (archived) headers.set(READ_ONLY_HEADER, "1");
  else headers.delete(READ_ONLY_HEADER);
  return new Request(request, {headers});
}

/** Whether a room's connection is read-only (see `READ_ONLY_HEADER`). */
export const isReadOnlyRequest = (request: Request) =>
  request.headers.get(READ_ONLY_HEADER) === "1";

/** Like `isPuzzleMember`, for a puzzle's rooms: also whether its workspace is archived. */
export async function puzzleRoomAccess(puzzleId: string, userId: string) {
  const row = await db
    .select({workspaceId: schema.round.workspaceId, archivedAt: schema.organization.archivedAt})
    .from(schema.puzzle)
    .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.round.workspaceId))
    .innerJoin(
      schema.member,
      and(
        eq(schema.member.organizationId, schema.round.workspaceId),
        eq(schema.member.userId, userId)
      )
    )
    .where(eq(schema.puzzle.id, puzzleId))
    .get();
  return row && {workspaceId: row.workspaceId, archived: row.archivedAt !== null};
}

/**
 * Whether `userId` is a member of the workspace that owns `puzzleId` (puzzle -> round -> workspace):
 * that workspace's id if so (for usage attribution), undefined if not.
 */
export async function isPuzzleMember(puzzleId: string, userId: string) {
  const row = await db
    .select({workspaceId: schema.round.workspaceId})
    .from(schema.puzzle)
    .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
    .innerJoin(
      schema.member,
      and(
        eq(schema.member.organizationId, schema.round.workspaceId),
        eq(schema.member.userId, userId)
      )
    )
    .where(eq(schema.puzzle.id, puzzleId))
    .get();
  return row?.workspaceId;
}

/**
 * Counts a request to an API route a workspace member called (see `recordRequest`). Named by
 * kind and route, with workspace slugs and ids masked, so routes group together.
 */
export function trackWorkspaceRequest(
  request: Request,
  {
    workspaceId,
    userId,
    workspaceSlug,
  }: {workspaceId: string; userId: string; workspaceSlug?: string}
) {
  const path = new URL(request.url).pathname;
  const kind = isWebSocketUpgrade(request)
    ? "socket"
    : path.startsWith("/api/voice/")
      ? "voice_signaling"
      : "file";
  const name = path
    .split("/")
    .map(segment =>
      segment === workspaceSlug
        ? ":workspace"
        : /^[0-9a-f-]{16,}$/i.test(segment) || /^[A-Za-z0-9_-]{24,}$/.test(segment)
          ? ":id"
          : segment
    )
    .join("/");
  recordRequest({workspaceId, userId, kind, name});
}

/** Only allow same-origin relative redirects (e.g. "/my-team/settings"), never "//evil.com". */
export function safeRedirectPath(redirectUrl: string, requestUrl: string) {
  try {
    const base = new URL(requestUrl);
    const target = new URL(redirectUrl, base);
    if (target.origin !== base.origin) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

/**
 * For raw API routes (websocket upgrades, OAuth callbacks): requires a session and membership in
 * `workspaceSlug` (and, with `ownerOnly`, the owner role). Returns the workspace, or an error
 * `Response` to return as-is.
 */
export async function authorizeWorkspaceRequest(
  request: Request,
  workspaceSlug: string,
  {ownerOnly = false} = {}
) {
  const session = await getRequestSession(request);
  if (!session) return {response: new Response(null, {status: 401})} as const;
  const result = await getMemberWorkspace(workspaceSlug, session.user.id);
  if (result.status === "NOT_FOUND") return {response: new Response(null, {status: 404})} as const;
  if (result.status === "FORBIDDEN" || (ownerOnly && result.role !== "owner")) {
    return {response: new Response(null, {status: 403})} as const;
  }
  trackWorkspaceRequest(request, {
    workspaceId: result.workspace.id,
    userId: session.user.id,
    workspaceSlug,
  });
  return {session, workspace: result.workspace, role: result.role} as const;
}

const isWebSocketUpgrade = (request: Request) =>
  request.headers.get("Upgrade")?.toLowerCase() === "websocket";

/**
 * The request's session. On a websocket upgrade it's read straight from the database and never
 * refreshed, so better-auth writes no cookies: a 101 response can't carry Set-Cookie, and TanStack
 * Start throws ("Unable to reconcile response") rebuilding one that has cookie writes pending. That
 * failed every socket of a tab whose 5-minute session cache cookie had lapsed, over and over, until
 * some ordinary request refreshed the cookie.
 */
export function getRequestSession(request: Request) {
  return getHeadersSession(request.headers, {fresh: isWebSocketUpgrade(request)});
}

/** Whether `puzzleId` belongs to a round of `workspaceId`. */
export async function isPuzzleInWorkspace(puzzleId: string, workspaceId: string) {
  const row = await db
    .select({id: schema.puzzle.id})
    .from(schema.puzzle)
    .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
    .where(and(eq(schema.puzzle.id, puzzleId), eq(schema.round.workspaceId, workspaceId)))
    .get();
  return row !== undefined;
}

/** Durable Object websocket rooms can only answer upgrade requests; reject anything else up front. */
export function requireWebSocketUpgrade(request: Request) {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ? null
    : new Response("Expected a WebSocket upgrade", {status: 426});
}
