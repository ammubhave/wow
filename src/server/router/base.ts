import {ORPCError, os} from "@orpc/server";

import {auth} from "@/lib/auth";

import {getMemberWorkspace} from "../workspace-access";
import {ActivityLogService} from "./services/activity-log";
import {DiscordService} from "./services/discord";
import {GoogleService} from "./services/google";
import {NotificationService} from "./services/notification";

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
 */
export const preauthorize = os
  .$context<{session: Session}>()
  .middleware(async ({context, next}, input: {workspaceSlug: string}) => {
    const result = await getMemberWorkspace(input.workspaceSlug, context.session.user.id);
    if (result.status !== "OK") throw new ORPCError(result.status);
    return next({context: {workspace: result.workspace}});
  });
