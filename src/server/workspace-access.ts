import {and, eq, getColumns} from "drizzle-orm";

import {auth} from "@/lib/auth";
import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

// Every organization column except the server-only Google OAuth credentials.
const {
  googleAccessToken: _googleAccessToken,
  googleRefreshToken: _googleRefreshToken,
  googleTokenExpiresAt: _googleTokenExpiresAt,
  ...workspaceColumns
} = getColumns(schema.organization);

/**
 * Resolves a workspace by slug and checks that `userId` is a member of it, in a single indexed
 * query (organization slug unique index + member lookup). Replaces `auth.api.getFullOrganization`
 * for authorization, which also loads every member and invitation of the workspace.
 */
export async function getMemberWorkspace(workspaceSlug: string, userId: string) {
  const row = await db
    .select({workspace: workspaceColumns, memberId: schema.member.id})
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
  return {status: "OK", workspace: row.workspace} as const;
}

export type MemberWorkspace = Extract<
  Awaited<ReturnType<typeof getMemberWorkspace>>,
  {status: "OK"}
>["workspace"];

/** Whether `userId` is a member of the workspace that owns `puzzleId` (puzzle -> round -> workspace). */
export async function isPuzzleMember(puzzleId: string, userId: string) {
  const row = await db
    .select({id: schema.member.id})
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
  return row !== undefined;
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
 * For raw API routes (websocket upgrades): requires a session and membership in `workspaceSlug`.
 * Returns the workspace, or an error `Response` to return as-is.
 */
export async function authorizeWorkspaceRequest(request: Request, workspaceSlug: string) {
  const session = await auth.api.getSession({headers: request.headers});
  if (!session) return {response: new Response(null, {status: 401})} as const;
  const result = await getMemberWorkspace(workspaceSlug, session.user.id);
  if (result.status === "NOT_FOUND") return {response: new Response(null, {status: 404})} as const;
  if (result.status === "FORBIDDEN") return {response: new Response(null, {status: 403})} as const;
  return {session, workspace: result.workspace} as const;
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
