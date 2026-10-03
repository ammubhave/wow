import {ORPCError, os} from "@orpc/server";

import {auth} from "@/lib/auth";

import {trackServerEvent} from "../posthog";
import {getMemberWorkspace, type WorkspaceRole} from "../workspace-access";
import {ActivityLogService} from "./services/activity-log";
import {DiscordService} from "./services/discord";
import {GoogleService} from "./services/google";
import {NotificationService} from "./services/notification";
import {TRACKED_PROCEDURES} from "./tracking";

export type Context = {headers: Headers};

export type Session = typeof auth.$Infer.Session;

export const base = os.$context<Context>();

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
export const preauthorize = os
  .$context<{session: Session}>()
  .middleware(async ({context, next, path}, input: {workspaceSlug: string}) => {
    const result = await getMemberWorkspace(input.workspaceSlug, context.session.user.id);
    if (result.status !== "OK") throw new ORPCError(result.status);
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
