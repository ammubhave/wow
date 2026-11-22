import {ORPCError, os} from "@orpc/server";

import {ARCHIVED_MESSAGE_START} from "@/lib/archived";
import {auth} from "@/lib/auth";

import {trackServerEvent, trackUsage} from "../posthog";
import {getMemberWorkspace, type WorkspaceRole} from "../workspace-access";
import {ActivityLogService} from "./services/activity-log";
import {DiscordService} from "./services/discord";
import {GoogleService} from "./services/google";
import {NotificationService} from "./services/notification";
import {TRACKED_PROCEDURES} from "./tracking";

export type Context = {headers: Headers};

export type Session = typeof auth.$Infer.Session;

export const base = os.$context<Context>();

/** What a signed-in procedure's handler gets (see `procedure`). */
export type AuthedContext = {
  session: Session;
  google: GoogleService;
  activityLog: ActivityLogService;
  discord: DiscordService;
  notification: NotificationService;
};

export const procedure = base.use(async ({context, next}) => {
  const session = await auth.api.getSession({headers: context.headers});
  if (!session) {
    throw new ORPCError("UNAUTHORIZED");
  }

  return next({
    context: {
      session,
      google: new GoogleService(),
      activityLog: new ActivityLogService(session),
      discord: new DiscordService(),
      notification: new NotificationService(),
    },
  });
});

/**
 * Resolves `input.workspaceSlug` and requires the caller to be a member of that workspace. Every
 * procedure that touches workspace data must use this AND scope any input IDs (rounds, puzzles) to
 * `context.workspace.id`, so IDs from another workspace can't be acted on.
 *
 * Once the procedure succeeds, it also records its product event (see `TRACKED_PROCEDURES`).
 */
/**
 * What still works in an archived workspace, which is read-only: looking at it, managing who's in
 * it, and unarchiving it. Everything else is refused (an allowlist, so new procedures are covered).
 */
const ALLOWED_WHEN_ARCHIVED = new Set([
  "workspaces.getGoogleTokenState",
  "workspaces.state",
  "workspaces.activityLog",
  "workspaces.solves",
  "workspaces.recap",
  "workspaces.getDiscordInfo",
  "workspaces.leave",
  "workspaces.setArchived",
  "workspaces.discord.listTextChannels",
  "puzzles.get",
  "puzzles.myTimes",
  "rounds.list",
  // Nobody can join an archived workspace, so no new invitations; old ones can be cancelled.
  "workspaces.invitations.list",
  "workspaces.invitations.cancel",
]);
const ALLOWED_PREFIXES_WHEN_ARCHIVED = ["workspaces.members."];
const allowedWhenArchived = (path: string) =>
  ALLOWED_WHEN_ARCHIVED.has(path) ||
  ALLOWED_PREFIXES_WHEN_ARCHIVED.some(prefix => path.startsWith(prefix));

export const preauthorize = os
  .$context<{session: Session}>()
  .middleware(async ({context, next, path}, input: {workspaceSlug: string}) => {
    const result = await getMemberWorkspace(input.workspaceSlug, context.session.user.id);
    if (result.status !== "OK") throw new ORPCError(result.status);
    if (result.workspace.archivedAt !== null && !allowedWhenArchived(path.join("."))) {
      throw new ORPCError("FORBIDDEN", {
        message: `${ARCHIVED_MESSAGE_START}, so it's read-only. An owner can unarchive it.`,
      });
    }
    trackUsage("usage_request", {
      workspaceId: result.workspace.id,
      userId: context.session.user.id,
      properties: {kind: "rpc", name: path.join(".")},
    });
    const output = await next({context: {workspace: result.workspace, role: result.role}});
    const tracked = TRACKED_PROCEDURES[path.join(".")];
    if (tracked) {
      const [event, describe] = tracked;
      trackServerEvent(event, {
        distinctId: context.session.user.id,
        workspaceId: result.workspace.id,
        properties: {role: result.role, ...describe(input)},
      });
    }
    return output;
  });

/** After `preauthorize`: only the workspace's owners may continue. */
export const requireOwner = os
  .$context<{role: WorkspaceRole}>()
  .middleware(async ({context, next}) => {
    if (context.role !== "owner") {
      throw new ORPCError("FORBIDDEN", {message: "Only workspace owners can do this."});
    }
    return next();
  });
